/**
 * Client side image export. The composition is rendered off screen at its native
 * size and rasterised with modern-screenshot. No network involved.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { domToBlob } from 'modern-screenshot';
import { BUNDLED_FONT_FACES, resolveFormat, type FormatId, type Project } from '@svs/visual-core';
import { Composition } from '../render/Composition';
import { buildProjectFile } from './projectFile';
import { slugify } from './download';
import { flattenShadows } from './flattenShadows';

/** Safari and every iOS browser (all WebKit): their exports need flattened shadows (see flattenShadows). */
const IS_WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/(Chrome|Chromium|Edg)\//.test(navigator.userAgent);

export type ImageType = 'png' | 'jpeg' | 'webp';

export const MIME: Record<ImageType, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

let fontsLoaded: Promise<unknown> | null = null;
/** Load the bundled faces once, so the first export never rasterises a fallback font. */
function loadBundledFonts() {
  fontsLoaded ??= Promise.all(BUNDLED_FONT_FACES.map((f) => document.fonts?.load(f).catch(() => undefined)));
  return fontsLoaded;
}

async function waitForImages(node: HTMLElement) {
  await loadBundledFonts();
  await Promise.all([...node.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)));
  await document.fonts?.ready;
}

/** Render one format of a project to an image Blob. */
export async function renderToBlob(
  project: Project,
  urls: Record<string, string>,
  formatId: FormatId,
  opts: { scale: number; type: ImageType; quality?: number; targetWidth?: number; flattenShadows?: boolean },
): Promise<Blob> {
  const f = resolveFormat(formatId, project.customFormat);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;contain:strict;width:0;height:0;overflow:visible;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(Composition, { project, width: f.width, height: f.height, urls, content: f.content })));
    const node = host.firstElementChild as HTMLElement;
    await waitForImages(node);
    if (opts.flattenShadows ?? IS_WEBKIT) flattenShadows(node);
    const scale = opts.targetWidth ? opts.targetWidth / f.width : opts.scale;
    const blob = await domToBlob(node, {
      scale,
      width: f.width,
      height: f.height,
      type: MIME[opts.type],
      quality: opts.quality ?? 0.92,
    });
    if (!blob) throw new Error(`Rendering ${f.label} failed.`);
    return blob;
  } finally {
    root.unmount();
    host.remove();
  }
}

export function renderThumbnail(project: Project, urls: Record<string, string>): Promise<Blob> {
  return renderToBlob(project, urls, project.exportPresets[0] ?? 'linkedin', {
    scale: 1,
    type: 'jpeg',
    quality: 0.8,
    targetWidth: 480,
  });
}

/** Build a ZIP containing every selected format and, optionally, the project file. */
export async function exportPack(
  project: Project,
  urls: Record<string, string>,
  formats: FormatId[],
  opts: { scale: number; type: ImageType; quality: number; includeProject: boolean },
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const base = slugify(project.name);
  const ext = opts.type === 'jpeg' ? 'jpg' : opts.type;
  const suffix = opts.scale > 1 ? `@${opts.scale}x` : '';

  // A single image is downloaded directly, without a ZIP.
  if (formats.length === 1 && !opts.includeProject) {
    onProgress?.(0, 1);
    const blob = await renderToBlob(project, urls, formats[0], opts);
    onProgress?.(1, 1);
    return { blob, filename: `${base}-${formats[0]}${suffix}.${ext}` };
  }

  // Loaded on first export only.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const total = formats.length + (opts.includeProject ? 1 : 0);
  let done = 0;
  for (const id of formats) {
    onProgress?.(done, total);
    zip.file(`${id}${suffix}.${ext}`, await renderToBlob(project, urls, id, opts));
    done++;
  }
  if (opts.includeProject) {
    zip.file('project.json', await buildProjectFile(project));
    done++;
  }
  onProgress?.(done, total);
  return { blob: await zip.generateAsync({ type: 'blob' }), filename: `${base}.zip` };
}
