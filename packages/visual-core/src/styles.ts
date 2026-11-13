/**
 * Style presets: one choice that sets the typefaces, type scale, kicker, frames,
 * shadows and background treatment of every template together.
 *
 * Minimal, Editorial and Bold use typefaces bundled with the app (open licence),
 * so exports render the same on every computer. Soft is the original look,
 * kept as an option; it uses the project's heading font and system faces.
 */
import type { BackgroundType, Project } from './project';
import type { DesktopFrame } from './templates';
import { BUNDLED_FONTS } from './typography';

export type StyleId = 'minimal' | 'editorial' | 'bold' | 'technical' | 'tint' | 'soft';
/** Display order. Soft, the original look, stays last. */
export const STYLE_IDS: StyleId[] = ['minimal', 'editorial', 'bold', 'technical', 'tint', 'soft'];

/**
 * How the kicker (the short line above the title) is drawn. None uses tracked capitals.
 * `code` is Technical's: the text in the bundled mono face after a brand-coloured `//`.
 */
export type KickerTreatment = 'plain' | 'rule' | 'label' | 'pill' | 'code';

export interface StyleSpec {
  id: StyleId;
  name: string;
  description: string;
  /** Heading stack, or null to use the project's own heading font (Soft). */
  heading: string | null;
  body: string;
  /** Multiplier on the shared title size. */
  titleScale: number;
  titleWeight: number;
  titleTracking: string;
  titleLeading: number;
  /** CSS font-stretch for the heading (Bold uses a condensed width). */
  titleStretch?: string;
  /** Subtitle in the heading face, italic (Editorial). */
  italicSubtitle: boolean;
  kicker: KickerTreatment;
  /**
   * Shadow under screenshots and cards. `mat` (Tint) is no shadow at all but a flat margin
   * of soft brand colour around each frame, like a passe-partout.
   */
  shadow: 'soft' | 'none' | 'hard' | 'mat';
  /** Multiplier on the project's corner radius. */
  radiusScale: number;
  /** Outline of screenshots and cards. */
  edge: 'hairline' | 'thick' | 'none';
  /** Glows and gradient blobs behind screenshots (Spotlight halo…). */
  glow: boolean;
  /** Grid background drawn crisp: visible lines, no brand halo (Technical). */
  crispGrid?: boolean;
  /** Bold paints the brand colour as the background, whatever the background setting. */
  brandBackground: boolean;
  /** Applied when the user picks the style; both stay editable afterwards. */
  defaults: { background: BackgroundType; desktopFrame: DesktopFrame };
}

