/**
 * LinkedIn carousel ("document" post): a sequence of 4:5 pages exported as one PDF.
 *
 * Every page is a Variant of the project (its own template, optional text and screenshot
 * selection; brand, background and images shared). When the user has not customised the
 * carousel, pages are generated automatically, following the project's plan:
 *   launch   – cover, one page per screenshot (spotlighted, or a phone for portrait images), features
 *   tutorial – cover, steps, one Detail Zoom page per screenshot
 *   release  – cover, features, Before / After of the first two screenshots, one page per other screenshot
 * Screenshot pages are titled with their caption. Features and Steps pages are added only once
 * they hold real content, and never twice when the cover already uses that template. Every plan
 * ends with a Call to Action page once the project has a link.
 * An Annotated Panel project is a guide instead: a title cover, then one annotated page per screenshot.
 */
import type { FormatId } from './formats';
import { hasRealFeatures, hasRealSteps } from './placeholders';
import {
  applyVariant,
  CAROUSEL_MAX_SLIDES,
  createVariant,
  type CarouselPlan,
  screenshotRange,
  type CarouselPageSize,
  type Project,
  type ScreenshotSlot,
  type Variant,
} from './project';
import { msg, type Suggestion } from './rules';
import { getTemplate, type TemplateId } from './templates';

/** Default page format (4:5). Use `carouselFormat(project)` for the project's chosen page size. */
export const CAROUSEL_FORMAT: FormatId = 'linkedin-carousel';

/** Each page size maps to an existing preset, so pages render exactly like that format. */
const PAGE_FORMATS: Record<CarouselPageSize, FormatId> = { '4:5': 'linkedin-carousel', '1:1': 'square', '16:9': 'thumbnail' };

export function carouselFormat(project: Pick<Project, 'carousel'>): FormatId {
  return PAGE_FORMATS[project.carousel.pageSize] ?? CAROUSEL_FORMAT;
}

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
  if (project.template === 'annotated') {
    const pages = project.screenshots.map((shot) =>
      createVariant({ template: 'annotated', screenshotIds: [shot.id], content: { title: shot.caption.trim(), subtitle: '' } }),
    );
    // The first page would repeat the first group: open on a title page instead.
    return [createVariant({ template: 'minimal', screenshotIds: [] }), ...pages].slice(0, CAROUSEL_MAX_SLIDES);
  }
  const assets = new Map(project.assets.map((a) => [a.id, a]));
  const shotPage = (shot: ScreenshotSlot, template?: TemplateId): Variant => {
    const asset = assets.get(shot.assetId);
    const isPhone = !!asset && asset.height > asset.width * 1.2;
    return createVariant({
      template: template ?? (isPhone ? 'mobile-trio' : 'spotlight'),
      screenshotIds: [shot.id],
      content: { title: shot.caption.trim(), subtitle: '' },
    });
  };
  // Example features and steps are not content: their page is added only once one is real.
  const page = (template: 'features' | 'steps'): Variant[] => {
    const real = template === 'features' ? hasRealFeatures(project.content) : hasRealSteps(project.content);
    return real && project.template !== template ? [createVariant({ template, screenshotIds: [] })] : [];
  };
  const shots = project.screenshots;
  const middle: Record<CarouselPlan, () => Variant[]> = {
    launch: () => [...shots.map((s) => shotPage(s)), ...page('features')],
    tutorial: () => [...page('steps'), ...shots.map((s) => shotPage(s, 'detail-zoom'))],
    release: () => {
      if (shots.length < 2 || project.template === 'before-after') return [...page('features'), ...shots.map((s) => shotPage(s))];
      const [before, after, ...rest] = shots;
      const pair = createVariant({ template: 'before-after', screenshotIds: [before.id, after.id] });
      return [...page('features'), pair, ...rest.map((s) => shotPage(s))];
    },
  };
  const closing = project.content.link.trim() && project.template !== 'cta' ? [createVariant({ template: 'cta', screenshotIds: [] })] : [];
  const body = [createVariant({ template: project.template, screenshotIds: null }), ...(middle[project.carousel.plan] ?? middle.launch)()];
  // The closing page is kept even when the plan is longer than the cap.
  return [...body.slice(0, CAROUSEL_MAX_SLIDES - closing.length), ...closing];
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
      project: {
        ...(numbered ? { ...page, content: { ...page.content, kicker: `${i + 1} / ${total}` } } : page),
        carouselPage: { index: i, total },
      },
    };
  });
}

/** Templates that read as a closing / call-to-action page. */
const CLOSING_TEMPLATES: TemplateId[] = ['cta', 'minimal', 'event'];

/** Deterministic advice for the carousel as a whole. Informative only. */
export function analyzeCarousel(project: Project): Suggestion[] {
  const out: Suggestion[] = [];
  const slides = buildCarouselSlides(project);
  if (project.carousel.pageSize === '16:9') {
    out.push({
      id: 'carousel-wide',
      level: 'info',
      ...msg('16:9 pages are much smaller in the LinkedIn feed on phones. Prefer 4:5 unless you reuse a presentation.'),
    });
  }
  if (slides.length < 3) {
    out.push({ id: 'carousel-short', level: 'info', ...msg('Carousels with 3 to 12 pages tend to perform best.') });
  }
  slides.forEach((s, i) => {
    const { min } = screenshotRange({ template: s.variant.template, devices: project.devices });
    if (s.project.screenshots.length < min) {
      out.push({
        id: `carousel-shots-${i}`,
        level: 'warning',
        ...(min > 1 ? msg('Page {page}: {template} needs at least {n} screenshots.', { page: i + 1, template: getTemplate(s.variant.template).name, n: min }) : msg('Page {page}: {template} needs a screenshot.', { page: i + 1, template: getTemplate(s.variant.template).name })),
      });
    }
    if (s.project.content.title.trim().length > 60) {
      out.push({ id: `carousel-title-${i}`, level: 'info', ...msg('Page {page}: the title is long for a carousel page. Aim for 60 characters or fewer.', { page: i + 1 }) });
    }
  });
  const last = slides[slides.length - 1];
  if (slides.length >= 3 && last && !CLOSING_TEMPLATES.includes(last.variant.template)) {
    out.push({
      id: 'carousel-cta',
      level: 'info',
      // Automatic pages end with a Call to Action page as soon as there is a link to point to.
      ...(isCarouselCustom(project) || project.template === 'cta'
        ? msg('End with a call to action: add a Call to Action page with your link.')
        : msg('End with a call to action: add a closing page link above and the automatic pages end with a Call to Action page.')),
    });
  }
  return out;
}
