/**
 * Deterministic "smart suggestions" and accessibility checks. No AI, no network.
 * Suggestions are informative only and never block an export.
 */
import { backgroundPeak, contrastRatio, derivePalette } from './color';
import { getOrientation, type FormatPreset } from './formats';
import type { Project } from './project';
import { DEVICE_LABELS, getTemplate, TEMPLATES, type TemplateId } from './templates';
import { logoHeight, subtitleSize } from './typography';
import { LIMITS, normalizeDevices, screenshotRange } from './project';

export type SuggestionLevel = 'info' | 'warning';

export interface Suggestion {
  id: string;
  level: SuggestionLevel;
  message: string;
  /** Optional one-click fix, e.g. switching template. */
  action?: { label: string; template?: TemplateId };
}

/** Width of the preview a social feed typically shows, used for the thumbnail legibility check. */
const FEED_THUMB_WIDTH = 500;
/** Fraction of the canvas width the main screenshot covers, roughly, across templates. */
const MAIN_SHOT_COVERAGE = 0.6;

export function analyzeProject(project: Project, format: FormatPreset, exportScale = 1): Suggestion[] {
  const out: Suggestion[] = [];
  const { content, brand } = project;
  const tpl = getTemplate(project.template);
  const orientation = getOrientation(format.width, format.height);
  const pal = derivePalette(brand.primary, brand.theme, brand.style);
  const assets = new Map(project.assets.map((a) => [a.id, a]));
  const shots = project.screenshots.map((s) => assets.get(s.assetId)).filter((a) => !!a);

  // --- Text -----------------------------------------------------------------
  const title = content.title.trim();
  if (tpl.slots.title && !title) out.push({ id: 'title-empty', level: 'warning', message: 'Add a title: it is the first thing people read.' });
  if (title.length > 60) {
    out.push({ id: 'title-long', level: 'warning', message: `Title is ${title.length} characters. Aim for 60 or fewer.` });
  } else if (orientation !== 'portrait' && format.height / format.width < 0.3 && title.length > 36) {
    out.push({ id: 'title-long-banner', level: 'info', message: 'Very wide formats read best with a title under 36 characters.' });
  }
  const lines = content.title.split('\n').length;
  if (lines > 3) out.push({ id: 'title-lines', level: 'warning', message: 'Title has more than 3 lines.' });
  if (content.subtitle.trim().length > 140) {
    out.push({ id: 'subtitle-long', level: 'info', message: 'Subtitle is long. Shorter subtitles stay legible on small previews.' });
  }

  // --- Contrast (WCAG AA) ----------------------------------------------------
  // Test against the most tinted part of the background (worst case).
  const peak = backgroundPeak(pal, brand.style === 'bold' ? 'solid' : project.background.type, project.background.intensity);
  const worst = (fg: string) => Math.min(contrastRatio(fg, pal.bg), contrastRatio(fg, peak));
  const titleContrast = worst(pal.text);
  if (titleContrast < 4.5) {
    out.push({ id: 'contrast-title', level: 'warning', message: `Title contrast is ${titleContrast.toFixed(1)}:1, below WCAG AA (4.5:1).` });
  }
  const mutedContrast = worst(pal.textMuted);
  if (mutedContrast < 4.5) {
    out.push({ id: 'contrast-subtitle', level: 'info', message: `Subtitle contrast is ${mutedContrast.toFixed(1)}:1, below WCAG AA (4.5:1).` });
  }

  // --- Thumbnail legibility --------------------------------------------------
  const u = Math.min(format.width, format.height) / 100;
  const subPxInFeed = subtitleSize(u, orientation) * (FEED_THUMB_WIDTH / format.width);
  if (tpl.slots.subtitle && content.subtitle.trim() && subPxInFeed < 8) {
    out.push({ id: 'thumb-legibility', level: 'info', message: 'The subtitle will be under 8px in a feed preview. Consider removing it for this format.' });
  }

  // --- Logo ------------------------------------------------------------------------
  const logo = brand.logoAssetId ? assets.get(brand.logoAssetId) : undefined;
  if (logo && logo.height > 0) {
    const needed = Math.ceil(logoHeight(u, brand.logoSize ?? 'medium') * exportScale);
    if (logo.height < needed) {
      out.push({
        id: 'logo-small',
        level: 'info',
        message: `The logo is ${logo.height}px tall but shown at about ${needed}px at this export size, so it may look blurry. Use a larger file.`,
      });
    }
  }

  // --- Screenshots -------------------------------------------------------------
  const { min, max } = screenshotRange(project);
  if (shots.length < min) {
    out.push({ id: 'shots-missing', level: 'warning', message: `${tpl.name} expects at least ${min} screenshot${min > 1 ? 's' : ''}.` });
  }
  if (max > 0 && shots.length > max) {
    out.push({ id: 'shots-extra', level: 'info', message: `${tpl.name} shows ${max} screenshot${max > 1 ? 's' : ''}; the others are kept but hidden.` });
  }

  const used = shots.slice(0, Math.max(max, 0));
  if (used.length) {
    const portraitShots = used.filter((a) => a.height > a.width * 1.2).length;
    const landscapeShots = used.filter((a) => a.width > a.height * 1.2).length;
    if (tpl.shotKind === 'desktop' && portraitShots === used.length) {
      out.push({
        id: 'tpl-orientation',
        level: 'info',
        message: 'Your screenshots look like mobile screens. A phone template will fit them better.',
        action: { label: 'Use Mobile Trio', template: 'mobile-trio' },
      });
    }
    if (tpl.shotKind === 'mobile' && landscapeShots === used.length) {
      out.push({
        id: 'tpl-orientation',
        level: 'info',
        message: 'Your screenshots look like desktop screens. A browser template will fit them better.',
        action: { label: 'Use Browser Hero', template: 'browser-hero' },
      });
    }

    const needed = format.width * MAIN_SHOT_COVERAGE * exportScale;
    const small = used.filter((a) => a.width > 0 && a.width < needed * (tpl.shotKind === 'mobile' ? 0.4 : 1));
    if (small.length) {
      out.push({ id: 'shot-small', level: 'info', message: `${small.length} screenshot${small.length > 1 ? 's are' : ' is'} small for this export size and may look blurry.` });
    }
  }

  // Device Mix: each screenshot goes into a fixed device; flag obvious mismatches.
  if (tpl.id === 'device-mix') {
    normalizeDevices(project.devices).forEach((device, i) => {
      const a = shots[i];
      if (!a) return;
      const portrait = a.height > a.width * 1.2;
      const landscape = a.width > a.height * 1.2;
      // Desktop windows and sideways devices are wide; upright devices are tall. Tablets are close to
      // square, so only the phone and the desktop window are checked.
      const wideFrame = device === 'desktop' || (device === 'mobile' && project.deviceOrientation?.mobile === 'landscape');
      if (device === 'tablet') return;
      if ((wideFrame && portrait) || (!wideFrame && landscape)) {
        out.push({
          id: `device-fit-${i}`,
          level: 'info',
          message: `Screenshot ${i + 1} is ${portrait ? 'portrait' : 'landscape'} but sits in a ${wideFrame ? 'wide' : 'tall'} ${DEVICE_LABELS[device].toLowerCase()} frame. Reorder screenshots${device === 'mobile' ? ' or rotate the phone' : ''}.`,
        });
      }
    });
  }

  if (max === 0 && project.screenshots.length > 0) {
    const better = TEMPLATES.find((t) => t.id === 'spotlight');
    if (better) {
      out.push({
        id: 'tpl-no-shots',
        level: 'info',
        message: 'This template does not show screenshots.',
        action: { label: `Use ${better.name}`, template: better.id },
      });
    }
  }

  // --- Template specific ---------------------------------------------------------
  if (tpl.id === 'features') {
    const items = content.features.filter((f) => f.trim());
    if (!items.length) out.push({ id: 'features-empty', level: 'warning', message: 'Add at least one feature to the list.' });
    if (items.some((f) => f.length > 48)) {
      out.push({ id: 'features-long', level: 'info', message: 'Keep each feature under about 48 characters so it stays on one line.' });
    }
  }
  if (tpl.id === 'testimonial') {
    if (!content.quote.trim()) out.push({ id: 'quote-empty', level: 'warning', message: 'Add the quote.' });
    if (!content.author.trim()) out.push({ id: 'quote-author', level: 'warning', message: 'Add who said it: a quote without a name is not credible.' });
    if (content.quote.length > 180) {
      out.push({ id: 'quote-long', level: 'info', message: `The quote has ${content.quote.length} characters. Under 180 reads better in a feed.` });
    }
  }
  if (tpl.id === 'stats') {
    const filled = content.stats.filter((s) => s.value.trim());
    if (filled.length < 2) out.push({ id: 'stats-few', level: 'warning', message: 'Add at least two figures.' });
    if (content.stats.some((s) => s.value.trim() && !s.label.trim())) {
      out.push({ id: 'stats-label', level: 'info', message: 'Give every figure a label so people know what it measures.' });
    }
  }
  if (tpl.id === 'event' && !content.eventDate.trim()) {
    out.push({ id: 'event-date', level: 'warning', message: 'Add the date of the event.' });
  }
  if (tpl.id === 'code') {
    const lines = content.code.split('\n');
    if (!content.code.trim()) out.push({ id: 'code-empty', level: 'warning', message: 'Paste a code snippet.' });
    const longest = Math.max(0, ...lines.map((l) => l.length));
    if (longest > 60) {
      out.push({ id: 'code-wide', level: 'info', message: `Longest line has ${longest} characters: the code is shrunk to fit. Aim for 60 or fewer.` });
    }
    if (lines.length > 14) {
      out.push({ id: 'code-tall', level: 'info', message: `${lines.length} lines of code (max ${LIMITS.codeLines}). Shorter snippets read better in a feed.` });
    }
  }

  // --- Format specific ---------------------------------------------------------
  if (format.id === 'story' && title.length > 40) {
    out.push({ id: 'story-title', level: 'info', message: 'Stories are viewed quickly: keep the title under 40 characters.' });
  }
  if (format.note) out.push({ id: `format-note-${format.id}`, level: 'info', message: format.note });

  return out;
}
