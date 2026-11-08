import { clampCustomSize, FORMAT_ORDER, type FormatId } from './formats';
import { isHexColor, type Theme } from './color';
import {
  DEVICE_KINDS,
  getTemplate,
  isTemplateId,
  MIN_DEVICES,
  type DeviceKind,
  type DeviceOrientation,
  type RotatableDevice,
  type TemplateId,
} from './templates';
import type { HeadingFont } from './typography';

export const PROJECT_SCHEMA_VERSION = '1.0';

export const LIMITS = {
  name: 80,
  title: 120,
  subtitle: 240,
  kicker: 40,
  label: 24,
  /** Features / changelog template. */
  featureItems: 4,
  feature: 70,
  /** Code template. */
  codeFile: 40,
  code: 1500,
  codeLines: 20,
  screenshots: 4,
  fileBytes: 20 * 1024 * 1024,
} as const;

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export type BackgroundType = 'solid' | 'gradient' | 'glow' | 'grid' | 'mesh';

export interface AssetRef {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  size: number;
}

/** Non destructive image settings for a screenshot slot. */
export interface ScreenshotSlot {
  id: string;
  assetId: string;
  fit: 'cover' | 'contain';
  zoom: number; // 1 – 3
  focalX: number; // 0 – 1
  focalY: number; // 0 – 1
}

export interface Brand {
  primary: string;
  theme: Theme;
  headingFont: HeadingFont;
  radius: number; // 0 – 1
  shadow: number; // 0 – 1
  logoAssetId: string | null;
}

export interface Background {
  type: BackgroundType;
  intensity: number; // 0 – 1
  angle: number; // degrees
}

export interface Content {
  kicker: string;
  title: string;
  subtitle: string;
  beforeLabel: string;
  afterLabel: string;
  /** Bullet points for the Features template (max LIMITS.featureItems). */
  features: string[];
  /** Snippet for the Code template. */
  code: string;
  /** File name shown in the code window tab. */
  codeFile: string;
}

export interface Project {
  schemaVersion: string;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Incremented on every stored write. Used for optimistic locking between tabs. */
  revision: number;
  favorite: boolean;
  template: TemplateId;
  content: Content;
  brand: Brand;
  background: Background;
  assets: AssetRef[];
  screenshots: ScreenshotSlot[];
  exportPresets: FormatId[];
  customFormat: { width: number; height: number };
  /** Devices shown by the Device Mix template, in DEVICE_KINDS order. Screenshot i goes in device i. */
  devices: DeviceKind[];
  /** Orientation of the tablet and phone frames in Device Mix. */
  deviceOrientation: Record<RotatableDevice, DeviceOrientation>;
}

