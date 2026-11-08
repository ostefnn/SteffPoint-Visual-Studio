/**
 * LinkedIn carousel export: every slide is rendered like a normal image export,
 * then assembled into one PDF in the browser. pdf-lib is loaded only when needed.
 */
import { buildCarouselSlides, CAROUSEL_FORMAT, resolveFormat, type Project } from '@svs/visual-core';
import { renderToBlob } from './exporter';
import { slugify } from './download';

export async function exportCarouselPdf(
  project: Project,
  urls: Record<string, string>,
  opts: { scale: number; quality: number },
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; filename: string; pages: number }> {
  const slides = buildCarouselSlides(project);
  const total = slides.length + 1; // + assembling the PDF
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const f = resolveFormat(CAROUSEL_FORMAT);

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i, total);
    // JPEG keeps the PDF small; LinkedIn re-encodes pages anyway.
    const jpeg = await renderToBlob(slides[i].project, urls, CAROUSEL_FORMAT, { scale: opts.scale, type: 'jpeg', quality: opts.quality });
    const image = await pdf.embedJpg(await jpeg.arrayBuffer());
    // One PDF unit per CSS pixel: LinkedIn only cares about the aspect ratio.
    const page = pdf.addPage([f.width, f.height]);
    page.drawImage(image, { x: 0, y: 0, width: f.width, height: f.height });
  }

  onProgress?.(slides.length, total);
  pdf.setTitle(project.content.title.trim() || project.name);
  pdf.setSubject(project.content.subtitle.trim());
  pdf.setCreator('SteffPoint Visual Studio');
  pdf.setProducer('SteffPoint Visual Studio');
  pdf.setCreationDate(new Date());
  const bytes = await pdf.save();
  onProgress?.(total, total);
  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    filename: `${slugify(project.name)}-linkedin-carousel.pdf`,
    pages: slides.length,
  };
}
