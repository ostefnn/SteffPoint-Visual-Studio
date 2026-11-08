/** Colour helpers: parsing, palette derivation and WCAG contrast. */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (x: number) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix: t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

/** Rotate hue by `deg` degrees. */
export function shiftHue(hex: string, deg: number): string {
  const { r, g, b } = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return rgbToHex(hslToRgb((h + deg + 360) % 360, s, l));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type Theme = 'light' | 'dark';

export interface Palette {
  primary: string;
  primarySoft: string;
  primaryStrong: string;
  accent: string;
  onPrimary: string;
  bg: string;
  bgAlt: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
}

/** Derive a full palette from a single brand colour. */
export function derivePalette(primary: string, theme: Theme): Palette {
  const p = isHexColor(primary) ? primary : '#2563eb';
  const accent = shiftHue(p, 40);
  const onPrimary = contrastRatio(p, '#ffffff') >= contrastRatio(p, '#0b0b10') ? '#ffffff' : '#0b0b10';
  if (theme === 'dark') {
    return {
      primary: p,
      primarySoft: mix('#0b0d14', p, 0.28),
      primaryStrong: mix(p, '#ffffff', 0.35),
      accent,
      onPrimary,
      bg: mix('#0b0d14', p, 0.08),
      bgAlt: mix('#0b0d14', p, 0.35),
      surface: mix('#151823', p, 0.06),
      text: '#f5f6fa',
      textMuted: mix('#f5f6fa', '#0b0d14', 0.28),
      border: mix('#0b0d14', '#ffffff', 0.14),
    };
  }
  return {
    primary: p,
    primarySoft: mix('#ffffff', p, 0.14),
    primaryStrong: mix(p, '#000000', 0.3),
    accent,
    onPrimary,
    bg: mix('#ffffff', p, 0.05),
    bgAlt: mix('#ffffff', p, 0.3),
    surface: '#ffffff',
    text: '#11131a',
    textMuted: mix('#11131a', '#ffffff', 0.3),
    border: mix('#ffffff', '#11131a', 0.12),
  };
}

export type BackgroundKind = 'solid' | 'gradient' | 'glow' | 'grid' | 'mesh';

/**
 * The most tinted colour a background reaches. Used both by the renderer
 * and by the contrast checker so text is tested against the worst case.
 */
export function backgroundPeak(pal: Palette, type: BackgroundKind, intensity: number): string {
  const i = Math.min(1, Math.max(0, intensity));
  switch (type) {
    case 'gradient':
      return mix(pal.bg, pal.primary, 0.12 + 0.5 * i);
    case 'glow':
      return mix(pal.bg, pal.primary, 0.1 + 0.3 * i);
    case 'mesh':
      return mix(pal.bg, pal.primary, 0.15 + 0.4 * i);
    default:
      return pal.bg;
  }
}