export function uid(prefix = ''): string {
  const c = globalThis.crypto;
  const id = c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${id}` : id;
}

export const BRAND_COLOR_PRESETS = ['#2563eb', '#0078d4', '#7c3aed', '#742774', '#db2777', '#ea580c', '#16a34a', '#0f766e', '#111827'];

export function createProject(init: Partial<Pick<Project, 'name' | 'template'>> = {}): Project {
  const now = Date.now();
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: uid('prj'),
    name: init.name ?? 'Untitled project',
    createdAt: now,
    updatedAt: now,
    revision: 0,
    favorite: false,
    template: init.template ?? 'browser-hero',
    content: {
      kicker: 'New release',
      title: 'Your product, beautifully presented',
      subtitle: 'Drop screenshots, pick a template and export every format at once.',
      beforeLabel: 'Before',
      afterLabel: 'After',
      features: ['Everything stays on your device', 'Every format in one export', 'Your brand applied automatically'],
      code: [
        "import { createPack } from '@steffpoint/visual';",
        '',
        'const pack = await createPack({',
        "  title: 'Cockpit SteffPoint',",
        "  formats: ['linkedin', 'open-graph', 'story'],",
        '});',
        '',
        '// One composition, every format.',
        'await pack.export();',
      ].join('\n'),
      codeFile: 'launch.ts',
    },
    brand: { primary: '#2563eb', theme: 'light', headingFont: 'sans', radius: 0.5, shadow: 0.5, logoAssetId: null },
    background: { type: 'glow', intensity: 0.6, angle: 135 },
    assets: [],
    screenshots: [],
    exportPresets: ['linkedin', 'open-graph', 'square', 'story', 'github'],
    customFormat: { width: 1600, height: 900 },
    devices: [...DEVICE_KINDS],
    deviceOrientation: { tablet: 'portrait', mobile: 'portrait' },
  };
}

/** Keep known devices, in canonical order, without duplicates; fall back to all devices below MIN_DEVICES. */
export function normalizeDevices(v: unknown): DeviceKind[] {
  const list = Array.isArray(v) ? DEVICE_KINDS.filter((d) => v.includes(d)) : [];
  return list.length >= MIN_DEVICES ? list : [...DEVICE_KINDS];
}

/** How many screenshots the project's template shows (Device Mix depends on the chosen devices). */
export function screenshotRange(p: Pick<Project, 'template' | 'devices'>): { min: number; max: number } {
  if (p.template === 'device-mix') {
    const n = normalizeDevices(p.devices).length;
    return { min: n, max: n };
  }
  return getTemplate(p.template).slots.screenshots;
}

export function createScreenshotSlot(assetId: string): ScreenshotSlot {
  return { id: uid('shot'), assetId, fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0 };
}

// ---------------------------------------------------------------------------
// Validation and migration
// ---------------------------------------------------------------------------

const str = (v: unknown, fallback: string, max: number): string =>
  typeof v === 'string' ? sanitizeText(v).slice(0, max) : fallback;
const num = (v: unknown, fallback: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T =>
  values.includes(v as T) ? (v as T) : fallback;
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Remove control characters (keeps newlines and tabs). */
export function sanitizeText(v: string): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/** Limit a code snippet to LIMITS.code characters and LIMITS.codeLines lines; tabs become 2 spaces. */
export function clampCode(code: string): string {
  return code.replace(/\t/g, '  ').replace(/\r\n?/g, '\n').split('\n').slice(0, LIMITS.codeLines).join('\n').slice(0, LIMITS.code);
}

/**
 * Turn any (possibly older or hand edited) project JSON into a valid Project.
 * Unknown fields are dropped, invalid values fall back to defaults.
 * Throws if the input is not an object at all.
 */
export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid project: expected an object.');
  }
  const r = raw as Record<string, unknown>;
  const d = createProject();

  // Schema 0.x stored the title and subtitle at the root.
  const legacyContent: Record<string, unknown> = r.schemaVersion === undefined || String(r.schemaVersion).startsWith('0.')
    ? { title: r.title, subtitle: r.subtitle }
    : {};
  const content: Record<string, unknown> = { ...legacyContent, ...obj(r.content) };
  const brand = obj(r.brand);
  const bg = obj(r.background);
  const custom = obj(r.customFormat);
  const orient = obj(r.deviceOrientation);

  const assets: AssetRef[] = Array.isArray(r.assets)
    ? r.assets
        .map(obj)
        .filter((a) => typeof a.id === 'string' && a.id)
        .map((a) => ({
          id: a.id as string,
          name: str(a.name, 'image', 120),
          mime: oneOf(a.mime, ACCEPTED_IMAGE_TYPES, 'image/png'),
          width: num(a.width, 0, 0, 100_000),
          height: num(a.height, 0, 0, 100_000),
          size: num(a.size, 0, 0, Number.MAX_SAFE_INTEGER),
        }))
    : [];
  const assetIds = new Set(assets.map((a) => a.id));

  const screenshots: ScreenshotSlot[] = Array.isArray(r.screenshots)
    ? r.screenshots
        .map(obj)
        .filter((s) => typeof s.assetId === 'string' && assetIds.has(s.assetId))
        .slice(0, LIMITS.screenshots)
        .map((s) => ({
          id: typeof s.id === 'string' && s.id ? s.id : uid('shot'),
          assetId: s.assetId as string,
          fit: oneOf(s.fit, ['cover', 'contain'] as const, 'cover'),
          zoom: num(s.zoom, 1, 1, 3),
          focalX: num(s.focalX, 0.5, 0, 1),
          focalY: num(s.focalY, 0, 0, 1),
        }))
    : [];

  // "Desktop + Mobile" (browser-mobile) was replaced by Device Mix with the same two devices.
  const legacyDesktopMobile = r.template === 'browser-mobile';

  const logo = typeof brand.logoAssetId === 'string' && assetIds.has(brand.logoAssetId) ? brand.logoAssetId : null;

  const presets = Array.isArray(r.exportPresets)
    ? (r.exportPresets.filter((f) => FORMAT_ORDER.includes(f as FormatId)) as FormatId[])
    : d.exportPresets;

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: typeof r.id === 'string' && r.id ? r.id : d.id,
    name: str(r.name, d.name, LIMITS.name) || d.name,
    createdAt: num(r.createdAt, d.createdAt, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: num(r.updatedAt, d.updatedAt, 0, Number.MAX_SAFE_INTEGER),
    revision: Math.floor(num(r.revision, 0, 0, Number.MAX_SAFE_INTEGER)),
    favorite: r.favorite === true,
    template: legacyDesktopMobile ? 'device-mix' : isTemplateId(r.template) ? r.template : d.template,
    content: {
      kicker: str(content.kicker, d.content.kicker, LIMITS.kicker),
      title: str(content.title, d.content.title, LIMITS.title),
      subtitle: str(content.subtitle, d.content.subtitle, LIMITS.subtitle),
      beforeLabel: str(content.beforeLabel, d.content.beforeLabel, LIMITS.label),
      afterLabel: str(content.afterLabel, d.content.afterLabel, LIMITS.label),
      features: Array.isArray(content.features)
        ? content.features
            .filter((f): f is string => typeof f === 'string')
            .slice(0, LIMITS.featureItems)
            .map((f) => sanitizeText(f).replace(/\n/g, ' ').slice(0, LIMITS.feature))
        : d.content.features,
      code: typeof content.code === 'string' ? clampCode(sanitizeText(content.code)) : d.content.code,
      codeFile: str(content.codeFile, d.content.codeFile, LIMITS.codeFile).replace(/\n/g, ' '),
    },
    brand: {
      primary: isHexColor(brand.primary) ? brand.primary : d.brand.primary,
      theme: oneOf(brand.theme, ['light', 'dark'] as const, d.brand.theme),
      headingFont: oneOf(brand.headingFont, ['sans', 'serif', 'rounded', 'mono'] as const, d.brand.headingFont),
      radius: num(brand.radius, d.brand.radius, 0, 1),
      shadow: num(brand.shadow, d.brand.shadow, 0, 1),
      logoAssetId: logo,
    },
    background: {
      type: oneOf(bg.type, ['solid', 'gradient', 'glow', 'grid', 'mesh'] as const, d.background.type),
      intensity: num(bg.intensity, d.background.intensity, 0, 1),
      angle: num(bg.angle, d.background.angle, 0, 360),
    },
    assets,
    screenshots,
    exportPresets: [...new Set(presets)],
    customFormat: {
      width: clampCustomSize(num(custom.width, d.customFormat.width, 1, 100_000)),
      height: clampCustomSize(num(custom.height, d.customFormat.height, 1, 100_000)),
    },
    devices: legacyDesktopMobile ? ['desktop', 'mobile'] : normalizeDevices(r.devices),
    deviceOrientation: {
      tablet: oneOf(orient.tablet, ['portrait', 'landscape'] as const, 'portrait'),
      mobile: oneOf(orient.mobile, ['portrait', 'landscape'] as const, 'portrait'),
    },
  };
}
