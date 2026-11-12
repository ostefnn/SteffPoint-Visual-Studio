/** Canvas side of dominant colour sampling: decode a logo, downscale it, read its pixels. */
import { extractLogoColors, type LogoColor } from '@svs/visual-core';

/** Logos are downscaled to at most this many pixels per side: plenty for colour, and fast. */
const SAMPLE_SIZE = 96;

export async function sampleLogoColors(source: Blob, max = 5): Promise<LogoColor[]> {
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, SAMPLE_SIZE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(bitmap, 0, 0, w, h);
    return extractLogoColors(ctx.getImageData(0, 0, w, h).data, max);
  } finally {
    bitmap.close();
  }
}

/** Same, from an object URL already held by the editor. Never throws: no colours on failure. */
export async function sampleLogoColorsFromUrl(url: string, max = 5): Promise<LogoColor[]> {
  try {
    return await sampleLogoColors(await (await fetch(url)).blob(), max);
  } catch {
    return [];
  }
}
