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

export type HeadingFont = 'sans' | 'serif' | 'rounded' | 'mono';

export const FONT_STACKS: Record<HeadingFont, string> = {
  sans: "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  rounded: "'SF Pro Rounded', 'Segoe UI', Nunito, system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
};

export const BODY_STACK = FONT_STACKS.sans;
