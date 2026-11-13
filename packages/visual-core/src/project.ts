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
import { normalizeLegend, type LegendItem } from './legend';

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
  /** Website or handle, shown in the brand footer and on the Call to Action page. */
  link: 80,
  /** Steps template. */
  stepItems: 5,
  stepTitle: 40,
  stepText: 100,
  /** Comparison template: columns compared (besides the criteria), criteria rows, cell text. */
  compareColumns: 3,
  compareRows: 6,
  compareHeader: 30,
  compareLabel: 50,
  compareCell: 24,
  /** Enough for one image per page of a full carousel. */
  screenshots: 12,
  fileBytes: 20 * 1024 * 1024,
} as const;

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export type BackgroundType = 'solid' | 'gradient' | 'glow' | 'grid' | 'mesh' | 'image';
export const BACKGROUND_TYPES: readonly BackgroundType[] = ['solid', 'gradient', 'glow', 'grid', 'mesh', 'image'];

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
  /** Numbered fields drawn in the image, for the Annotated Panel template. Item i answers badge i + 1. */
  legend: LegendItem[];
  /**
   * Areas covered in every rendered image (names, e-mails, tenant ids…), as fractions of the
   * whole image. Non destructive: the original stays in the project and in project.json.
   */
  redact: Area[];
}

/** A rectangle as fractions (0 – 1) of an image's width and height. */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAX_REDACTIONS = 12;

export function clampArea(a: Partial<Record<keyof Area, unknown>>): Area | null {
  const f = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : NaN);
  const x = f(a.x);
  const y = f(a.y);
  const w = Math.min(f(a.w), 1 - x);
  const h = Math.min(f(a.h), 1 - y);
  return [x, y, w, h].some(Number.isNaN) || w < 0.002 || h < 0.002 ? null : { x, y, w, h };
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
export const MAGNIFY_RANGE = { min: 1.5, max: 5 } as const;

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
  /** A footer line on every visual: logo and link (and "Swipe" on carousel pages). */
  footer: boolean;
}

/** Where the text block sits. `auto` keeps the template's own placement. */
export type TextPosition = 'auto' | 'top' | 'bottom';
export const TEXT_POSITIONS: readonly TextPosition[] = ['auto', 'top', 'bottom'];
export type TextAlign = 'auto' | 'left' | 'center' | 'right';
export const TEXT_ALIGNS: readonly TextAlign[] = ['auto', 'left', 'center', 'right'];
/** Screens drawn straight, slightly rotated, or turned in perspective. */
export type Tilt = 'none' | 'tilt' | 'perspective';
export const TILTS: readonly Tilt[] = ['none', 'tilt', 'perspective'];

/**
 * Layout options shared by every template. The defaults reproduce each template's own layout,
 * so projects saved before these options existed look the same.
 */
export interface LayoutSettings {
  /** Swap left and right: the text goes to the other side (see MIRROR_TEMPLATES). */
  mirror: boolean;
  /**
   * Stacked layouts (text above the screens): `bottom` puts the text below them.
   * Side-by-side and text-only layouts: aligns the text block to the top or bottom.
   */
  textPosition: TextPosition;
  textAlign: TextAlign;
  /** See TILT_TEMPLATES. */
  tilt: Tilt;
}

export const DEFAULT_LAYOUT: LayoutSettings = { mirror: false, textPosition: 'auto', textAlign: 'auto', tilt: 'none' };

export interface Background {
  type: BackgroundType;
  /** Image background: an asset of the project, drawn full bleed under a veil of the ground colour. */
  imageAssetId: string | null;
  /** A second colour for gradient, glow and mesh grounds; null uses the brand's own accent. */
  secondary: string | null;
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
  /** Button text (Event, Call to Action). */
  cta: string;
  /** Website, page or handle. Shown in the brand footer and the Call to Action page. */
  link: string;
  /** Call to Action: draw a QR code of the link. */
  qr: boolean;
  /** Steps template (max LIMITS.stepItems). */
  steps: Step[];
  /** Comparison template. */
  compare: Comparison;
  /** Detail Zoom: how much the lens enlarges the focal point of the screenshot. */
  magnify: number;
}

