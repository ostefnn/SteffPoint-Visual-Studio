import { clampCustomSize, FORMAT_ORDER, type FormatId } from './formats';
import { isHexColor, type Theme } from './color';
import {
  DESKTOP_FRAMES,
  DEVICE_KINDS,
  getTemplate,
  isTemplateId,
  MIN_DEVICES,
  type DesktopFrame,
  type DeviceKind,
  type DeviceOrientation,
  type RotatableDevice,
  type TemplateId,
} from './templates';
import { LOGO_SIZES, type HeadingFont, type LogoSize } from './typography';
import { STYLE_IDS, STYLES, type StyleId } from './styles';

export const PROJECT_SCHEMA_VERSION = '1.0';

export const LIMITS = {
  name: 80,
  title: 120,
  subtitle: 240,
  kicker: 40,
  label: 24,
  /** Per-screenshot caption, used as the slide title in LinkedIn carousels. */
  caption: 90,
  /** Features / changelog template. */
  featureItems: 4,
  feature: 70,
  /** Code template. */
  codeFile: 40,
  code: 1500,
  codeLines: 20,
  /** Testimonial template. */
  quote: 280,
  person: 50,
  /** Key Figures template. */
  statItems: 4,
  statValue: 12,
  statLabel: 40,
  /** Event template. */
  eventField: 50,
  cta: 30,
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
  zoom: number; // ZOOM_RANGE: below 1 shrinks the image inside its frame
  focalX: number; // 0 – 1, within the cropped area
  focalY: number; // 0 – 1, within the cropped area
  /** Fraction of the image trimmed from each edge (0 – CROP_MAX). */
  crop: Crop;
  /** Optional caption, used as the title of this screenshot's carousel slide. */
  caption: string;
}

export interface Crop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_CROP: Crop = { top: 0, right: 0, bottom: 0, left: 0 };
/** Each edge can trim up to this fraction, so at least 10% of the image always remains. */
export const CROP_MAX = 0.45;
export const ZOOM_RANGE = { min: 0.5, max: 3 } as const;

export function clampCrop(c: Partial<Record<keyof Crop, unknown>> | undefined): Crop {
  const f = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(CROP_MAX, Math.max(0, v)) : 0);
  return { top: f(c?.top), right: f(c?.right), bottom: f(c?.bottom), left: f(c?.left) };
}

export interface Brand {
  primary: string;
  theme: Theme;
  headingFont: HeadingFont;
  radius: number; // 0 – 1
  shadow: number; // 0 – 1
  logoAssetId: string | null;
  logoSize: LogoSize;
  /** Style preset (see styles.ts). Projects created before styles existed open as Soft. */
  style: StyleId;
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
  /** Testimonial template. */
  quote: string;
  author: string;
  authorRole: string;
  /** Key Figures template (max LIMITS.statItems). */
  stats: Stat[];
  /** Event template. */
  eventDate: string;
  eventTime: string;
  eventPlace: string;
  cta: string;
}

export interface Stat {
  value: string;
  label: string;
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
  /** Frame drawn around desktop screenshots (Browser Hero, Browser Duo, Device Mix). */
  desktopFrame: DesktopFrame;
  /** LinkedIn carousel. With no slides, pages are generated from the project. */
  carousel: CarouselSettings;
}

/** Text a variant can replace. A missing key inherits the project's text. */
export type ContentOverrides = Partial<Pick<Content, 'kicker' | 'title' | 'subtitle'>>;
export const OVERRIDABLE_CONTENT = ['kicker', 'title', 'subtitle'] as const;

/**
 * A variant re-presents the project: its own template, optionally its own text and its own
 * selection of screenshots. Brand, background, images and template-specific content
 * (features, code, figures…) are always shared with the project, so they stay consistent.
 */
export interface Variant {
  id: string;
  template: TemplateId;
  content: ContentOverrides;
  /** Screenshot slot ids to show, in order. `null` shows the project's screenshots. */
  screenshotIds: string[] | null;
}

export interface CarouselSettings {
  /** Custom pages. Empty = automatic pages (cover, one per screenshot, features). */
  slides: Variant[];
  /** Write "2 / 5" in the kicker of every page after the cover (unless the page sets its own kicker). */
  pageNumbers: boolean;
}

/** Hard cap on carousel pages: readable in the feed and a light PDF. */
export const CAROUSEL_MAX_SLIDES = 10;

export function createVariant(init: Partial<Omit<Variant, 'id'>> = {}): Variant {
  return { id: uid('var'), template: init.template ?? 'minimal', content: { ...init.content }, screenshotIds: init.screenshotIds ?? null };
}

