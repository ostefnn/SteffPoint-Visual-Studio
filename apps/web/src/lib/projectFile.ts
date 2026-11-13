/** Portable project file: project JSON plus embedded images as data URLs. */
import { migrateProject, uid, type Project } from '@svs/visual-core';
import { blobToDataUrl, dataUrlToBlob, ImportError } from './assets';
import { createProjectRecord, getBlob, putBlob } from './db';
import { t } from '../i18n';

export const PROJECT_FILE_FORMAT = 'steffpoint-visual-studio/project';
const MAX_IMPORT_BYTES = 150 * 1024 * 1024;

interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  schemaVersion: string;
  exportedAt: string;
  project: Project;
  assets: Record<string, string>;
}

export async function buildProjectFile(project: Project): Promise<Blob> {
  const assets: Record<string, string> = {};
  for (const a of project.assets) {
    const blob = await getBlob(project.id, a.id);
    if (blob) assets[a.id] = await blobToDataUrl(blob);
  }
  const file: ProjectFile = {
    format: PROJECT_FILE_FORMAT,
    schemaVersion: project.schemaVersion,
    exportedAt: new Date().toISOString(),
    project,
    assets,
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

/** Import a project file as a brand new project (new id, so nothing is overwritten). */
export async function importProjectFile(file: File): Promise<Project> {
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError(t('Project file is too large.'));
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new ImportError(t('This file is not valid JSON.'));
  }
  const r = (raw ?? {}) as Partial<ProjectFile>;
  // Accept both our wrapper format and a bare project object.
  const isWrapped = r.format === PROJECT_FILE_FORMAT;
  const project = migrateProject(isWrapped ? r.project : raw);
  project.id = uid('prj');
  project.updatedAt = Date.now();

  const embedded = isWrapped && r.assets && typeof r.assets === 'object' ? r.assets : {};
  const available = new Set<string>();
  for (const a of project.assets) {
    const data = embedded[a.id];
    if (typeof data !== 'string') continue;
    await putBlob(project.id, a.id, await dataUrlToBlob(data));
    available.add(a.id);
  }
  // Drop references to images that were not embedded.
  project.assets = project.assets.filter((a) => available.has(a.id));
  project.screenshots = project.screenshots.filter((s) => available.has(s.assetId));
  if (project.brand.logoAssetId && !available.has(project.brand.logoAssetId)) project.brand.logoAssetId = null;

  await createProjectRecord(project);
  return project;
}
