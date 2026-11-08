/**
 * LinkedIn carousel ("document" post): a sequence of 4:5 slides exported as one PDF.
 * Slides are derived from the project, so there is nothing extra to maintain:
 *   1. cover   – the project as designed (its own template)
 *   2. one slide per screenshot – spotlighted, titled with the screenshot caption
 *   3. features – when the project has a feature list and the cover is not already the Features template
 */
import type { FormatId } from './formats';
import type { Project } from './project';
import type { TemplateId } from './templates';

export const CAROUSEL_FORMAT: FormatId = 'linkedin-carousel';
/** Keeps PDFs light and readable in the feed; LinkedIn itself accepts far more pages. */
export const CAROUSEL_MAX_SLIDES = 10;

export type CarouselSlideKind = 'cover' | 'screenshot' | 'features';

export interface CarouselSlide {
  kind: CarouselSlideKind;
  label: string;
  project: Project;
}

export function buildCarouselSlides(project: Project): CarouselSlide[] {
  const assets = new Map(project.assets.map((a) => [a.id, a]));
  const plan: { kind: CarouselSlideKind; label: string; make: (counter: string) => Project }[] = [];

  plan.push({ kind: 'cover', label: 'Cover', make: () => project });

  project.screenshots.forEach((shot, i) => {
    const asset = assets.get(shot.assetId);
    const isPhone = !!asset && asset.height > asset.width * 1.2;
    const template: TemplateId = isPhone ? 'mobile-trio' : 'spotlight';
    plan.push({
      kind: 'screenshot',
      label: shot.caption.trim() || `Screenshot ${i + 1}`,
      make: (counter) => ({
        ...project,
        template,
        screenshots: [shot],
        content: { ...project.content, kicker: counter, title: shot.caption.trim(), subtitle: '' },
      }),
    });
  });

  const features = project.content.features.filter((f) => f.trim());
  if (features.length && project.template !== 'features') {
    plan.push({
      kind: 'features',
      label: 'Features',
      make: (counter) => ({ ...project, template: 'features', screenshots: [], content: { ...project.content, kicker: counter } }),
    });
  }

  const slides = plan.slice(0, CAROUSEL_MAX_SLIDES);
  const total = slides.length;
  return slides.map((s, i) => ({ kind: s.kind, label: s.label, project: s.make(`${i + 1} / ${total}`) }));
}
