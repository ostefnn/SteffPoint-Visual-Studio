/** Image import: validation, dimension probing and blob URL bookkeeping. */
import { ACCEPTED_IMAGE_TYPES, LIMITS, uid, type AssetRef } from '@svs/visual-core';

export class ImportError extends Error {}

export async function readImageFile(file: File | Blob, name = 'image'): Promise<{ asset: AssetRef; blob: Blob }> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ImportError(`${name}: unsupported format. Use PNG, JPEG, WebP or GIF.`);
  }
  if (file.size > LIMITS.fileBytes) {
    throw new ImportError(`${name}: larger than ${LIMITS.fileBytes / 1024 / 1024} MB.`);
  }
  // Decoding proves the file is a real, well-formed image.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImportError(`${name}: the file could not be decoded as an image.`);
  }
  const asset: AssetRef = {
    id: uid('ast'),
    name: (file instanceof File ? file.name : name).slice(0, 120),
    mime: file.type,
    width: bitmap.width,
    height: bitmap.height,
    size: file.size,
  };
  bitmap.close();
  return { asset, blob: file };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(dataUrl)) throw new ImportError('Embedded asset is not a supported image.');
  return (await fetch(dataUrl)).blob();
}
