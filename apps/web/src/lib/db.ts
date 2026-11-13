/**
 * Local persistence in IndexedDB. Nothing here touches the network.
 * - projects:   Project JSON
 * - blobs:      image Blobs, keyed `${projectId}:${assetId}` so each project owns its files
 * - thumbnails: small JPEG Blob per project
 * - brandKits:  saved brand identities (version 2)
 * - kitLogos:   the logo image of each brand kit, keyed by kit id (version 2)
 *
 * Concurrency: every write of an existing project goes through `saveProjectGuarded`
 * (optimistic locking on `revision`), so a stale tab can never silently overwrite newer work.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { migrateBrandKit, migrateProject, type BrandKit, type Project } from '@svs/visual-core';
import { t } from '../i18n';

/**
 * Binary data is stored as ArrayBuffer + MIME type rather than Blob: WebKit cannot store
 * Blobs in IndexedDB in ephemeral sessions (Safari private browsing), ArrayBuffers work everywhere.
 * Older records may still be Blobs; both are read.
 */
interface StoredBinary {
  type: string;
  data: ArrayBuffer;
}
type BinaryRecord = StoredBinary | Blob;

interface SvsDB extends DBSchema {
  projects: { key: string; value: Project };
  blobs: { key: string; value: BinaryRecord };
  thumbnails: { key: string; value: BinaryRecord };
  brandKits: { key: string; value: BrandKit };
  kitLogos: { key: string; value: BinaryRecord };
}

async function toRecord(blob: Blob): Promise<StoredBinary> {
  return { type: blob.type, data: await blob.arrayBuffer() };
}

function fromRecord(r: BinaryRecord | undefined): Blob | undefined {
  if (!r) return undefined;
  return r instanceof Blob ? r : new Blob([r.data], { type: r.type });
}

let dbPromise: Promise<IDBPDatabase<SvsDB>> | null = null;

function db() {
  dbPromise ??= openDB<SvsDB>('steffpoint-visual-studio', 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('projects', { keyPath: 'id' });
        d.createObjectStore('blobs');
        d.createObjectStore('thumbnails');
      }
      if (oldVersion < 2) {
        d.createObjectStore('brandKits', { keyPath: 'id' });
        d.createObjectStore('kitLogos');
      }
    },
    // Another tab is upgrading the database: let it, and reopen on next use.
    blocking() {
      void dbPromise?.then((x) => x.close());
      dbPromise = null;
    },
  });
  return dbPromise;
}

const blobKey = (projectId: string, assetId: string) => `${projectId}:${assetId}`;
const projectRange = (projectId: string) => IDBKeyRange.bound(`${projectId}:`, `${projectId}:￿`);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class StorageError extends Error {}

/** Turn low level IndexedDB errors into messages a user can act on. */
export function describeStorageError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'QuotaExceededError') {
    return t('Browser storage is full. Delete unused projects or export them as JSON, then try again.');
  }
  if (e instanceof StorageError) return e.message;
  return t('Could not save to browser storage ({error}).', { error: name ?? t('unknown error') });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  const all = await (await db()).getAll('projects');
  return all.map((p) => migrateProject(p)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const p = await (await db()).get('projects', id);
  return p ? migrateProject(p) : undefined;
}

/** Insert a brand new project (create, duplicate, import). */
export async function createProjectRecord(p: Project): Promise<void> {
  await (await db()).add('projects', { ...p, revision: 1 });
}

export type GuardedSave = { ok: true; revision: number } | { ok: false; reason: 'conflict' | 'missing'; current?: Project };

/**
 * Write `p` only if the stored revision is still `baseRevision`.
 * Read and write happen in one transaction, so two tabs cannot interleave.
 * `force` overwrites regardless (explicit "keep my version" choice).
 */
export async function saveProjectGuarded(p: Project, baseRevision: number, force = false): Promise<GuardedSave> {
  const tx = (await db()).transaction('projects', 'readwrite');
  const stored = await tx.store.get(p.id);
  if (!stored) {
    await tx.done;
    return { ok: false, reason: 'missing' };
  }
  const storedRevision = stored.revision ?? 0;
  if (!force && storedRevision !== baseRevision) {
    await tx.done;
    return { ok: false, reason: 'conflict', current: migrateProject(stored) };
  }
  const revision = storedRevision + 1;
  await tx.store.put({ ...p, revision, updatedAt: Date.now() });
  await tx.done;
  return { ok: true, revision };
}

/** Atomically patch a few fields (dashboard rename / favourite) without touching the rest. */
export async function patchProject(id: string, patch: Partial<Pick<Project, 'name' | 'favorite'>>, touch = true): Promise<void> {
  const tx = (await db()).transaction('projects', 'readwrite');
  const stored = await tx.store.get(id);
  if (stored) {
    await tx.store.put({ ...stored, ...patch, revision: (stored.revision ?? 0) + 1, updatedAt: touch ? Date.now() : stored.updatedAt });
  }
  await tx.done;
}

