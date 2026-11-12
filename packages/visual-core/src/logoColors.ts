/**
 * Dominant colour sampling for logos.
 *
 * Pure function over RGBA pixels (as returned by canvas getImageData), so it is testable
 * without a browser. Pixels are grouped into coarse colour buckets, near-identical buckets
 * are merged, and the result is ranked so that a brand colour wins over the white or black
 * ground most logos sit on.
 */
import { rgbToHex, type RGB } from './color';

export interface LogoColor {
  hex: string;
  /** Share of the opaque pixels this colour covers, 0 – 1. */
  share: number;
  /** True for a colour with enough saturation to work as a brand colour. */
  chromatic: boolean;
}

/** Pixels more transparent than this are ignored (anti-aliased edges, transparent ground). */
const MIN_ALPHA = 128;
/** Bits kept per channel when bucketing: 4 bits = 4096 buckets. */
const BITS = 4;
/** Two colours closer than this (Euclidean RGB distance) are treated as one. */
const MERGE_DISTANCE = 48;
/** Colours below this share are noise (anti-aliasing, tiny details). */
const MIN_SHARE = 0.02;

function saturation({ r, g, b }: RGB): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function lightness({ r, g, b }: RGB): number {
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
}

function distance(a: RGB, b: RGB): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** Usable as a brand colour: saturated, and neither near-white nor near-black. */
function isChromatic(c: RGB): boolean {
  const l = lightness(c);
  return saturation(c) >= 0.25 && l > 0.12 && l < 0.92;
}

/**
 * Extract up to `max` dominant colours from RGBA pixel data, best brand candidate first.
 * Chromatic colours rank before greys, whites and blacks; within each group, by coverage
 * weighted by saturation. Returns an empty list when the image has no opaque pixels.
 */
export function extractLogoColors(data: ArrayLike<number>, max = 5): LogoColor[] {
  const shift = 8 - BITS;
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < MIN_ALPHA) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> shift) << (2 * BITS)) | ((g >> shift) << BITS) | (b >> shift);
    const k = buckets.get(key);
    if (k) {
      k.r += r;
      k.g += g;
      k.b += b;
      k.n++;
    } else buckets.set(key, { r, g, b, n: 1 });
    total++;
  }
  if (!total) return [];

  // Average colour of each bucket, biggest first, then merge near neighbours into the bigger one.
  const groups = [...buckets.values()]
    .map((k) => ({ c: { r: k.r / k.n, g: k.g / k.n, b: k.b / k.n }, n: k.n }))
    .sort((a, b) => b.n - a.n);
  const merged: { c: RGB; n: number }[] = [];
  for (const g of groups) {
    const into = merged.find((m) => distance(m.c, g.c) < MERGE_DISTANCE);
    if (into) {
      const n = into.n + g.n;
      into.c = { r: (into.c.r * into.n + g.c.r * g.n) / n, g: (into.c.g * into.n + g.c.g * g.n) / n, b: (into.c.b * into.n + g.c.b * g.n) / n };
      into.n = n;
    } else merged.push({ c: { ...g.c }, n: g.n });
  }

  const colors = merged
    .map((m) => ({ hex: rgbToHex(m.c), share: m.n / total, chromatic: isChromatic(m.c), sat: saturation(m.c) }))
    .filter((c) => c.share >= MIN_SHARE || merged.length === 1);
  const score = (c: (typeof colors)[number]) => c.share * (0.35 + c.sat);
  colors.sort((a, b) => Number(b.chromatic) - Number(a.chromatic) || score(b) - score(a));
  return colors.slice(0, Math.max(1, max)).map(({ hex, share, chromatic }) => ({ hex, share, chromatic }));
}

/**
 * The colour to adopt automatically as the project's primary, or null when the logo has no
 * real brand colour (transparent, white, black or grey only). Monochrome logos still list
 * their ink in `extractLogoColors`, for the user to pick by hand.
 */
export function pickBrandColor(colors: LogoColor[]): string | null {
  return colors.find((c) => c.chromatic)?.hex ?? null;
}
