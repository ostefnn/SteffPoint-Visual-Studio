import { describe, expect, it } from 'vitest';
import { extractLogoColors, pickBrandColor, withStyle, createProject, STYLES } from './index';

/** RGBA buffer made of runs: [r, g, b, a, count]. */
function pixels(...runs: [number, number, number, number, number][]): Uint8ClampedArray {
  const out: number[] = [];
  for (const [r, g, b, a, n] of runs) for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return new Uint8ClampedArray(out);
}

describe('logo colours', () => {
  it('returns nothing for a fully transparent image', () => {
    expect(extractLogoColors(pixels([255, 0, 0, 0, 100]))).toEqual([]);
    expect(pickBrandColor([])).toBeNull();
  });

  it('prefers the brand colour over a larger white ground', () => {
    const colors = extractLogoColors(pixels([255, 255, 255, 255, 700], [15, 118, 110, 255, 300]));
    expect(colors[0].chromatic).toBe(true);
    expect(colors[0].hex).toBe('#0f766e');
    expect(colors.map((c) => c.hex)).toContain('#ffffff');
    expect(pickBrandColor(colors)).toBe('#0f766e');
  });

  it('ignores transparent pixels and anti-aliasing noise', () => {
    const colors = extractLogoColors(pixels([0, 0, 0, 0, 5000], [37, 99, 235, 255, 500], [200, 30, 30, 255, 5]));
    expect(colors).toHaveLength(1);
    expect(colors[0].hex).toBe('#2563eb');
    expect(colors[0].share).toBeCloseTo(500 / 505, 3);
  });

  it('merges near-identical shades into one colour', () => {
    const colors = extractLogoColors(pixels([37, 99, 235, 255, 300], [40, 102, 238, 255, 300], [250, 204, 21, 255, 200]));
    expect(colors).toHaveLength(2);
    expect(colors[0].share).toBeCloseTo(0.75, 2);
  });

  it('ranks the more saturated brand colour first when coverage is similar', () => {
    const colors = extractLogoColors(pixels([120, 130, 150, 255, 500], [230, 40, 90, 255, 450]));
    expect(colors[0].hex).toBe('#e6285a');
  });

  it('lists the ink of a monochrome logo but does not adopt it automatically', () => {
    const colors = extractLogoColors(pixels([17, 24, 39, 255, 400]));
    expect(colors).toEqual([{ hex: '#111827', share: 1, chromatic: false }]);
    expect(pickBrandColor(colors)).toBeNull();
    expect(pickBrandColor(extractLogoColors(pixels([255, 255, 255, 255, 400])))).toBeNull();
  });

  it('caps the number of colours', () => {
    const runs = [0, 60, 120, 180, 240].flatMap((h) => [[h, 255 - h, (h * 7) % 256, 255, 100] as [number, number, number, number, number]]);
    expect(extractLogoColors(pixels(...runs), 3).length).toBeLessThanOrEqual(3);
  });
});

describe('withStyle', () => {
  it('applies the style with its background and frame, keeping content and colour', () => {
    const p = createProject();
    p.content.title = 'Same title';
    p.brand.primary = '#0f766e';
    for (const id of ['minimal', 'editorial', 'bold', 'soft'] as const) {
      const v = withStyle(p, id);
      expect(v.brand.style).toBe(id);
      expect(v.background.type).toBe(STYLES[id].defaults.background);
      expect(v.desktopFrame).toBe(STYLES[id].defaults.desktopFrame);
      expect(v.content.title).toBe('Same title');
      expect(v.brand.primary).toBe('#0f766e');
    }
    expect(p.brand.style).not.toBe('soft'); // source untouched
  });
});
