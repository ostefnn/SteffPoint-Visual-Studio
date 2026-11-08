/** Output format presets. Sizes in CSS pixels at 1x. */

export type FormatId =
  | 'linkedin'
  | 'linkedin-carousel'
  | 'open-graph'
  | 'square'
  | 'story'
  | 'github'
  | 'product-hunt'
  | 'banner'
  | 'thumbnail'
  | 'appstore-iphone'
  | 'appstore-ipad'
  | 'appstore-mac'
  | 'custom';

export type Orientation = 'landscape' | 'square' | 'portrait';

/** Safe zone insets, expressed as fractions of width (left/right) and height (top/bottom). */
export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FormatPreset {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  safe: SafeInsets;
  note?: string;
}

const uniform = (v: number): SafeInsets => ({ top: v, right: v, bottom: v, left: v });

export const FORMAT_PRESETS: Record<FormatId, FormatPreset> = {
  linkedin: { id: 'linkedin', label: 'LinkedIn', width: 1200, height: 627, safe: uniform(0.05) },
  'linkedin-carousel': {
    id: 'linkedin-carousel',
    label: 'LinkedIn 4:5',
    width: 1080,
    height: 1350,
    safe: uniform(0.06),
    note: 'Portrait post and carousel page size. Export the whole carousel as a PDF from the Export dialog.',
  },
  'open-graph': {
    id: 'open-graph',
    label: 'Open Graph',
    width: 1200,
    height: 630,
    safe: { top: 0.06, right: 0.08, bottom: 0.06, left: 0.08 },
    note: 'Some platforms crop OG images to a near-square around the centre.',
  },
  square: { id: 'square', label: 'Square 1:1', width: 1080, height: 1080, safe: uniform(0.06) },
  story: {
    id: 'story',
    label: 'Story 9:16',
    width: 1080,
    height: 1920,
    safe: { top: 0.13, right: 0.06, bottom: 0.18, left: 0.06 },
    note: 'Top and bottom are covered by app UI.',
  },
  github: {
    id: 'github',
    label: 'GitHub',
    width: 1280,
    height: 640,
    safe: uniform(0.05),
    note: 'Repository social preview.',
  },
  'product-hunt': { id: 'product-hunt', label: 'Product Hunt', width: 1270, height: 760, safe: uniform(0.05) },
  banner: {
    id: 'banner',
    label: 'Banner',
    width: 1584,
    height: 396,
    safe: { top: 0.1, right: 0.05, bottom: 0.1, left: 0.25 },
    note: 'Profile banners: the avatar usually covers the bottom-left.',
  },
  thumbnail: { id: 'thumbnail', label: 'Thumbnail 16:9', width: 1280, height: 720, safe: uniform(0.05) },
  'appstore-iphone': {
    id: 'appstore-iphone',
    label: 'App Store iPhone',
    width: 1320,
    height: 2868,
    safe: uniform(0.04),
    note: 'iPhone 6.9" App Store screenshot. Export at 1× for the exact size App Store Connect expects.',
  },
  'appstore-ipad': {
    id: 'appstore-ipad',
    label: 'App Store iPad',
    width: 2064,
    height: 2752,
    safe: uniform(0.04),
    note: 'iPad 13" App Store screenshot. Export at 1× for the exact size App Store Connect expects.',
  },
  'appstore-mac': {
    id: 'appstore-mac',
    label: 'Mac App Store',
    width: 2880,
    height: 1800,
    safe: uniform(0.04),
    note: 'Mac App Store screenshot. Export at 1× for the exact size App Store Connect expects.',
  },
  custom: { id: 'custom', label: 'Custom', width: 1600, height: 900, safe: uniform(0.05) },
};

export const FORMAT_ORDER: FormatId[] = [
  'linkedin',
  'linkedin-carousel',
  'open-graph',
  'square',
  'story',
  'github',
  'product-hunt',
  'banner',
  'thumbnail',
  'appstore-iphone',
  'appstore-ipad',
  'appstore-mac',
  'custom',
];

export const MIN_CUSTOM_SIZE = 64;
export const MAX_CUSTOM_SIZE = 4096;

export function clampCustomSize(n: number): number {
  if (!Number.isFinite(n)) return MIN_CUSTOM_SIZE;
  return Math.round(Math.min(MAX_CUSTOM_SIZE, Math.max(MIN_CUSTOM_SIZE, n)));
}

/** Resolve a format, applying the project's custom size to the `custom` preset. */
export function resolveFormat(id: FormatId, custom?: { width: number; height: number }): FormatPreset {
  const preset = FORMAT_PRESETS[id] ?? FORMAT_PRESETS.linkedin;
  if (id === 'custom' && custom) {
    return { ...preset, width: clampCustomSize(custom.width), height: clampCustomSize(custom.height) };
  }
  return preset;
}

export function getOrientation(width: number, height: number): Orientation {
  const r = width / height;
  if (r > 1.15) return 'landscape';
  if (r < 0.87) return 'portrait';
  return 'square';
}

/** Max pixel count we consider reasonable for a single export (about 33 MP). */
export const MAX_EXPORT_PIXELS = 33_000_000;

/**
 * Canvas area limit commonly reported for Safari on iOS / iPadOS (4096 × 4096).
 * Larger canvases fail to render there. Verify against current WebKit behaviour.
 */
export const IOS_CANVAS_PIXELS = 16_777_216;

export function isScaleReasonable(width: number, height: number, scale: number, limit = MAX_EXPORT_PIXELS): boolean {
  return width * height * scale * scale <= limit;
}
