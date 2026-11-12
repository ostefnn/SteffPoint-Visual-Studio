import type { Orientation } from './formats';

/**
 * Shared type scale so the renderer and the rule engine agree on sizes.
 * `u` is 1% of the shortest side of the canvas.
 */
export function titleSize(u: number, orientation: Orientation, length: number, scale = 1): number {
  const base = orientation === 'portrait' ? 8.2 : orientation === 'square' ? 7.2 : 7.4;
  const len = Math.max(1, length);
  const fit = len <= 24 ? 1 : Math.max(0.55, Math.sqrt(24 / len));
  return u * base * fit * scale;
}

export function subtitleSize(u: number, orientation: Orientation, scale = 1): number {
  const base = orientation === 'portrait' ? 4 : 3.4;
  return u * base * scale;
}

export function kickerSize(u: number, scale = 1): number {
  return u * 2.2 * scale;
}

export type LogoSize = 'small' | 'medium' | 'large';
export const LOGO_SIZES: readonly LogoSize[] = ['small', 'medium', 'large'];
const LOGO_FACTOR: Record<LogoSize, number> = { small: 1, medium: 1.4, large: 2 };

/** Rendered logo height in pixels (at 1×), shared by the renderer and the blur check. */
export function logoHeight(u: number, size: LogoSize, scale = 1): number {
  return u * 4.6 * Math.max(0.8, scale) * LOGO_FACTOR[size];
}

/** Recommended minimum logo file sizes, shown in the UI. */
export const LOGO_ADVICE = { iconPx: 512, wordmarkWidthPx: 800 } as const;

export type HeadingFont = 'sans' | 'serif' | 'rounded' | 'mono';

/** Faces bundled with the app (open licence, loaded from the app itself, never from a CDN). */
export const BUNDLED_FONTS = {
  geist: "'Geist Variable', 'Geist', 'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono Variable', 'Geist Mono', 'SF Mono', Menlo, Consolas, monospace",
  serif: "'Instrument Serif', Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  condensed: "'Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Arial Narrow', 'Segoe UI', sans-serif",
} as const;

/** Faces the exporter waits for before rasterising, so the first export never falls back. */
export const BUNDLED_FONT_FACES = [
  "400 16px 'Geist Variable'",
  "700 16px 'Geist Variable'",
  "400 16px 'Geist Mono Variable'",
  "500 16px 'Geist Mono Variable'",
  "400 16px 'Instrument Serif'",
  "italic 400 16px 'Instrument Serif'",
  "800 16px 'Bricolage Grotesque Variable'",
] as const;

export const FONT_STACKS: Record<HeadingFont, string> = {
  sans: "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif",
  serif: BUNDLED_FONTS.serif,
  rounded: "'SF Pro Rounded', 'Segoe UI', Nunito, system-ui, sans-serif",
  // Bundled, so code windows and the Mono heading export the same on every computer.
  mono: BUNDLED_FONTS.mono,
};

export const BODY_STACK = FONT_STACKS.sans;

/** Monospace glyph width as a fraction of the font size (conservative for common mono fonts). */
export const MONO_CHAR_WIDTH = 0.62;
export const CODE_LINE_HEIGHT = 1.55;

/**
 * Largest font size (px) at which `code` fits a box of `width` × `height`,
 * capped at `max` so short snippets do not become huge.
 * Reserves room for a line-number gutter of `gutterChars` characters.
 */
export function fitCodeFontSize(code: string, width: number, height: number, max: number, gutterChars = 3): number {
  const lines = code.split('\n');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const byWidth = width / ((longest + gutterChars + 1) * MONO_CHAR_WIDTH);
  const byHeight = height / (Math.max(1, lines.length) * CODE_LINE_HEIGHT);
  return Math.max(1, Math.min(max, byWidth, byHeight));
}
