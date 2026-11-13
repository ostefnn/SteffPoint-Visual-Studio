/** Editor commands shared by panels, keyboard shortcuts, paste and drag & drop. */
import { createScreenshotSlot, LIMITS, pickBrandColor, STYLES, uid, type StyleId } from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { notify } from '../store/toasts';
import { ImportError, readImageFile } from './assets';
import { describeStorageError, putBlob, requestPersistence } from './db';
import { addPreviews } from './previews';
import { sampleLogoColors } from './logoColors';
import { t } from '../i18n';

export function imageFilesFrom(list: FileList | File[] | null | undefined): File[] {
  return [...(list ?? [])].filter((f) => f.type.startsWith('image/'));
}

export async function importImages(files: File[], target: 'screenshot' | 'logo' | 'background'): Promise<void> {
  const ed = useEditor.getState;
  const project = ed().project;
  if (!project) return;
  for (const file of target === 'screenshot' ? files : files.slice(0, 1)) {
    if (target === 'screenshot' && (ed().project?.screenshots.length ?? 0) >= LIMITS.screenshots) {
      notify(t('A project holds up to {n} screenshots.', { n: LIMITS.screenshots }), 'error');
      break;
    }
    try {
      const { asset, blob } = await readImageFile(file, file.name || 'pasted image');
      await putBlob(project.id, asset.id, blob);
      ed().addUrl(asset.id, URL.createObjectURL(blob));
      void addPreviews([{ id: asset.id, blob }]);
      const slot = createScreenshotSlot(asset.id);
      // A new logo dresses the project in its colour, in the same undo step as the import.
      const brandColor = target === 'logo' ? pickBrandColor(await sampleLogoColors(blob).catch(() => [])) : null;
      const previous = ed().project?.brand.primary;
      ed().update((d) => {
        d.assets.push(asset);
        if (target === 'logo') {
          d.brand.logoAssetId = asset.id;
          if (brandColor) d.brand.primary = brandColor;
        } else if (target === 'background') {
          // A first photo starts mostly veiled, so the title stays readable.
          if (d.background.type !== 'image') d.background.intensity = 0.3;
          d.background.imageAssetId = asset.id;
          d.background.type = 'image';
          pruneAssets(d); // the previous background photo, if any
        } else d.screenshots.push(slot);
      });
      if (target === 'screenshot') ed().selectShot(slot.id);
      if (brandColor && previous && brandColor !== previous) {
        // Undo here restores only the colour and keeps the logo, whatever was edited since.
        notify(t('Brand colour set to {c} from the logo.', { c: brandColor }), 'info', {
          label: t('Undo'),
          run: () => {
            if (ed().project?.brand.primary === brandColor) ed().update((d) => void (d.brand.primary = previous));
          },
        });
      }
      // The user now has content worth keeping: ask the browser not to evict it.
      void requestPersistence();
    } catch (e) {
      notify(e instanceof ImportError ? e.message : describeStorageError(e), 'error');
    }
  }
}

/** Drop assets that are no longer used by any slot, the logo or the background. */
function pruneAssets(d: {
  assets: { id: string }[];
  screenshots: { assetId: string }[];
  brand: { logoAssetId: string | null };
  background: { imageAssetId: string | null };
}) {
  const used = new Set([...d.screenshots.map((s) => s.assetId), d.brand.logoAssetId, d.background.imageAssetId]);
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
    notify(t('A project holds up to {n} screenshots.', { n: LIMITS.screenshots }), 'error');
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

export function removeBackgroundImage() {
  useEditor.getState().update((d) => {
    d.background.imageAssetId = null;
    if (d.background.type === 'image') d.background.type = 'solid';
    pruneAssets(d);
  });
}

export function removeLogo() {
  useEditor.getState().update((d) => {
    d.brand.logoAssetId = null;
    pruneAssets(d);
  });
}

/** Pick a style: it brings its own background and screenshot frame; both stay editable afterwards. */
export function applyStyle(id: StyleId) {
  useEditor.getState().update((d) => {
    if (d.brand.style === id) return;
    d.brand.style = id;
    // A chosen photo stays: the style's own ground would silently replace it.
    if (!(d.background.type === 'image' && d.background.imageAssetId)) d.background.type = STYLES[id].defaults.background;
    d.desktopFrame = STYLES[id].defaults.desktopFrame;
  });
}
