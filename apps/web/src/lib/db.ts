/**
 * Local persistence in IndexedDB. Nothing here touches the network.
 * - projects:   Project JSON
 * - blobs:      image Blobs, keyed `${projectId}:${assetId}` so each project owns its files
 * - thumbnails: small JPEG Blob per project
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { migrateProject, type Project } from '@svs/visual-core';

interface SvsDB extends DBSchema {
  projects: { key: string; value: Project };
  blobs: { key: string; value: Blob };
  thumbnails: { key: string; value: Blob };
}

let dbPromise: Promise<IDBPDatabase<SvsDB>> | null = null;

function db() {
  dbPromise ??= openDB<SvsDB>('steffpoint-visual-studio', 1, {
    upgrade(d) {
      d.createObjectStore('projects', { keyPath: 'id' });
      d.createObjectStore('blobs');
      d.createObjectStore('thumbnails');
    },
  });
  return dbPromise;
}

const blobKey = (projectId: string, assetId: string) => `${projectId}:${assetId}`;
const projectRange = (projectId: string) => IDBKeyRange.bound(`${projectId}:`, `${projectId}:￿`);

export async function listProjects(): Promise<Project[]> {
  const all = await (await db()).getAll('projects');
  return all.map((p) => migrateProject(p)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const p = await (await db()).get('projects', id);
  return p ? migrateProject(p) : undefined;
}

export async function saveProject(p: Project): Promise<void> {
  await (await db()).put('projects', p);
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

export async function putBlob(projectId: string, assetId: string, blob: Blob): Promise<void> {
  await (await db()).put('blobs', blob, blobKey(projectId, assetId));
}

export async function getBlob(projectId: string, assetId: string): Promise<Blob | undefined> {
  return (await db()).get('blobs', blobKey(projectId, assetId));
}

/** Delete blobs of a project that are no longer referenced by its assets. */
export async function collectGarbage(project: Project): Promise<void> {
  const d = await db();
  const keep = new Set(project.assets.map((a) => blobKey(project.id, a.id)));
  const keys = await d.getAllKeys('blobs', projectRange(project.id));
  const tx = d.transaction('blobs', 'readwrite');
  await Promise.all([...keys.filter((k) => !keep.has(k)).map((k) => tx.store.delete(k)), tx.done]);
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

export async function putThumbnail(projectId: string, blob: Blob): Promise<void> {
  await (await db()).put('thumbnails', blob, projectId);
}

export async function getThumbnail(projectId: string): Promise<Blob | undefined> {
  return (await db()).get('thumbnails', projectId);
}
