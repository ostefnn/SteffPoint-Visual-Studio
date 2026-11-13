/** Brand kit commands: save the current identity, apply a kit to a project. */
import { applyBrandKit, brandKitFromProject, type BrandKit, type Project } from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { notify } from '../store/toasts';
import { readImageFile } from './assets';
import { describeStorageError, getBlob, getKitLogo, putBlob, putBrandKit } from './db';
import { t } from '../i18n';

/** Kit chosen on the dashboard for new projects (a per-browser preference). */
const DEFAULT_KIT_KEY = 'svs-default-brand-kit';

export function getDefaultKitId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_KIT_KEY);
  } catch {
    return null;
  }
}

export function setDefaultKitId(id: string | null): void {
  try {
    if (id) localStorage.setItem(DEFAULT_KIT_KEY, id);
    else localStorage.removeItem(DEFAULT_KIT_KEY);
  } catch {
    // Storage blocked: the choice simply is not remembered.
  }
}

/** Save the open project's identity as a kit (a new one, or replacing `replace`). */
export async function saveKitFromEditor(name: string, replace?: BrandKit): Promise<BrandKit | null> {
  const project = useEditor.getState().project;
  if (!project) return null;
  try {
    const kit = brandKitFromProject(project, name, replace?.id);
    const logo = project.brand.logoAssetId ? ((await getBlob(project.id, project.brand.logoAssetId)) ?? null) : null;
    await putBrandKit(kit, logo);
    notify(replace ? t('Brand kit “{name}” updated.', { name: kit.name }) : t('Saved brand kit “{name}”.', { name: kit.name }), 'info');
    return kit;
  } catch (e) {
    notify(describeStorageError(e), 'error');
    return null;
  }
}

/** Copy the kit's logo into a project's own files; returns its asset, or null when the kit has none. */
async function storeKitLogo(projectId: string, kit: BrandKit) {
  if (!kit.logo) return null;
  const blob = await getKitLogo(kit.id);
  if (!blob) return null;
  const { asset } = await readImageFile(blob, kit.logo.name);
  await putBlob(projectId, asset.id, blob);
  return { asset, blob };
}

/** A new project, before it is first saved, dressed in the kit. */
export async function withBrandKit(project: Project, kit: BrandKit): Promise<Project> {
  const logo = await storeKitLogo(project.id, kit).catch(() => null);
  return applyBrandKit(project, kit, logo?.asset ?? null);
}

/** Apply a kit to the open project, in one undo step. */
export async function applyKitInEditor(kit: BrandKit): Promise<void> {
  const ed = useEditor.getState;
  const project = ed().project;
  if (!project) return;
  try {
    const logo = await storeKitLogo(project.id, kit);
    if (logo) ed().addUrl(logo.asset.id, URL.createObjectURL(logo.blob));
    ed().update((d) => {
      const next = applyBrandKit(d, kit, logo?.asset ?? null);
      Object.assign(d, { assets: next.assets, brand: next.brand, background: next.background, desktopFrame: next.desktopFrame, content: next.content });
    });
    notify(t('Applied brand kit “{name}”.', { name: kit.name }), 'info');
  } catch (e) {
    notify(describeStorageError(e), 'error');
  }
}