export interface Step {
  title: string;
  text: string;
}

/**
 * A comparison table: criteria down the side, 2 or 3 columns across. The last column is the one
 * being recommended and is highlighted. A cell reading yes / no (in English, French or Dutch) is
 * drawn as a tick or a cross; anything else is written as is.
 */
export interface Comparison {
  columns: string[];
  rows: { label: string; cells: string[] }[];
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
  /** Mirror, text position and alignment, tilt. Shared by the carousel pages. */
  layout: LayoutSettings;
  /**
   * Runtime only, never saved: set on the project of a carousel page so the footer can invite
   * people to swipe. `migrateProject` drops it.
   */
  carouselPage?: { index: number; total: number };
}

/** Content a variant (carousel page) replaces. A missing key inherits the project's content. */
export type ContentOverrides = Partial<Content>;
/** The texts the carousel page editor offers with a "Same as project" switch. */
export const OVERRIDABLE_CONTENT = ['kicker', 'title', 'subtitle'] as const;

/**
 * A variant re-presents the project: its own template, optionally its own content (texts,
 * features, figures, steps…) and its own selection of screenshots. Brand, background and images
 * are always shared with the project, so pages stay consistent.
 */
export interface Variant {
  id: string;
  template: TemplateId;
  content: ContentOverrides;
  /** Screenshot slot ids to show, in order. `null` shows the project's screenshots. */
  screenshotIds: string[] | null;
}

/** Page shape of the carousel PDF. 4:5 is the largest in the LinkedIn feed. */
export type CarouselPageSize = '4:5' | '1:1' | '16:9';
export const CAROUSEL_PAGE_SIZES: readonly CarouselPageSize[] = ['4:5', '1:1', '16:9'];

export interface CarouselSettings {
  /** Custom pages. Empty = automatic pages (cover, one per screenshot, features). */
  slides: Variant[];
  pageSize: CarouselPageSize;
  /** Write "2 / 5" in the kicker of every page after the cover (unless the page sets its own kicker). */
  pageNumbers: boolean;
}

/** Hard cap on carousel pages: readable in the feed and a light PDF. */
export const CAROUSEL_MAX_SLIDES = 12;

export function createVariant(init: Partial<Omit<Variant, 'id'>> = {}): Variant {
  return { id: uid('var'), template: init.template ?? 'minimal', content: { ...init.content }, screenshotIds: init.screenshotIds ?? null };
}

/** The project as seen through a variant. */
export function applyVariant(project: Project, v: Variant): Project {
  const byId = new Map(project.screenshots.map((s) => [s.id, s]));
  const screenshots =
    v.screenshotIds === null ? project.screenshots : v.screenshotIds.map((id) => byId.get(id)).filter((s): s is ScreenshotSlot => !!s);
  const overrides: ContentOverrides = {};
  for (const k of CONTENT_KEYS) if (v.content[k] !== undefined) (overrides as Record<string, unknown>)[k] = v.content[k];
  return { ...project, template: v.template, screenshots, content: { ...project.content, ...overrides } };
}

