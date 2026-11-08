/** Editor commands shared by panels, keyboard shortcuts, paste and drag & drop. */
import { createScreenshotSlot, LIMITS, uid } from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { notify } from '../store/toasts';
import { ImportError, readImageFile } from './assets';
import { describeStorageError, putBlob, requestPersistence } from './db';

export function imageFilesFrom(list: FileList | File[] | null | undefined): File[] {
  return [...(list ?? [])].filter((f) => f.type.startsWith('image/'));
}

export async function importImages(files: File[], target: 'screenshot' | 'logo'): Promise<void> {
  const ed = useEditor.getState;
  const project = ed().project;
  if (!project) return;
  for (const file of target === 'logo' ? files.slice(0, 1) : files) {
    if (target === 'screenshot' && (ed().project?.screenshots.length ?? 0) >= LIMITS.screenshots) {
      notify(`A project holds up to ${LIMITS.screenshots} screenshots.`, 'error');
      break;
    }
    try {
      const { asset, blob } = await readImageFile(file, file.name || 'pasted image');
      await putBlob(project.id, asset.id, blob);
      ed().addUrl(asset.id, URL.createObjectURL(blob));
      const slot = createScreenshotSlot(asset.id);
      ed().update((d) => {
        d.assets.push(asset);
        if (target === 'logo') d.brand.logoAssetId = asset.id;
        else d.screenshots.push(slot);
      });
      if (target === 'screenshot') ed().selectShot(slot.id);
      // The user now has content worth keeping: ask the browser not to evict it.
      void requestPersistence();
    } catch (e) {
      notify(e instanceof ImportError ? e.message : describeStorageError(e), 'error');
    }
  }
}

/** Drop assets that are no longer used by any slot or the logo. */
function pruneAssets(d: { assets: { id: string }[]; screenshots: { assetId: string }[]; brand: { logoAssetId: string | null } }) {
  const used = new Set([...d.screenshots.map((s) => s.assetId), d.brand.logoAssetId]);
  d.assets = d.assets.filter((a) => used.has(a.id));
}

export function removeScreenshot(id: string) {
  const ed = useEditor.getState();
  const list = ed.project?.screenshots ?? [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return;
  ed.update((d) => {
    d.screenshots = d.screenshots.filter((s) => s.id !== id);
    pruneAssets(d);
  });
  const rest = list.filter((s) => s.id !== id);
  ed.selectShot(rest[Math.min(idx, rest.length - 1)]?.id ?? null);
}

export function duplicateScreenshot(id: string) {
  const ed = useEditor.getState();
  const src = ed.project?.screenshots.find((s) => s.id === id);
  if (!src) return;
  if ((ed.project?.screenshots.length ?? 0) >= LIMITS.screenshots) {
    notify(`A project holds up to ${LIMITS.screenshots} screenshots.`, 'error');
    return;
  }
  const copy = { ...src, id: uid('shot') };
  ed.update((d) => {
    d.screenshots.splice(d.screenshots.findIndex((s) => s.id === id) + 1, 0, copy);
  });
  ed.selectShot(copy.id);
}

export function moveScreenshot(id: string, delta: -1 | 1) {
  useEditor.getState().update((d) => {
    const i = d.screenshots.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= d.screenshots.length) return;
    [d.screenshots[i], d.screenshots[j]] = [d.screenshots[j], d.screenshots[i]];
  });
}

export function removeLogo() {
  useEditor.getState().update((d) => {
    d.brand.logoAssetId = null;
    pruneAssets(d);
  });
}
