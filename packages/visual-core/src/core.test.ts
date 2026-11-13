import { describe, expect, it } from 'vitest';
import {
  carouselFormat,
  getStyle,
  STYLE_IDS,
  inkOn,
  hexToRgb,
  analyzeCarousel,
  buildCarouselSlides,
  createVariant,
  CAROUSEL_MAX_SLIDES,
  createScreenshotSlot,
  analyzeProject,
  contrastRatio,
  clampCode,
  createProject,
  fitCodeFontSize,
  derivePalette,
  FORMAT_PRESETS,
  getOrientation,
  isScaleReasonable,
  migrateProject,
  normalizeDevices,
  resolveFormat,
  screenshotRange,
  sanitizeText,
  DEFAULT_LAYOUT,
  MIRROR_TEMPLATES,
  TILT_TEMPLATES,
  TEMPLATES,
  applyVariant,
  compareMark,
  clampArea,
  FORMAT_GROUPS,
  FORMAT_ORDER,
  applyBrandKit,
  brandKitFromProject,
  migrateBrandKit,
  backgroundPeak,
  withStyle,
  placeholderFields,
  addPlaceholderTexts,
  isPlaceholder,
  defaultExportPresets,
} from './index';

describe('Tint and Technical palettes', () => {
  const brands = ['#2563eb', '#facc15', '#0f766e', '#e11d48', '#111827', '#ffffff'];

  it('inkOn reaches the asked contrast and keeps the hue', () => {
    for (const c of brands) {
      for (const ground of ['#ffffff', '#0b0c10']) {
        expect(contrastRatio(inkOn(c, ground, 7), ground), `${c} on ${ground}`).toBeGreaterThanOrEqual(7);
      }
    }
    const ink = hexToRgb(inkOn('#2563eb', '#ffffff', 7));
    expect(ink.b).toBeGreaterThan(ink.r); // still blue, not black
  });

  it('Tint keeps body and muted text readable, and its mat differs from the ground', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const c of brands) {
        const p = derivePalette(c, theme, 'tint');
        expect(contrastRatio(p.text, p.bg), `text ${theme} ${c}`).toBeGreaterThanOrEqual(9);
        expect(contrastRatio(p.textMuted, p.bg), `muted ${theme} ${c}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(p.primarySoft, p.bg), `mat ${theme} ${c}`).toBeGreaterThanOrEqual(1.08);
      }
    }
  });

  it('Technical sits on a white (or near-black) ground whatever the brand', () => {
    expect(derivePalette('#e11d48', 'light', 'technical').bg).toBe('#ffffff');
    expect(derivePalette('#e11d48', 'dark', 'technical').bg).toBe('#0e0f12');
  });
});

describe('formats', () => {
  it('detects orientation', () => {
    expect(getOrientation(1200, 627)).toBe('landscape');
    expect(getOrientation(1080, 1080)).toBe('square');
    expect(getOrientation(1080, 1920)).toBe('portrait');
  });

  it('clamps custom sizes', () => {
    const f = resolveFormat('custom', { width: 10, height: 99999 });
    expect(f.width).toBe(64);
    expect(f.height).toBe(4096);
  });

  it('limits huge exports', () => {
    expect(isScaleReasonable(1200, 627, 3)).toBe(true);
    expect(isScaleReasonable(4096, 4096, 3)).toBe(false);
  });
});

describe('color', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('derives readable palettes for both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const c of ['#2563eb', '#facc15', '#111827', '#ffffff']) {
        for (const style of STYLE_IDS) {
          const p = derivePalette(c, theme, style);
          expect(contrastRatio(p.text, p.bg), `${style} ${theme} ${c}`).toBeGreaterThan(4.5);
        }
      }
    }
  });
});

describe('project migration', () => {
  it('round trips a fresh project', () => {
    const p = createProject({ name: 'Cockpit' });
    expect(migrateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('migrates legacy 0.x projects with root title', () => {
    const p = migrateProject({ schemaVersion: '0.9', name: 'Old', title: 'Hello', subtitle: 'World' });
    expect(p.schemaVersion).toBe('1.0');
    expect(p.content.title).toBe('Hello');
    expect(p.content.subtitle).toBe('World');
  });

  it('drops invalid values and dangling references', () => {
    const p = migrateProject({
      template: 'nope',
      brand: { primary: 'red', logoAssetId: 'missing' },
      screenshots: [{ assetId: 'missing' }],
      exportPresets: ['linkedin', 'bogus', 'linkedin'],
      background: { intensity: 7 },
    });
    expect(p.template).toBe('browser-hero');
    expect(p.brand.primary).toBe(createProject().brand.primary);
    expect(p.brand.logoAssetId).toBeNull();
    expect(p.screenshots).toHaveLength(0);
    expect(p.exportPresets).toEqual(['linkedin']);
    expect(p.background.intensity).toBe(1);
  });

  it('rejects non objects', () => {
    expect(() => migrateProject(null)).toThrow();
    expect(() => migrateProject([1])).toThrow();
  });

  it('strips control characters', () => {
    expect(sanitizeText('a\u0000b\nc')).toBe('ab\nc');
  });
});

describe('features and code content', () => {
  it('migrates features and code safely', () => {
    const p = migrateProject({
      content: { features: ['a', 42, 'b\nc', 'd', 'e', 'f'], code: 'x\ty\r\n' + 'z\n'.repeat(40), codeFile: 'f.ts' },
    });
    expect(p.content.features).toEqual(['a', 'b c', 'd', 'e']);
    expect(p.content.code.split('\n')).toHaveLength(20);
    expect(p.content.code.startsWith('x  y\n')).toBe(true);
    expect(p.content.codeFile).toBe('f.ts');
  });

  it('keeps defaults for old projects without these fields', () => {
    const p = migrateProject({ content: { title: 'Old' } });
    expect(p.content.features.length).toBeGreaterThan(0);
    expect(p.content.code).toContain('Replace with a short snippet');
  });

  it('clamps code length', () => {
    expect(clampCode('a'.repeat(5000)).length).toBe(1500);
  });

  it('fits code into its box', () => {
    const code = 'const x = 1;\n'.repeat(10);
    expect(fitCodeFontSize(code, 600, 400, 30)).toBeLessThanOrEqual(30);
    const wide = 'x'.repeat(120);
    const size = fitCodeFontSize(wide, 600, 400, 30);
    expect((120 + 4) * 0.62 * size).toBeLessThanOrEqual(600.0001);
  });
});

describe('rules', () => {
  it('flags a long title and missing screenshots', () => {
    const p = createProject();
    p.content.title = 'x'.repeat(80);
    const ids = analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id);
    expect(ids).toContain('title-long');
    expect(ids).toContain('shots-missing');
  });

  it('suggests a phone template for portrait screenshots', () => {
    const p = createProject({ template: 'browser-hero' });
    p.assets.push({ id: 'a', name: 'phone.png', mime: 'image/png', width: 1170, height: 2532, size: 1 });
    p.screenshots.push({ id: 's', assetId: 'a', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '', legend: [], redact: [] });
    const s = analyzeProject(p, FORMAT_PRESETS.linkedin).find((x) => x.id === 'tpl-orientation');
    expect(s?.action?.template).toBe('mobile-trio');
  });

  it('flags empty features and wide code', () => {
    const p = createProject({ template: 'features' });
    p.content.features = ['', ' '];
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).toContain('features-empty');
    p.template = 'code';
    p.content.code = 'x'.repeat(90);
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).toContain('code-wide');
  });

  it('warns about small images', () => {
    const p = createProject({ template: 'spotlight' });
    p.assets.push({ id: 'a', name: 'tiny.png', mime: 'image/png', width: 300, height: 200, size: 1 });
    p.screenshots.push({ id: 's', assetId: 'a', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '', legend: [], redact: [] });
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin, 2).map((s) => s.id)).toContain('shot-small');
  });
});

describe('device mix', () => {
  it('normalizes the device list', () => {
    expect(normalizeDevices(['mobile', 'desktop', 'mobile'])).toEqual(['desktop', 'mobile']);
    expect(normalizeDevices(['tablet'])).toEqual(['desktop', 'tablet', 'mobile']); // below the minimum
    expect(normalizeDevices('nope')).toEqual(['desktop', 'tablet', 'mobile']);
    expect(migrateProject({ devices: ['tablet', 'phone', 'mobile'] }).devices).toEqual(['tablet', 'mobile']);
    expect(migrateProject({}).devices).toEqual(['desktop', 'tablet', 'mobile']); // older files
  });

  it('turns the retired Desktop + Mobile template into Device Mix', () => {
    const p = migrateProject({ template: 'browser-mobile', devices: ['tablet', 'mobile'] });
    expect(p.template).toBe('device-mix');
    expect(p.devices).toEqual(['desktop', 'mobile']);
  });

  it('expects one screenshot per selected device', () => {
    expect(screenshotRange({ template: 'device-mix', devices: ['desktop', 'mobile'] })).toEqual({ min: 2, max: 2 });
    expect(screenshotRange({ template: 'device-mix', devices: ['desktop', 'tablet', 'mobile'] })).toEqual({ min: 3, max: 3 });
    expect(screenshotRange({ template: 'spotlight', devices: [] })).toEqual({ min: 1, max: 1 });
    const p = createProject({ template: 'device-mix' });
    p.devices = ['tablet', 'mobile'];
    const msg = analyzeProject(p, FORMAT_PRESETS.linkedin).find((x) => x.id === 'shots-missing')?.message;
    expect(msg).toContain('at least 2');
  });

  it('keeps tablet and phone orientation, defaulting to portrait', () => {
    expect(createProject().deviceOrientation).toEqual({ tablet: 'portrait', mobile: 'portrait' });
    expect(migrateProject({ deviceOrientation: { tablet: 'landscape', mobile: 'sideways' } }).deviceOrientation).toEqual({
      tablet: 'landscape',
      mobile: 'portrait',
    });
    expect(migrateProject({}).deviceOrientation).toEqual({ tablet: 'portrait', mobile: 'portrait' });
  });

  it('matches the orientation hint to a turned phone', () => {
    const p = createProject({ template: 'device-mix' });
    p.devices = ['tablet', 'mobile'];
    p.assets.push({ id: 'a', name: 'a.png', mime: 'image/png', width: 1600, height: 1000, size: 1 });
    p.assets.push({ id: 'b', name: 'wide.png', mime: 'image/png', width: 1600, height: 900, size: 1 });
    p.screenshots.push({ id: 's1', assetId: 'a', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '', legend: [], redact: [] });
    p.screenshots.push({ id: 's2', assetId: 'b', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '', legend: [], redact: [] });
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).toContain('device-fit-1'); // wide shot, upright phone
    p.deviceOrientation.mobile = 'landscape';
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).not.toContain('device-fit-1');
  });

  it('flags a phone screenshot in the desktop frame', () => {
    const p = createProject({ template: 'device-mix' });
    p.devices = ['desktop', 'mobile'];
    p.assets.push({ id: 'a', name: 'phone.png', mime: 'image/png', width: 1170, height: 2532, size: 1 });
    p.assets.push({ id: 'b', name: 'phone2.png', mime: 'image/png', width: 1170, height: 2532, size: 1 });
    p.screenshots.push({ id: 's1', assetId: 'a', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '', legend: [], redact: [] });
    p.screenshots.push({ id: 's2', assetId: 'b', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '', legend: [], redact: [] });
    const ids = analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id);
    expect(ids).toContain('device-fit-0');
    expect(ids).not.toContain('device-fit-1');
  });
});

describe('screenshot crop and logo size', () => {
  it('clamps crop and zoom on import', () => {
    const p = migrateProject({
      assets: [{ id: 'a', width: 100, height: 100 }],
      screenshots: [{ assetId: 'a', zoom: 0.1, crop: { top: 0.2, right: 0.9, bottom: -1, left: 'x' } }],
    });
    expect(p.screenshots[0].zoom).toBe(0.5);
    expect(p.screenshots[0].crop).toEqual({ top: 0.2, right: 0.45, bottom: 0, left: 0 });
    // Older files without a crop.
    const old = migrateProject({ assets: [{ id: 'a', width: 1, height: 1 }], screenshots: [{ assetId: 'a' }] });
    expect(old.screenshots[0].crop).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('defaults the logo to medium and keeps a valid size', () => {
    expect(createProject().brand.logoSize).toBe('medium');
    expect(migrateProject({ brand: { logoSize: 'large' } }).brand.logoSize).toBe('large');
    expect(migrateProject({ brand: { logoSize: 'huge' } }).brand.logoSize).toBe('medium');
  });

  it('warns when the logo file is too small for the export', () => {
    const p = createProject();
    p.assets.push({ id: 'l', name: 'logo.png', mime: 'image/png', width: 40, height: 40, size: 1 });
    p.brand.logoAssetId = 'l';
    expect(analyzeProject(p, FORMAT_PRESETS.square, 1).map((s) => s.id)).toContain('logo-small'); // ~70px shown
    p.assets[0] = { ...p.assets[0], width: 512, height: 512 };
    expect(analyzeProject(p, FORMAT_PRESETS.square, 3).map((s) => s.id)).not.toContain('logo-small');
  });
});

describe('desktop frame', () => {
  it('defaults to the style frame and keeps a valid choice', () => {
    expect(createProject().desktopFrame).toBe('window'); // Tint, the default style
    expect(migrateProject({ desktopFrame: 'laptop' }).desktopFrame).toBe('laptop');
    expect(migrateProject({ desktopFrame: 'tv' }).desktopFrame).toBe('browser'); // legacy project: Soft default
    expect(migrateProject({ brand: { style: 'minimal' }, desktopFrame: 'tv' }).desktopFrame).toBe('plain');
    // An unknown style falls back to Minimal, as before Tint became the default.
    expect(migrateProject({ brand: { style: 'neon' }, desktopFrame: 'tv' }).desktopFrame).toBe('plain');
  });
});

describe('testimonial, key figures and event', () => {
  it('migrates the new content fields with defaults and limits', () => {
    const d = createProject();
    expect(migrateProject({}).content.quote).toBe(d.content.quote);
    const p = migrateProject({
      content: {
        stats: [{ value: '1234567890123456', label: 'x' }, { value: '2', label: 'y' }, {}, {}, { value: '5', label: 'z' }],
        author: 'A\nB',
        eventDate: 'Mon 1 Jan',
      },
    });
    expect(p.content.stats).toHaveLength(4);
    expect(p.content.stats[0].value).toHaveLength(12);
    expect(p.content.author).toBe('A B');
    expect(p.content.eventDate).toBe('Mon 1 Jan');
  });

  it('checks the template-specific content', () => {
    const t = createProject({ template: 'testimonial' });
    t.content.author = '';
    const ids = analyzeProject(t, FORMAT_PRESETS.linkedin).map((s) => s.id);
    expect(ids).toContain('quote-author');
    expect(ids).not.toContain('title-empty'); // the title is not used by this template
    const k = createProject({ template: 'stats' });
    k.content.stats = [{ value: '10k', label: '' }];
    const kids = analyzeProject(k, FORMAT_PRESETS.linkedin).map((s) => s.id);
    expect(kids).toContain('stats-few');
    expect(kids).toContain('stats-label');
  });
});

describe('LinkedIn carousel', () => {
  const withShots = () => {
    const p = createProject({ template: 'browser-hero' });
    p.assets.push(
      { id: 'd', name: 'desktop.png', mime: 'image/png', width: 1600, height: 1000, size: 1 },
      { id: 'm', name: 'phone.png', mime: 'image/png', width: 1170, height: 2532, size: 1 },
    );
    p.screenshots.push({ ...createScreenshotSlot('d'), id: 'sd', caption: 'Dashboard' }, { ...createScreenshotSlot('m'), id: 'sm' });
    return p;
  };
  const templates = (p: ReturnType<typeof withShots>) => buildCarouselSlides(p).map((s) => s.variant.template);

  it('generates cover, one page per screenshot and features automatically', () => {
    const p = withShots();
    p.content.features = ['Invoices in two clicks', 'Exports to Excel'];
    const slides = buildCarouselSlides(p);
    expect(templates(p)).toEqual(['browser-hero', 'spotlight', 'mobile-trio', 'features']);
    expect(slides.every((s) => s.auto)).toBe(true);
    expect(slides[1].project.content.title).toBe('Dashboard');
    expect(slides[1].project.screenshots.map((x) => x.id)).toEqual(['sd']);
    expect(slides[2].label).toBe('Mobile Trio');
    expect(slides[0].project.content.kicker).toBe(p.content.kicker); // cover keeps its kicker
    expect(slides[3].project.content.kicker).toBe('4 / 4');
  });

  it('skips the features page while it only holds the example features', () => {
    const p = withShots();
    expect(templates(p)).not.toContain('features');
    p.content.features = ['First thing people can do', 'Invoices in two clicks'];
    expect(templates(p)).toContain('features');
  });

  it('skips the features page when empty or already the cover', () => {
    const p = withShots();
    p.content.features = ['', ' '];
    expect(templates(p)).not.toContain('features');
    const q = withShots();
    q.template = 'features';
    expect(templates(q).filter((t) => t === 'features')).toHaveLength(1);
  });

  it('uses custom pages with their own template, text and screenshots', () => {
    const p = withShots();
    p.carousel.slides = [
      createVariant({ template: 'minimal', content: { title: 'Hook' } }),
      createVariant({ template: 'spotlight', screenshotIds: ['sm', 'missing'] }),
      createVariant({ template: 'event', content: { kicker: 'Try it' } }),
    ];
    const slides = buildCarouselSlides(p);
    expect(slides.map((s) => s.auto)).toEqual([false, false, false]);
    expect(slides[0].project.content.title).toBe('Hook');
    expect(slides[0].project.content.subtitle).toBe(p.content.subtitle); // inherited
    expect(slides[1].project.screenshots.map((x) => x.id)).toEqual(['sm']); // unknown id ignored
    expect(slides[1].project.content.kicker).toBe('2 / 3');
    expect(slides[2].project.content.kicker).toBe('Try it'); // own kicker wins over numbering
    expect(slides[0].project.brand).toBe(p.brand); // brand shared
  });

  it('can turn page numbers off', () => {
    const p = withShots();
    p.carousel.pageNumbers = false;
    expect(buildCarouselSlides(p)[1].project.content.kicker).toBe(p.content.kicker);
  });

  it('caps the number of pages', () => {
    const p = withShots();
    for (let i = 0; i < 20; i++) p.screenshots.push(createScreenshotSlot('d'));
    expect(buildCarouselSlides(p).length).toBeLessThanOrEqual(CAROUSEL_MAX_SLIDES);
    p.carousel.slides = Array.from({ length: 15 }, () => createVariant());
    expect(buildCarouselSlides(p).length).toBe(CAROUSEL_MAX_SLIDES);
  });

  it('advises on page count, missing screenshots and a closing page', () => {
    const p = withShots();
    p.carousel.slides = [createVariant({ template: 'browser-duo', screenshotIds: ['sd'] })];
    const ids = analyzeCarousel(p).map((s) => s.id);
    expect(ids).toContain('carousel-short');
    expect(ids).toContain('carousel-shots-0');
    expect(analyzeCarousel(withShots()).map((s) => s.id)).toContain('carousel-cta');
  });

  it('migrates captions and carousel pages safely', () => {
    const p = migrateProject({
      assets: [{ id: 'a', mime: 'image/png' }],
      screenshots: [{ id: 's1', assetId: 'a', caption: 'x'.repeat(200) + '\nnext' }, { assetId: 'a' }],
      carousel: {
        pageNumbers: false,
        slides: [
          { template: 'nope', content: { title: 'T', foo: 1, subtitle: 3 }, screenshotIds: ['s1', 'ghost', 's1'] },
          { template: 'browser-mobile', screenshotIds: 'all' },
          ...Array.from({ length: 20 }, () => ({ template: 'minimal' })),
        ],
      },
    });
    expect(p.screenshots[0].caption.length).toBe(90);
    expect(p.screenshots[1].caption).toBe('');
    expect(p.carousel.pageNumbers).toBe(false);
    expect(p.carousel.slides).toHaveLength(CAROUSEL_MAX_SLIDES);
    expect(p.carousel.slides[0]).toMatchObject({ template: 'minimal', content: { title: 'T' }, screenshotIds: ['s1'] });
    expect(p.carousel.slides[1]).toMatchObject({ template: 'device-mix', screenshotIds: null });
    expect(migrateProject({}).carousel).toEqual({ slides: [], pageNumbers: true, pageSize: '4:5' });
  });
});

describe('style presets', () => {
  it('new projects use Tint with honest placeholders', () => {
    const p = createProject();
    expect(p.brand.style).toBe('tint');
    expect(p.background.type).toBe('solid');
    expect(p.content.kicker).toBe('');
    expect(p.content.stats.every((s) => !/\d[1-9]/.test(s.value))).toBe(true); // no invented figures
    expect(p.content.quote).toMatch(/real quote/);
  });

  it('saved projects keep their style when the default changes', () => {
    expect(migrateProject({ brand: { style: 'minimal' } }).brand.style).toBe('minimal');
    expect(migrateProject({ brand: { style: 'neon' } }).brand.style).toBe('minimal');
  });

  it('projects saved before styles keep their original look', () => {
    const p = migrateProject({ brand: { primary: '#123456' } });
    expect(p.brand.style).toBe('soft');
    expect(p.background.type).toBe('glow');
    expect(p.desktopFrame).toBe('browser');
  });

  it('rejects unknown styles', () => {
    expect(migrateProject({ brand: { style: 'neon' } }).brand.style).toBe('minimal');
    expect(getStyle('nope').id).toBe('minimal');
  });

  it('only Soft drifts the accent toward another hue', () => {
    const blue = '#2563eb';
    const hue = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      if (!d) return 0;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    expect(Math.abs(hue(derivePalette(blue, 'light', 'minimal').accent) - hue(blue))).toBeLessThan(3);
    expect(Math.abs(hue(derivePalette(blue, 'light', 'soft').accent) - hue(blue))).toBeGreaterThan(30);
  });

  it('Bold paints the brand as ground and checks its contrast', () => {
    const p = createProject();
    p.brand.style = 'bold';
    p.brand.primary = '#facc15'; // light yellow: text must switch to dark ink
    const pal = derivePalette(p.brand.primary, 'light', 'bold');
    expect(pal.bg).toBe('#facc15');
    expect(contrastRatio(pal.text, pal.bg)).toBeGreaterThan(4.5);
  });
});

describe('carousel page size', () => {
  it('defaults to 4:5, keeps a valid size and maps it to a format', () => {
    const p = createProject();
    expect(p.carousel.pageSize).toBe('4:5');
    expect(carouselFormat(p)).toBe('linkedin-carousel');
    expect(migrateProject({ carousel: { pageSize: '16:9' } }).carousel.pageSize).toBe('16:9');
    expect(migrateProject({ carousel: { pageSize: '3:2' } }).carousel.pageSize).toBe('4:5');
    p.carousel.pageSize = '1:1';
    expect(carouselFormat(p)).toBe('square');
    p.carousel.pageSize = '16:9';
    expect(carouselFormat(p)).toBe('thumbnail');
  });

  it('advises against 16:9 pages', () => {
    const p = createProject();
    expect(analyzeCarousel(p).map((s) => s.id)).not.toContain('carousel-wide');
    p.carousel.pageSize = '16:9';
    expect(analyzeCarousel(p).map((s) => s.id)).toContain('carousel-wide');
  });
});

describe('layout options', () => {
  it('default to the template layout, also for projects saved before they existed', () => {
    expect(createProject().layout).toEqual(DEFAULT_LAYOUT);
    expect(migrateProject({}).layout).toEqual({ mirror: false, textPosition: 'auto', textAlign: 'auto', tilt: 'none' });
  });

  it('keep valid choices and drop invalid ones', () => {
    expect(migrateProject({ layout: { mirror: true, textPosition: 'bottom', textAlign: 'right', tilt: 'perspective' } }).layout).toEqual({
      mirror: true,
      textPosition: 'bottom',
      textAlign: 'right',
      tilt: 'perspective',
    });
    expect(migrateProject({ layout: { mirror: 'yes', textPosition: 'middle', textAlign: 'justify', tilt: 45 } }).layout).toEqual(DEFAULT_LAYOUT);
    expect(migrateProject({ layout: 'mirror' }).layout).toEqual(DEFAULT_LAYOUT);
  });

  it('round trip and are shared by the carousel pages', () => {
    const p = createProject();
    p.layout = { mirror: true, textPosition: 'top', textAlign: 'center', tilt: 'tilt' };
    expect(migrateProject(JSON.parse(JSON.stringify(p))).layout).toEqual(p.layout);
    expect(applyVariant(p, createVariant({ template: 'browser-hero' })).layout).toEqual(p.layout);
  });

  it('offer mirror and tilt only where they change something', () => {
    const ids = TEMPLATES.map((t) => t.id);
    for (const id of [...MIRROR_TEMPLATES, ...TILT_TEMPLATES]) expect(ids).toContain(id);
    // Centred templates look the same mirrored.
    for (const id of ['app-store', 'minimal', 'testimonial'] as const) expect(MIRROR_TEMPLATES).not.toContain(id);
    // Full-bleed images, grids, legends and text-only templates stay straight.
    for (const id of ['editorial', 'bento', 'annotated', 'stats', 'features', 'minimal'] as const) expect(TILT_TEMPLATES).not.toContain(id);
  });
});

describe('brand footer and call to action', () => {
  it('migrates the link, QR and footer with safe defaults', () => {
    const p = migrateProject({});
    expect([p.content.link, p.content.qr, p.brand.footer]).toEqual(['', false, false]);
    const q = migrateProject({ brand: { footer: true }, content: { link: '  https://example.com/a\nb  ', qr: true } });
    expect([q.content.link, q.content.qr, q.brand.footer]).toEqual(['https://example.com/a b', true, true]);
    expect(migrateProject({ content: { link: 'x'.repeat(200), qr: 'yes' } }).content).toMatchObject({ link: 'x'.repeat(80), qr: false });
  });

  it('tells each carousel page where it is, without saving it', () => {
    const p = createProject();
    const slides = buildCarouselSlides(p);
    expect(slides.map((s) => s.project.carouselPage)).toEqual(slides.map((_, i) => ({ index: i, total: slides.length })));
    expect(migrateProject({ ...p, carouselPage: { index: 1, total: 3 } })).not.toHaveProperty('carouselPage');
  });

  it('checks the call to action and the footer', () => {
    const p = createProject({ template: 'cta' });
    p.content.cta = '';
    p.content.qr = true;
    const ids = analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['cta-empty', 'cta-qr']));
    p.brand.footer = true;
    expect(analyzeProject(p, FORMAT_PRESETS.story).map((s) => s.id)).toEqual(expect.arrayContaining(['footer-empty', 'footer-covered']));
  });

  it('suggests a Call to Action page to close a carousel', () => {
    const p = createProject();
    p.carousel.slides = [createVariant({ template: 'minimal' }), createVariant({ template: 'spotlight' }), createVariant({ template: 'features' })];
    expect(analyzeCarousel(p).map((s) => s.id)).toContain('carousel-cta');
    p.carousel.slides.push(createVariant({ template: 'cta' }));
    expect(analyzeCarousel(p).map((s) => s.id)).not.toContain('carousel-cta');
  });
});

describe('carousel page content, steps and comparison', () => {
  it('lets a page replace any content field, validated like the project', () => {
    const p = createProject();
    p.carousel.slides = [createVariant({ template: 'features', content: { features: ['Only here'] } })];
    const m = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(m.carousel.slides[0].content).toEqual({ features: ['Only here'] });
    expect(applyVariant(m, m.carousel.slides[0]).content.features).toEqual(['Only here']);
    expect(m.content.features).toEqual(createProject().content.features); // the project is untouched

    const raw = { carousel: { slides: [{ template: 'steps', content: { steps: [{ title: 'x'.repeat(99), text: 7 }], bogus: 1, qr: true } }] } };
    expect(migrateProject(raw).carousel.slides[0].content).toEqual({ steps: [{ title: 'x'.repeat(40), text: '' }], qr: true });
  });

  it('keeps old pages that only replaced their texts', () => {
    const m = migrateProject({ carousel: { slides: [{ template: 'minimal', content: { title: 'Hook', subtitle: '' } }] } });
    expect(m.carousel.slides[0].content).toEqual({ title: 'Hook', subtitle: '' });
  });

  it('normalises comparison tables', () => {
    const m = migrateProject({ content: { compare: { columns: ['A', 'B', 'C', 'D'], rows: [{ label: 'Speed', cells: ['fast'] }] } } });
    expect(m.content.compare).toEqual({ columns: ['A', 'B', 'C'], rows: [{ label: 'Speed', cells: ['fast', '', ''] }] });
    expect(migrateProject({ content: { compare: { columns: ['Only'], rows: [] } } }).content.compare.columns).toEqual(['Only', '']);
    expect(migrateProject({ content: { compare: 'table' } }).content.compare).toEqual(createProject().content.compare);
  });

  it('reads yes and no in English, French and Dutch', () => {
    expect(['yes', 'Oui', 'ja', '✓'].map(compareMark)).toEqual(['yes', 'yes', 'yes', 'yes']);
    expect(['no', 'NON', 'nee', '-', '✗'].map(compareMark)).toEqual(['no', 'no', 'no', 'no', 'no']);
    expect(compareMark('€29/mo')).toBe('text');
  });

  it('checks steps and comparisons', () => {
    const p = createProject({ template: 'steps' });
    p.content.steps = [{ title: 'Only one', text: '' }];
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).toContain('steps-few');
    const q = createProject({ template: 'comparison' });
    q.content.compare = { columns: ['', 'Ours'], rows: [{ label: 'Speed', cells: ['', 'yes'] }] };
    expect(analyzeProject(q, FORMAT_PRESETS.linkedin).map((s) => s.id)).toEqual(expect.arrayContaining(['compare-few', 'compare-header', 'compare-empty']));
  });
});

describe('hidden areas, Detail Zoom and Cover', () => {
  it('keeps hidden areas inside the image and drops invalid ones', () => {
    expect(clampArea({ x: 0.9, y: -1, w: 0.5, h: 0.2 })).toEqual({ x: 0.9, y: 0, w: expect.closeTo(0.1, 6), h: 0.2 });
    expect(clampArea({ x: 0.1, y: 0.1, w: 0, h: 0.5 })).toBeNull();
    expect(clampArea({ x: 'a', y: 0, w: 1, h: 1 })).toBeNull();
    const m = migrateProject({
      assets: [{ id: 'a', name: 'a.png', mime: 'image/png', width: 10, height: 10, size: 1 }],
      screenshots: [{ assetId: 'a', redact: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, { x: 2 }, 'box', ...Array(20).fill({ x: 0, y: 0, w: 0.1, h: 0.1 })] }],
    });
    expect(m.screenshots[0].redact).toHaveLength(12);
    expect(m.screenshots[0].redact[0]).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.1 });
    expect(migrateProject({ assets: [{ id: 'a' }], screenshots: [{ assetId: 'a' }] }).screenshots[0].redact).toEqual([]);
  });

  it('clamps the magnification', () => {
    expect(createProject().content.magnify).toBe(2.5);
    expect(migrateProject({ content: { magnify: 40 } }).content.magnify).toBe(5);
    expect(migrateProject({ content: { magnify: 'big' } }).content.magnify).toBe(2.5);
  });

  it('asks for a focal point to magnify and an image for the cover', () => {
    const p = createProject({ template: 'detail-zoom' });
    p.assets.push({ id: 'a', name: 'a', mime: 'image/png', width: 1600, height: 1000, size: 1 });
    p.screenshots.push(createScreenshotSlot('a'));
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).toContain('zoom-focal');
    p.screenshots[0].focalX = 0.2;
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).not.toContain('zoom-focal');
    expect(analyzeProject(createProject({ template: 'cover' }), FORMAT_PRESETS.linkedin).map((s) => s.id)).toContain('cover-image');
  });
});

describe('format groups', () => {
  it('list every format once, by use', () => {
    expect([...FORMAT_ORDER].sort()).toEqual(Object.keys(FORMAT_PRESETS).sort());
    expect(new Set(FORMAT_ORDER).size).toBe(FORMAT_ORDER.length);
    expect(FORMAT_GROUPS.flatMap((g) => g.formats)).toEqual(FORMAT_ORDER);
  });

  it('draw YouTube channel art inside the band every device shows', () => {
    const yt = FORMAT_PRESETS['youtube-banner'];
    expect(yt.content).toEqual(yt.safe);
    expect(Math.round(yt.width * (1 - yt.safe.left - yt.safe.right))).toBe(1546);
    expect(Math.round(yt.height * (1 - yt.safe.top - yt.safe.bottom))).toBe(423);
  });

  it('keep every content area inside the image', () => {
    for (const f of Object.values(FORMAT_PRESETS)) {
      if (!f.content) continue;
      expect(f.content.left + f.content.right).toBeLessThan(1);
      expect(f.content.top + f.content.bottom).toBeLessThan(1);
    }
  });
});

describe('brand kits', () => {
  const branded = () => {
    const p = createProject();
    p.assets.push({ id: 'logo1', name: 'logo.png', mime: 'image/png', width: 512, height: 512, size: 2048 });
    p.brand = { ...p.brand, primary: '#0f766e', style: 'bold', logoAssetId: 'logo1', footer: true, radius: 0.2 };
    p.background = { type: 'mesh', intensity: 0.3, angle: 90, imageAssetId: null, secondary: null };
    p.desktopFrame = 'laptop';
    p.content.link = 'example.com';
    return p;
  };

  it('captures the identity, not the content', () => {
    const kit = brandKitFromProject(branded(), '  Teal  ');
    expect(kit.name).toBe('Teal');
    expect(kit.brand).toMatchObject({ primary: '#0f766e', style: 'bold', footer: true, radius: 0.2 });
    expect(kit.brand).not.toHaveProperty('logoAssetId');
    expect(kit.logo).toEqual({ name: 'logo.png', mime: 'image/png', width: 512, height: 512, size: 2048 });
    expect([kit.background.type, kit.desktopFrame, kit.link]).toEqual(['mesh', 'laptop', 'example.com']);
  });

  it('dresses another project, with the logo stored for it', () => {
    const kit = brandKitFromProject(branded(), 'Teal');
    const target = createProject();
    target.content.title = 'Mine';
    const logo = { id: 'new-logo', name: 'logo.png', mime: 'image/png', width: 512, height: 512, size: 2048 };
    const out = applyBrandKit(target, kit, logo);
    expect(out.brand).toMatchObject({ primary: '#0f766e', style: 'bold', logoAssetId: 'new-logo' });
    expect(out.assets.map((a) => a.id)).toEqual(['new-logo']);
    expect([out.content.title, out.content.link, out.desktopFrame]).toEqual(['Mine', 'example.com', 'laptop']);
    // A kit without a logo removes none: the project keeps its own.
    const noLogo = { ...kit, logo: null };
    const own = { ...createProject(), brand: { ...createProject().brand, logoAssetId: 'mine' } };
    expect(applyBrandKit(own, noLogo, null).brand.logoAssetId).toBe('mine');
    expect(applyBrandKit(own, kit, null).brand.logoAssetId).toBe('mine');
  });

  it('validates stored kits', () => {
    expect(migrateBrandKit(null)).toBeNull();
    expect(migrateBrandKit({ name: 'no id' })).toBeNull();
    const k = migrateBrandKit({ id: 'k', name: 'x'.repeat(60), brand: { primary: 'red', style: 'neon', footer: 'yes' }, desktopFrame: 'tv' })!;
    expect(k.name).toHaveLength(40);
    expect(k.brand).toMatchObject({ primary: createProject().brand.primary, style: 'minimal', footer: false });
    expect(k.desktopFrame).toBe('plain');
    const round = brandKitFromProject(branded(), 'Teal');
    expect(migrateBrandKit(JSON.parse(JSON.stringify(round)))).toEqual(round);
  });
});

describe('background image and second colour', () => {
  const withImage = () => {
    const p = createProject();
    p.assets.push({ id: 'bg', name: 'bg.jpg', mime: 'image/jpeg', width: 1600, height: 900, size: 1 });
    p.background = { ...p.background, type: 'image', imageAssetId: 'bg' };
    return p;
  };

  it('keeps a valid photo and colour, drops dangling or invalid ones', () => {
    const p = withImage();
    p.background.secondary = '#DB2777';
    expect(migrateProject(JSON.parse(JSON.stringify(p))).background).toMatchObject({ type: 'image', imageAssetId: 'bg', secondary: '#db2777' });
    expect(migrateProject({ background: { type: 'image', imageAssetId: 'missing', secondary: 'pink' } }).background).toMatchObject({
      imageAssetId: null,
      secondary: null,
    });
    expect(migrateProject({}).background).toMatchObject({ imageAssetId: null, secondary: null });
  });

  it('keeps the photo when the style changes, but not in a brand kit', () => {
    expect(withStyle(withImage(), 'editorial').background.type).toBe('image');
    expect(withStyle(createProject(), 'technical').background.type).toBe('grid');
    const kit = brandKitFromProject(withImage(), 'Photo');
    expect(kit.background).toMatchObject({ type: 'solid', imageAssetId: null });
  });

  it('checks contrast against the second colour of a gradient', () => {
    const pal = derivePalette('#2563eb', 'light', 'minimal');
    expect(backgroundPeak(pal, 'gradient', 1, '#000000')).not.toBe(backgroundPeak(pal, 'gradient', 1));
    const p = withImage();
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).toContain('contrast-image');
  });
});

describe('example texts', () => {
  it('flags the example title and subtitle of a new project, not real text', () => {
    const p = createProject();
    expect(placeholderFields(p)).toEqual(['Title', 'Subtitle']);
    const ids = analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id);
    expect(ids).toContain('placeholder-Title');
    expect(ids).toContain('placeholder-Subtitle');
    p.content.title = 'Acme Billing 2.0';
    p.content.subtitle = 'Send invoices in two clicks.';
    expect(placeholderFields(p)).toEqual([]);
  });

  it('only checks the fields the template draws', () => {
    const p = createProject({ template: 'testimonial' });
    expect(placeholderFields(p)).toEqual(['Quote', 'Name', 'Role']);
    p.template = 'stats';
    expect(placeholderFields(p)).toContain('Key Figures');
    p.template = 'code';
    expect(placeholderFields(p)).toContain('Code');
    p.content.code = 'const x = 1;';
    expect(placeholderFields(p)).not.toContain('Code');
  });

  it('recognises registered translations', () => {
    const p = createProject();
    p.content.title = 'Nom de votre produit (test)';
    expect(placeholderFields(p)).not.toContain('Title');
    addPlaceholderTexts(['Nom de votre produit (test)']);
    expect(placeholderFields(p)).toContain('Title');
    expect(isPlaceholder('  Nom de votre produit (test) ')).toBe(true);
  });
});

describe('default export formats', () => {
  it('tick two or three formats that suit the template, LinkedIn first', () => {
    expect(createProject().exportPresets).toEqual(['linkedin', 'linkedin-carousel', 'open-graph']);
    expect(createProject({ template: 'mobile-trio' }).exportPresets).toEqual(['linkedin-carousel', 'story', 'square']);
    expect(createProject({ template: 'annotated' }).exportPresets).toEqual(['linkedin-carousel', 'slide']);
    for (const t of TEMPLATES) {
      const list = defaultExportPresets(t.id);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.length).toBeLessThanOrEqual(3);
      expect(list.every((f) => FORMAT_ORDER.includes(f))).toBe(true);
    }
  });

  it('keep the formats saved with a project, and the old list for files that name none', () => {
    expect(migrateProject({ exportPresets: ['github'] }).exportPresets).toEqual(['github']);
    expect(migrateProject({}).exportPresets).toEqual(['linkedin', 'open-graph', 'square', 'story', 'github']);
  });

  it('put LinkedIn and Microsoft 365 formats first', () => {
    expect(FORMAT_GROUPS.map((g) => g.label).slice(0, 2)).toEqual(['Social', 'Microsoft 365 and e-mail']);
  });
});