export const STYLES: Record<StyleId, StyleSpec> = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Neutral ground, large tight titles, thin outlines and no shadows.',
    heading: BUNDLED_FONTS.geist,
    body: BUNDLED_FONTS.geist,
    titleScale: 1.3,
    titleWeight: 700,
    titleTracking: '-0.045em',
    titleLeading: 0.98,
    italicSubtitle: false,
    kicker: 'plain',
    shadow: 'none',
    radiusScale: 0.35,
    edge: 'hairline',
    glow: false,
    brandBackground: false,
    defaults: { background: 'solid', desktopFrame: 'plain' },
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    description: 'Serif titles, white ground, square corners. For articles and launches.',
    heading: BUNDLED_FONTS.serif,
    body: BUNDLED_FONTS.geist,
    titleScale: 1.5,
    titleWeight: 400,
    titleTracking: '-0.015em',
    titleLeading: 1,
    italicSubtitle: true,
    kicker: 'rule',
    shadow: 'none',
    radiusScale: 0,
    edge: 'hairline',
    glow: false,
    brandBackground: false,
    defaults: { background: 'solid', desktopFrame: 'plain' },
  },
  bold: {
    id: 'bold',
    name: 'Bold',
    description: 'Your brand colour as the ground, a big condensed title, hard outlines.',
    heading: BUNDLED_FONTS.condensed,
    body: BUNDLED_FONTS.geist,
    titleScale: 1.55,
    titleWeight: 800,
    titleTracking: '-0.02em',
    titleLeading: 0.95,
    titleStretch: '78%',
    italicSubtitle: false,
    kicker: 'label',
    shadow: 'hard',
    radiusScale: 0.5,
    edge: 'thick',
    glow: false,
    brandBackground: true,
    defaults: { background: 'solid', desktopFrame: 'plain' },
  },
  technical: {
    id: 'technical',
    name: 'Technical',
    description: 'White grid, mono kicker, square corners. For changelogs, APIs and developer tools.',
    heading: BUNDLED_FONTS.geist,
    body: BUNDLED_FONTS.geist,
    titleScale: 1.2,
    titleWeight: 600,
    titleTracking: '-0.035em',
    titleLeading: 1.02,
    italicSubtitle: false,
    kicker: 'code',
    shadow: 'none',
    radiusScale: 0.2,
    edge: 'hairline',
    glow: false,
    crispGrid: true,
    brandBackground: false,
    defaults: { background: 'grid', desktopFrame: 'window' },
  },
  tint: {
    id: 'tint',
    name: 'Tint',
    description: 'Your brand in quiet shades: tinted ground, brand-dark text, screenshots on a coloured mat.',
    heading: BUNDLED_FONTS.geist,
    body: BUNDLED_FONTS.geist,
    titleScale: 1.25,
    titleWeight: 650,
    titleTracking: '-0.03em',
    titleLeading: 1,
    italicSubtitle: false,
    kicker: 'plain',
    shadow: 'mat',
    radiusScale: 0.6,
    edge: 'none',
    glow: false,
    brandBackground: false,
    defaults: { background: 'solid', desktopFrame: 'window' },
  },
  soft: {
    id: 'soft',
    name: 'Soft',
    description: 'The original look: tinted ground with glows, rounded pills, soft shadows.',
    heading: null,
    body: "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif",
    titleScale: 1,
    titleWeight: 760,
    titleTracking: '-0.022em',
    titleLeading: 1.06,
    italicSubtitle: false,
    kicker: 'pill',
    shadow: 'soft',
    radiusScale: 1,
    edge: 'hairline',
    glow: true,
    brandBackground: false,
    defaults: { background: 'glow', desktopFrame: 'browser' },
  },
};

export function getStyle(id: string | undefined): StyleSpec {
  return STYLES[id as StyleId] ?? STYLES.minimal;
}

/**
 * The project as it looks in another style: the style plus the background and screenshot
 * frame it brings (what picking it in the Style panel does). Content and brand colour are kept.
 */
export function withStyle(project: Project, id: StyleId): Project {
  const st = STYLES[id];
  return {
    ...project,
    brand: { ...project.brand, style: id },
    // A chosen photo stays: the style's own ground would silently replace it.
    background: { ...project.background, type: project.background.type === 'image' && project.background.imageAssetId ? 'image' : st.defaults.background },
    desktopFrame: st.defaults.desktopFrame,
  };
}

export interface GridFit {
  columns: number;
  rows: number;
  /** Width and height of each item once scaled to fit its cell, in box units. */
  width: number;
  height: number;
}

/**
 * Best arrangement for `count` items of one aspect ratio in a box: tries every column count
 * and keeps the one where each item is drawn largest. Used by the Compare Styles matrix, so
 * landscape formats get a 2 × 2 grid and tall ones (Story 9:16) a single row.
 * `caption` is the height reserved under each item for its label.
 */
export function fitGrid(
  count: number,
  box: { width: number; height: number },
  item: { width: number; height: number },
  { gap = 12, padding = 16, caption = 0 }: { gap?: number; padding?: number; caption?: number } = {},
): GridFit {
  let best: GridFit = { columns: 1, rows: count, width: 0, height: 0 };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const cellW = (box.width - padding * 2 - gap * (columns - 1)) / columns;
    const cellH = (box.height - padding * 2 - gap * (rows - 1)) / rows - caption;
    const scale = Math.max(0, Math.min(cellW / item.width, cellH / item.height));
    if (scale * item.width > best.width) best = { columns, rows, width: scale * item.width, height: scale * item.height };
  }
  return best;
}
