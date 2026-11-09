/**
 * LinkedIn carousel ("document" post): a sequence of 4:5 pages exported as one PDF.
 *
 * Every page is a Variant of the project (its own template, optional text and screenshot
 * selection; brand, background and images shared). When the user has not customised the
 * carousel, pages are generated automatically:
 *   1. cover    – the project as designed
 *   2. one page per screenshot – spotlighted (or a phone for portrait images), titled with its caption
 *   3. features – when the project has a feature list and the cover is not already Features
 * An Annotated Panel project is a guide instead: a title cover, then one annotated page per screenshot.
 */
import type { FormatId } from './formats';
import {
  applyVariant,
  CAROUSEL_MAX_SLIDES,
  createVariant,
  screenshotRange,
  type Project,
  type Variant,
} from './project';
import type { Suggestion } from './rules';
import { getTemplate, type TemplateId } from './templates';

export const CAROUSEL_FORMAT: FormatId = 'linkedin-carousel';

export interface CarouselSlide {
  /** True when the page comes from the automatic plan (not user-customised). */
  auto: boolean;
  label: string;
  variant: Variant;
  /** The project as rendered on this page, page number included. */
  project: Project;
}

/** Automatic pages, as editable variants. Used as-is in auto mode and as the starting point when customising. */
export function autoCarouselVariants(project: Project): Variant[] {
  const assets = new Map(project.assets.map((a) => [a.id, a]));
  if (project.template === 'annotated') {
    const pages = project.screenshots.map((shot) =>
      createVariant({ template: 'annotated', screenshotIds: [shot.id], content: { title: shot.caption.trim(), subtitle: '' } }),
    );
    // The first page would repeat the first group: open on a title page instead.
    return [createVariant({ template: 'minimal', screenshotIds: [] }), ...pages].slice(0, CAROUSEL_MAX_SLIDES);
  }
  const out: Variant[] = [createVariant({ template: project.template, screenshotIds: null })];
  for (const shot of project.screenshots) {
    const asset = assets.get(shot.assetId);
    const isPhone = !!asset && asset.height > asset.width * 1.2;
    out.push(
      createVariant({
        template: isPhone ? 'mobile-trio' : 'spotlight',
        screenshotIds: [shot.id],
        content: { title: shot.caption.trim(), subtitle: '' },
      }),
    );
  }
  if (project.content.features.some((f) => f.trim()) && project.template !== 'features') {
    out.push(createVariant({ template: 'features', screenshotIds: [] }));
  }
  return out.slice(0, CAROUSEL_MAX_SLIDES);
}

export function isCarouselCustom(project: Project): boolean {
  return project.carousel.slides.length > 0;
}

export function carouselVariants(project: Project): Variant[] {
  return isCarouselCustom(project) ? project.carousel.slides.slice(0, CAROUSEL_MAX_SLIDES) : autoCarouselVariants(project);
}

function slideLabel(project: Project, v: Variant): string {
  const resolved = applyVariant(project, v);
  const title = resolved.content.title.trim();
  if (title) return title;
  const caption = resolved.screenshots[0]?.caption.trim();
  return caption || getTemplate(v.template).name;
}

export function buildCarouselSlides(project: Project): CarouselSlide[] {
  const auto = !isCarouselCustom(project);
  const variants = carouselVariants(project);
  const total = variants.length;
  return variants.map((v, i) => {
    const page = applyVariant(project, v);
    const numbered = project.carousel.pageNumbers && i > 0 && v.content.kicker === undefined;
    return {
      auto,
      label: slideLabel(project, v),
      variant: v,
      project: numbered ? { ...page, content: { ...page.content, kicker: `${i + 1} / ${total}` } } : page,
    };
  });
}

/** Templates that read as a closing / call-to-action page. */
const CLOSING_TEMPLATES: TemplateId[] = ['minimal', 'event'];

/** Deterministic advice for the carousel as a whole. Informative only. */
export function analyzeCarousel(project: Project): Suggestion[] {
  const out: Suggestion[] = [];
  const slides = buildCarouselSlides(project);
  if (slides.length < 3) {
    out.push({ id: 'carousel-short', level: 'info', message: 'Carousels with 3 to 12 pages tend to perform best.' });
  }
  slides.forEach((s, i) => {
    const { min } = screenshotRange({ template: s.variant.template, devices: project.devices });
    if (s.project.screenshots.length < min) {
      out.push({
        id: `carousel-shots-${i}`,
        level: 'warning',
        message: `Page ${i + 1}: ${getTemplate(s.variant.template).name} needs at least ${min} screenshot${min > 1 ? 's' : ''}.`,
      });
    }
    if (s.project.content.title.trim().length > 60) {
      out.push({ id: `carousel-title-${i}`, level: 'info', message: `Page ${i + 1}: the title is long for a carousel page. Aim for 60 characters or fewer.` });
    }
  });
  const last = slides[slides.length - 1];
  if (slides.length >= 3 && last && !CLOSING_TEMPLATES.includes(last.variant.template)) {
    out.push({
      id: 'carousel-cta',
      level: 'info',
      message: 'End with a call to action, for example a Minimal or Event page with your link.',
    });
  }
  return out;
}
