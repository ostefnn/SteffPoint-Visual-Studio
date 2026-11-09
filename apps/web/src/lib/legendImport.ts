/**
 * Turn a capture report (legend .md + its screenshots) into an Annotated Panel project:
 * one screenshot per section, captioned with the section title and carrying its legend.
 * The carousel then reads as a guide: a title page, then one annotated page per section.
 */
import { createProject, createScreenshotSlot, LIMITS, parseLegendMarkdown, type Project } from '@svs/visual-core';
import { ImportError, readImageFile } from './assets';
import { createProjectRecord, putBlob, requestPersistence } from './db';

export interface LegendImportResult {
  project: Project;
  /** Images named in the legend but not among the selected files. */
  missing: string[];
  /** Sections left out because the project is full. */
  skipped: number;
}

const MAX_LEGEND_BYTES = 1024 * 1024;
const isMarkdown = (f: File) => /\.(md|markdown)$/i.test(f.name) || f.type === 'text/markdown';
const baseName = (path: string) => path.split(/[\\/]/).pop()!.trim().toLowerCase();

export async function importLegendBundle(files: File[]): Promise<LegendImportResult> {
  const md = files.find(isMarkdown);
  if (!md) throw new ImportError('Select the legend file (.md) together with its images.');
  if (md.size > MAX_LEGEND_BYTES) throw new ImportError(`${md.name}: the legend file is too large.`);
  const doc = parseLegendMarkdown(await md.text());
  if (!doc.groups.length) {
    throw new ImportError(`${md.name}: no section like “## Group (image.png)” followed by a field table was found.`);
  }

  const images = new Map(files.filter((f) => f.type.startsWith('image/')).map((f) => [baseName(f.name), f]));
  const groups = doc.groups.slice(0, LIMITS.screenshots);
  const found = groups.filter((g) => images.has(baseName(g.file)));
  if (!found.length) {
    throw new ImportError(`None of the images named in ${md.name} were selected (for example ${groups[0].file}). Select them with the .md file.`);
  }

  const title = doc.title || md.name.replace(/\.(md|markdown)$/i, '');
  const project = createProject({ template: 'annotated', name: title.slice(0, LIMITS.name) });
  const meta = (re: RegExp) => doc.meta.find((m) => re.test(m.key))?.value;
  const version = meta(/^version$/i);
  const platform = meta(/^spfx$/i);
  project.content = {
    ...project.content,
    title: title.slice(0, LIMITS.title),
    // Facts from the report only: nothing invented.
    subtitle: [version && `Version ${version}`, platform && `SPFx ${platform}`].filter(Boolean).join(', ').slice(0, LIMITS.subtitle),
    features: [],
  };
  // Portrait pages suit tall settings panels best.
  project.exportPresets = ['linkedin-carousel', 'story', 'square', 'linkedin'];

  for (const group of found) {
    const file = images.get(baseName(group.file))!;
    const { asset, blob } = await readImageFile(file, file.name);
    await putBlob(project.id, asset.id, blob);
    project.assets.push(asset);
    project.screenshots.push({
      ...createScreenshotSlot(asset.id),
      fit: 'contain',
      caption: group.heading.slice(0, LIMITS.caption),
      legend: group.items,
    });
  }

  await createProjectRecord(project);
  void requestPersistence();
  return {
    project,
    missing: groups.filter((g) => !images.has(baseName(g.file))).map((g) => g.file),
    skipped: doc.groups.length - groups.length,
  };
}