/** The project as seen through a variant. */
export function applyVariant(project: Project, v: Variant): Project {
  const byId = new Map(project.screenshots.map((s) => [s.id, s]));
  const screenshots =
    v.screenshotIds === null ? project.screenshots : v.screenshotIds.map((id) => byId.get(id)).filter((s): s is ScreenshotSlot => !!s);
  const overrides: ContentOverrides = {};
  for (const k of OVERRIDABLE_CONTENT) if (typeof v.content[k] === 'string') overrides[k] = v.content[k];
  return { ...project, template: v.template, screenshots, content: { ...project.content, ...overrides } };
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
      kicker: '',
      title: 'Name of your product',
      subtitle: 'One sentence on what it does for the people who use it.',
      beforeLabel: 'Before',
      afterLabel: 'After',
      features: ['First thing people can do', 'Second thing people can do', 'Third thing people can do'],
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
      // Placeholders, never invented proof: replace with a real quote and real figures.
      quote: 'Paste a real quote from someone who uses your product.',
      author: 'Their name',
      authorRole: 'Their role, their company',
      stats: [
        { value: '00', label: 'Replace with a real figure' },
        { value: '00', label: 'Replace with a real figure' },
        { value: '00', label: 'Replace with a real figure' },
      ],
      eventDate: 'Date',
      eventTime: 'Start to end time',
      eventPlace: 'Place or link',
      cta: 'Register',
    },
    brand: { primary: '#2b59c3', theme: 'light', headingFont: 'sans', radius: 0.5, shadow: 0.5, logoAssetId: null, logoSize: 'medium', style: 'minimal' },
    background: { type: STYLES.minimal.defaults.background, intensity: 0.6, angle: 135 },
    assets: [],
    screenshots: [],
    exportPresets: ['linkedin', 'open-graph', 'square', 'story', 'github'],
    customFormat: { width: 1600, height: 900 },
    devices: [...DEVICE_KINDS],
    deviceOrientation: { tablet: 'portrait', mobile: 'portrait' },
    desktopFrame: STYLES.minimal.defaults.desktopFrame,
    carousel: { slides: [], pageNumbers: true },
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
  return { id: uid('shot'), assetId, fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { ...NO_CROP }, caption: '' };
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
  // Saved before style presets existed: keep the original look (Soft, glow, browser frame).
  const legacy = brand.style === undefined;
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
          zoom: num(s.zoom, 1, ZOOM_RANGE.min, ZOOM_RANGE.max),
          focalX: num(s.focalX, 0.5, 0, 1),
          focalY: num(s.focalY, 0, 0, 1),
          crop: clampCrop(obj(s.crop)),
          caption: str(s.caption, '', LIMITS.caption).replace(/\n/g, ' '),
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
      quote: str(content.quote, d.content.quote, LIMITS.quote),
      author: str(content.author, d.content.author, LIMITS.person).replace(/\n/g, ' '),
      authorRole: str(content.authorRole, d.content.authorRole, LIMITS.person).replace(/\n/g, ' '),
      stats: Array.isArray(content.stats)
        ? content.stats
            .map(obj)
            .slice(0, LIMITS.statItems)
            .map((s) => ({
              value: str(s.value, '', LIMITS.statValue).replace(/\n/g, ' '),
              label: str(s.label, '', LIMITS.statLabel).replace(/\n/g, ' '),
            }))
        : d.content.stats,
      eventDate: str(content.eventDate, d.content.eventDate, LIMITS.eventField).replace(/\n/g, ' '),
      eventTime: str(content.eventTime, d.content.eventTime, LIMITS.eventField).replace(/\n/g, ' '),
      eventPlace: str(content.eventPlace, d.content.eventPlace, LIMITS.eventField).replace(/\n/g, ' '),
      cta: str(content.cta, d.content.cta, LIMITS.cta).replace(/\n/g, ' '),
    },
    brand: {
      primary: isHexColor(brand.primary) ? brand.primary : d.brand.primary,
      theme: oneOf(brand.theme, ['light', 'dark'] as const, d.brand.theme),
      headingFont: oneOf(brand.headingFont, ['sans', 'serif', 'rounded', 'mono'] as const, d.brand.headingFont),
      radius: num(brand.radius, d.brand.radius, 0, 1),
      shadow: num(brand.shadow, d.brand.shadow, 0, 1),
      logoAssetId: logo,
      logoSize: oneOf(brand.logoSize, LOGO_SIZES, d.brand.logoSize),
      // Projects saved before styles existed keep their original (Soft) look.
      style: legacy ? 'soft' : oneOf(brand.style, STYLE_IDS, d.brand.style),
    },
    background: {
      type: oneOf(bg.type, ['solid', 'gradient', 'glow', 'grid', 'mesh'] as const, legacy ? STYLES.soft.defaults.background : d.background.type),
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
    desktopFrame: oneOf(r.desktopFrame, DESKTOP_FRAMES, legacy ? STYLES.soft.defaults.desktopFrame : d.desktopFrame),
    carousel: migrateCarousel(obj(r.carousel), new Set(screenshots.map((x) => x.id))),
  };
}

const OVERRIDE_LIMITS: Record<(typeof OVERRIDABLE_CONTENT)[number], number> = {
  kicker: LIMITS.kicker,
  title: LIMITS.title,
  subtitle: LIMITS.subtitle,
};

function migrateCarousel(raw: Record<string, unknown>, slotIds: Set<string>): CarouselSettings {
  const slides: Variant[] = Array.isArray(raw.slides)
    ? raw.slides
        .map(obj)
        .slice(0, CAROUSEL_MAX_SLIDES)
        .map((v) => {
          const content = obj(v.content);
          const overrides: ContentOverrides = {};
          for (const k of OVERRIDABLE_CONTENT) {
            if (typeof content[k] === 'string') overrides[k] = sanitizeText(content[k] as string).slice(0, OVERRIDE_LIMITS[k]);
          }
          const template: TemplateId = v.template === 'browser-mobile' ? 'device-mix' : isTemplateId(v.template) ? v.template : 'minimal';
          const ids = Array.isArray(v.screenshotIds)
            ? [...new Set(v.screenshotIds.filter((id): id is string => typeof id === 'string' && slotIds.has(id)))]
            : null;
          return { id: typeof v.id === 'string' && v.id ? v.id : uid('var'), template, content: overrides, screenshotIds: ids };
        })
    : [];
  return { slides, pageNumbers: raw.pageNumbers !== false };
}
