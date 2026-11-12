import { describe, expect, it } from 'vitest';
import { extractLogoColors, fitGrid, pickBrandColor, withStyle, createProject, STYLES } from './index';

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

describe('fitGrid', () => {
  const box = { width: 830, height: 680 };
  const opts = { gap: 12, padding: 16, caption: 22 };

  it('puts four landscape items in a 2 × 2 grid', () => {
    const f = fitGrid(4, box, { width: 1200, height: 627 }, opts);
    expect([f.columns, f.rows]).toEqual([2, 2]);
    expect(f.width).toBeCloseTo(393, 0);
  });

  it('puts four tall items on a single row', () => {
    const f = fitGrid(4, box, { width: 1080, height: 1920 }, opts);
    expect([f.columns, f.rows]).toEqual([4, 1]);
    // Larger than the same items in a 2 × 2 grid.
    const twoByTwo = Math.min((830 - 32 - 12) / 2 / 1080, ((680 - 32 - 12) / 2 - 22) / 1920) * 1080;
    expect(f.width).toBeGreaterThan(twoByTwo);
  });

  it('stacks very wide items in a single column', () => {
    const f = fitGrid(4, { width: 600, height: 900 }, { width: 1584, height: 396 }, opts);
    expect([f.columns, f.rows]).toEqual([1, 4]);
  });

  it('never returns a negative size in a tiny box', () => {
    const f = fitGrid(4, { width: 10, height: 10 }, { width: 100, height: 100 }, opts);
    expect(f.width).toBeGreaterThanOrEqual(0);
  });
});
