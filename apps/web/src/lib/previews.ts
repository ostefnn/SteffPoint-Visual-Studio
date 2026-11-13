/**
 * Small copies of the project's images for everything that is not an export or the main preview:
 * the format strip, template and style pictures, carousel thumbnails and the dashboard thumbnail.
 *
 * Phones (iPhone above all) give a page little memory. Drawing a 2000 px photo in dozens of small
 * previews, and embedding it in the thumbnail rendered after each edit, can get the tab killed
 * ("A problem repeatedly occurred"). Previews are at most PREVIEW_MAX px on their longest side;
 * the main preview and every export keep using the original file.
 */
import { useEditor } from '../store/editor';

export const PREVIEW_MAX = 1024;

/** A smaller copy of the image, or null when it is already small enough (or cannot be read). */
export async function makePreview(blob: Blob, max = PREVIEW_MAX): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    const scale = max / Math.max(bitmap.width, bitmap.height);
    if (scale >= 1) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const g = canvas.getContext('2d');
    if (!g) return null;
    g.imageSmoothingQuality = 'high';
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // PNG keeps transparency (logos, cut-out screenshots).
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    // Safari keeps canvas memory until the canvas is shrunk.
    canvas.width = canvas.height = 0;
    return out;
  } finally {
    bitmap.close();
  }
}

/** Make the previews one after the other (one full-size decode at a time) and hand them to the editor. */
export async function addPreviews(items: { id: string; blob: Blob }[]): Promise<void> {
  for (const { id, blob } of items) {
    const small = await makePreview(blob).catch(() => null);
    if (small) useEditor.getState().addPreview(id, URL.createObjectURL(small));
  }
}