export function uid(prefix = ''): string {
  const c = globalThis.crypto;
  const id = c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${id}` : id;
}

export const BRAND_COLOR_PRESETS = ['#2563eb', '#0078d4', '#7c3aed', '#742774', '#db2777', '#ea580c', '#16a34a', '#0f766e', '#111827'];

/** Formats ticked in projects saved before they depended on the template; kept for files that name none. */
const LEGACY_EXPORT_PRESETS: FormatId[] = ['linkedin', 'open-graph', 'square', 'story', 'github'];

/**
 * Formats ticked for export in a new project: two or three that suit the template, LinkedIn first.
 * Every other format stays one click away in the Export dialog.
 */
export function defaultExportPresets(template: TemplateId): FormatId[] {
  switch (template) {
    case 'mobile-trio':
    case 'app-store':
      return ['linkedin-carousel', 'story', 'square'];
    case 'before-after':
      return ['linkedin', 'linkedin-carousel', 'sharepoint-news'];
    case 'annotated':
      return ['linkedin-carousel', 'slide'];
    case 'cover':
    case 'editorial':
      return ['linkedin', 'open-graph', 'sharepoint-news'];
    case 'features':
    case 'steps':
    case 'stats':
    case 'testimonial':
    case 'comparison':
    case 'code':
    case 'cta':
    case 'minimal':
    case 'event':
      return ['linkedin-carousel', 'square', 'linkedin'];
    default:
      return ['linkedin', 'linkedin-carousel', 'open-graph'];
  }
}

/** Style of new projects: Tint stands out in a light feed without depending on a loud brand colour. */
export const DEFAULT_STYLE: StyleId = 'tint';
/**
 * Style assumed when a saved or imported project names none it knows. It stays Minimal, the default
 * when styles were added, so changing DEFAULT_STYLE never changes an existing project.
 */
const FALLBACK_STYLE: StyleId = 'minimal';

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
      // A placeholder that reads as one: no invented package or API.
      code: [
        '// Replace with a short snippet from your product.',
        'const visual = {',
        "  title: 'Name of your product',",
        "  formats: ['linkedin', 'open-graph', 'story'],",
        '};',
        '',
        'export default visual;',
      ].join('\n'),
      codeFile: 'example.ts',
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
      link: '',
      qr: false,
      steps: [
        { title: 'First step', text: 'What people do first, in one short sentence.' },
        { title: 'Second step', text: 'What happens next.' },
        { title: 'Third step', text: 'The result they get.' },
      ],
      compare: {
        columns: ['Other way', 'Your product'],
        rows: [
          { label: 'Replace with a real criterion', cells: ['no', 'yes'] },
          { label: 'Replace with a real criterion', cells: ['no', 'yes'] },
          { label: 'Replace with a real criterion', cells: ['no', 'yes'] },
        ],
      },
      magnify: 2.5,
    },
    brand: { primary: '#2b59c3', theme: 'light', headingFont: 'sans', radius: 0.5, shadow: 0.5, logoAssetId: null, logoSize: 'medium', style: DEFAULT_STYLE, footer: false },
    background: { type: STYLES[DEFAULT_STYLE].defaults.background, intensity: 0.6, angle: 135, imageAssetId: null, secondary: null },
    assets: [],
    screenshots: [],
    exportPresets: defaultExportPresets(init.template ?? 'browser-hero'),
    customFormat: { width: 1600, height: 900 },
    devices: [...DEVICE_KINDS],
    deviceOrientation: { tablet: 'portrait', mobile: 'portrait' },
    desktopFrame: STYLES[DEFAULT_STYLE].defaults.desktopFrame,
    carousel: { slides: [], pageNumbers: true, pageSize: '4:5' },
    layout: { ...DEFAULT_LAYOUT },
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
  return { id: uid('shot'), assetId, fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { ...NO_CROP }, caption: '', legend: [], redact: [] };
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
  const layout = obj(r.layout);

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
          legend: normalizeLegend(s.legend),
          redact: Array.isArray(s.redact)
            ? s.redact
                .map((a) => clampArea(obj(a)))
                .filter((a): a is Area => !!a)
                .slice(0, MAX_REDACTIONS)
            : [],
        }))
    : [];

  const migrated = migrateContent(content, d.content);

  // "Desktop + Mobile" (browser-mobile) was replaced by Device Mix with the same two devices.
  const legacyDesktopMobile = r.template === 'browser-mobile';

  const logo = typeof brand.logoAssetId === 'string' && assetIds.has(brand.logoAssetId) ? brand.logoAssetId : null;

  const presets = Array.isArray(r.exportPresets)
    ? (r.exportPresets.filter((f) => FORMAT_ORDER.includes(f as FormatId)) as FormatId[])
    : LEGACY_EXPORT_PRESETS;

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: typeof r.id === 'string' && r.id ? r.id : d.id,
    name: str(r.name, d.name, LIMITS.name) || d.name,
    createdAt: num(r.createdAt, d.createdAt, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: num(r.updatedAt, d.updatedAt, 0, Number.MAX_SAFE_INTEGER),
    revision: Math.floor(num(r.revision, 0, 0, Number.MAX_SAFE_INTEGER)),
    favorite: r.favorite === true,
    template: legacyDesktopMobile ? 'device-mix' : isTemplateId(r.template) ? r.template : d.template,
    content: migrated,
    brand: {
      primary: isHexColor(brand.primary) ? brand.primary : d.brand.primary,
      theme: oneOf(brand.theme, ['light', 'dark'] as const, d.brand.theme),
      headingFont: oneOf(brand.headingFont, ['sans', 'serif', 'rounded', 'mono'] as const, d.brand.headingFont),
      radius: num(brand.radius, d.brand.radius, 0, 1),
      shadow: num(brand.shadow, d.brand.shadow, 0, 1),
      logoAssetId: logo,
      logoSize: oneOf(brand.logoSize, LOGO_SIZES, d.brand.logoSize),
      // Projects saved before styles existed keep their original (Soft) look.
      style: legacy ? 'soft' : oneOf(brand.style, STYLE_IDS, FALLBACK_STYLE),
      footer: brand.footer === true,
    },
    background: {
      type: oneOf(bg.type, BACKGROUND_TYPES, STYLES[legacy ? 'soft' : FALLBACK_STYLE].defaults.background),
      intensity: num(bg.intensity, d.background.intensity, 0, 1),
      angle: num(bg.angle, d.background.angle, 0, 360),
      imageAssetId: typeof bg.imageAssetId === 'string' && assetIds.has(bg.imageAssetId) ? bg.imageAssetId : null,
      secondary: isHexColor(bg.secondary) ? (bg.secondary as string).toLowerCase() : null,
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
    desktopFrame: oneOf(r.desktopFrame, DESKTOP_FRAMES, STYLES[legacy ? 'soft' : FALLBACK_STYLE].defaults.desktopFrame),
    carousel: migrateCarousel(obj(r.carousel), new Set(screenshots.map((x) => x.id)), migrated),
    layout: {
      mirror: layout.mirror === true,
      textPosition: oneOf(layout.textPosition, TEXT_POSITIONS, 'auto'),
      textAlign: oneOf(layout.textAlign, TEXT_ALIGNS, 'auto'),
      tilt: oneOf(layout.tilt, TILTS, 'none'),
    },
  };
}

/** Every content field, for merging and comparing page overrides. */
export const CONTENT_KEYS = Object.keys(createProject().content) as (keyof Content)[];

const YES_NO = /^(yes|no|oui|non|ja|nee|true|false|✓|✗|x|-)$/i;
/** How a comparison cell is drawn: a tick, a cross, or its text. */
export function compareMark(cell: string): 'yes' | 'no' | 'text' {
  const v = cell.trim();
  if (!YES_NO.test(v)) return 'text';
  return /^(yes|oui|ja|true|✓)$/i.test(v) ? 'yes' : 'no';
}

const line = (v: unknown, max: number) => str(v, '', max).replace(/\s*\n\s*/g, ' ');

function migrateComparison(raw: unknown, fallback: Comparison): Comparison {
  const c = obj(raw);
  if (!Array.isArray(c.columns) || !Array.isArray(c.rows)) return fallback;
  const columns = c.columns.slice(0, LIMITS.compareColumns).map((v) => line(v, LIMITS.compareHeader));
  while (columns.length < 2) columns.push('');
  const rows = c.rows
    .map(obj)
    .slice(0, LIMITS.compareRows)
    .map((r) => {
      const cells = (Array.isArray(r.cells) ? r.cells : []).slice(0, columns.length).map((v) => line(v, LIMITS.compareCell));
      while (cells.length < columns.length) cells.push('');
      return { label: line(r.label, LIMITS.compareLabel), cells };
    });
  return { columns, rows };
}

/** Content from any (possibly older or hand edited) object; missing or invalid fields use `d`. */
function migrateContent(content: Record<string, unknown>, d: Content): Content {
  return {
    kicker: str(content.kicker, d.kicker, LIMITS.kicker),
    title: str(content.title, d.title, LIMITS.title),
    subtitle: str(content.subtitle, d.subtitle, LIMITS.subtitle),
    beforeLabel: str(content.beforeLabel, d.beforeLabel, LIMITS.label),
    afterLabel: str(content.afterLabel, d.afterLabel, LIMITS.label),
    features: Array.isArray(content.features)
      ? content.features
          .filter((f): f is string => typeof f === 'string')
          .slice(0, LIMITS.featureItems)
          .map((f) => sanitizeText(f).replace(/\n/g, ' ').slice(0, LIMITS.feature))
      : d.features,
    code: typeof content.code === 'string' ? clampCode(sanitizeText(content.code)) : d.code,
    codeFile: str(content.codeFile, d.codeFile, LIMITS.codeFile).replace(/\n/g, ' '),
    quote: str(content.quote, d.quote, LIMITS.quote),
    author: str(content.author, d.author, LIMITS.person).replace(/\n/g, ' '),
    authorRole: str(content.authorRole, d.authorRole, LIMITS.person).replace(/\n/g, ' '),
    stats: Array.isArray(content.stats)
      ? content.stats
          .map(obj)
          .slice(0, LIMITS.statItems)
          .map((s) => ({
            value: str(s.value, '', LIMITS.statValue).replace(/\n/g, ' '),
            label: str(s.label, '', LIMITS.statLabel).replace(/\n/g, ' '),
          }))
      : d.stats,
    eventDate: str(content.eventDate, d.eventDate, LIMITS.eventField).replace(/\n/g, ' '),
    eventTime: str(content.eventTime, d.eventTime, LIMITS.eventField).replace(/\n/g, ' '),
    eventPlace: str(content.eventPlace, d.eventPlace, LIMITS.eventField).replace(/\n/g, ' '),
    cta: str(content.cta, d.cta, LIMITS.cta).replace(/\n/g, ' '),
    link: str(content.link, d.link, LIMITS.link).replace(/\s+/g, ' ').trim(),
    qr: content.qr === true,
    steps: Array.isArray(content.steps)
      ? content.steps
          .map(obj)
          .slice(0, LIMITS.stepItems)
          .map((st) => ({ title: line(st.title, LIMITS.stepTitle), text: line(st.text, LIMITS.stepText) }))
      : d.steps,
    compare: migrateComparison(content.compare, d.compare),
    magnify: num(content.magnify, d.magnify, MAGNIFY_RANGE.min, MAGNIFY_RANGE.max),
  };
}

/** A carousel page's own content: only the keys it sets, each validated like the project's. */
export function migrateContentOverrides(raw: Record<string, unknown>, base: Content): ContentOverrides {
  const full = migrateContent(raw, base);
  const out: ContentOverrides = {};
  for (const k of CONTENT_KEYS) if (raw[k] !== undefined) (out as Record<string, unknown>)[k] = full[k];
  return out;
}


function migrateCarousel(raw: Record<string, unknown>, slotIds: Set<string>, base: Content): CarouselSettings {
  const slides: Variant[] = Array.isArray(raw.slides)
    ? raw.slides
        .map(obj)
        .slice(0, CAROUSEL_MAX_SLIDES)
        .map((v) => {
          const overrides = migrateContentOverrides(obj(v.content), base);
          const template: TemplateId = v.template === 'browser-mobile' ? 'device-mix' : isTemplateId(v.template) ? v.template : 'minimal';
          const ids = Array.isArray(v.screenshotIds)
            ? [...new Set(v.screenshotIds.filter((id): id is string => typeof id === 'string' && slotIds.has(id)))]
            : null;
          return { id: typeof v.id === 'string' && v.id ? v.id : uid('var'), template, content: overrides, screenshotIds: ids };
        })
    : [];
  return { slides, pageNumbers: raw.pageNumbers !== false, pageSize: oneOf(raw.pageSize, CAROUSEL_PAGE_SIZES, '4:5') };
}