export async function deleteProject(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['projects', 'blobs', 'thumbnails'], 'readwrite');
  await Promise.all([
    tx.objectStore('projects').delete(id),
    tx.objectStore('blobs').delete(projectRange(id)),
    tx.objectStore('thumbnails').delete(id),
    tx.done,
  ]);
}

// ---------------------------------------------------------------------------
// Blobs
// ---------------------------------------------------------------------------

export async function putBlob(projectId: string, assetId: string, blob: Blob): Promise<void> {
  const record = await toRecord(blob); // read before opening the transaction (it must not await other work)
  await (await db()).put('blobs', record, blobKey(projectId, assetId));
}

export async function getBlob(projectId: string, assetId: string): Promise<Blob | undefined> {
  return fromRecord(await (await db()).get('blobs', blobKey(projectId, assetId)));
}

/**
 * Delete blobs that the *stored* project no longer references.
 * Only runs when no editor (in any tab) holds the project's lock, so an open
 * editor with undo history can never lose an image it may restore.
 */
export async function collectGarbage(projectId: string): Promise<void> {
  const run = async () => {
    const d = await db();
    const stored = await d.get('projects', projectId);
    if (!stored) return;
    const keep = new Set(stored.assets.map((a) => blobKey(projectId, a.id)));
    const keys = await d.getAllKeys('blobs', projectRange(projectId));
    const stale = keys.filter((k) => !keep.has(k));
    if (!stale.length) return;
    const tx = d.transaction('blobs', 'readwrite');
    await Promise.all([...stale.map((k) => tx.store.delete(k)), tx.done]);
  };
  if (!navigator.locks) return; // No Web Locks: skip GC rather than risk deleting used images.
  await navigator.locks.request(projectLockName(projectId), { mode: 'exclusive', ifAvailable: true }, async (lock) => {
    if (lock) await run();
  });
}

/** Copy all blobs of a project under a new project id (used by duplicate). */
export async function copyBlobs(fromId: string, toId: string): Promise<void> {
  const d = await db();
  const keys = await d.getAllKeys('blobs', projectRange(fromId));
  for (const k of keys) {
    const b = await d.get('blobs', k);
    if (b) await d.put('blobs', b, `${toId}:${k.slice(fromId.length + 1)}`);
  }
}

// ---------------------------------------------------------------------------
// Brand kits
// ---------------------------------------------------------------------------

export async function listBrandKits(): Promise<BrandKit[]> {
  const all = await (await db()).getAll('brandKits');
  return all
    .map(migrateBrandKit)
    .filter((k): k is BrandKit => !!k)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function putBrandKit(kit: BrandKit, logo: Blob | null): Promise<void> {
  const record = logo ? await toRecord(logo) : null;
  const tx = (await db()).transaction(['brandKits', 'kitLogos'], 'readwrite');
  await Promise.all([
    tx.objectStore('brandKits').put(kit),
    record ? tx.objectStore('kitLogos').put(record, kit.id) : tx.objectStore('kitLogos').delete(kit.id),
    tx.done,
  ]);
}

export async function getKitLogo(kitId: string): Promise<Blob | undefined> {
  return fromRecord(await (await db()).get('kitLogos', kitId));
}

export async function deleteBrandKit(kitId: string): Promise<void> {
  const tx = (await db()).transaction(['brandKits', 'kitLogos'], 'readwrite');
  await Promise.all([tx.objectStore('brandKits').delete(kitId), tx.objectStore('kitLogos').delete(kitId), tx.done]);
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

export async function putThumbnail(projectId: string, blob: Blob): Promise<void> {
  const record = await toRecord(blob);
  await (await db()).put('thumbnails', record, projectId);
}

export async function getThumbnail(projectId: string): Promise<Blob | undefined> {
  return fromRecord(await (await db()).get('thumbnails', projectId));
}

// ---------------------------------------------------------------------------
// Locks and storage health
// ---------------------------------------------------------------------------

export const projectLockName = (projectId: string) => `svs-project:${projectId}`;

/**
 * Hold a shared lock while a project is open in an editor. Returns a release function.
 * Shared, so several tabs may open the same project; GC needs it exclusively.
 */
export function holdProjectLock(projectId: string): () => void {
  if (!navigator.locks) return () => {};
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  navigator.locks.request(projectLockName(projectId), { mode: 'shared' }, () => held).catch(() => {});
  return release;
}

export interface StorageHealth {
  usage?: number;
  quota?: number;
  persisted?: boolean;
}

export async function getStorageHealth(): Promise<StorageHealth> {
  const s = navigator.storage;
  if (!s) return {};
  const [estimate, persisted] = await Promise.all([s.estimate?.().catch(() => undefined), s.persisted?.().catch(() => undefined)]);
  return { usage: estimate?.usage, quota: estimate?.quota, persisted };
}

/**
 * Ask the browser not to evict our data. Called after the user stores real content
 * (some browsers decide silently, Firefox may show a prompt).
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
