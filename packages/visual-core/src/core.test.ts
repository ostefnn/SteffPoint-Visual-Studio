import { describe, expect, it } from 'vitest';
import {
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
} from './index';

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
        const p = derivePalette(c, theme);
        expect(contrastRatio(p.text, p.bg)).toBeGreaterThan(4.5);
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
    expect(p.brand.primary).toBe('#2563eb');
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
    expect(p.content.code).toContain('createPack');
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
    p.screenshots.push({ id: 's', assetId: 'a', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '' });
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
    p.screenshots.push({ id: 's', assetId: 'a', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '' });
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
    p.screenshots.push({ id: 's1', assetId: 'a', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '' });
    p.screenshots.push({ id: 's2', assetId: 'b', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '' });
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).toContain('device-fit-1'); // wide shot, upright phone
    p.deviceOrientation.mobile = 'landscape';
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).not.toContain('device-fit-1');
  });

  it('flags a phone screenshot in the desktop frame', () => {
    const p = createProject({ template: 'device-mix' });
    p.devices = ['desktop', 'mobile'];
    p.assets.push({ id: 'a', name: 'phone.png', mime: 'image/png', width: 1170, height: 2532, size: 1 });
    p.assets.push({ id: 'b', name: 'phone2.png', mime: 'image/png', width: 1170, height: 2532, size: 1 });
    p.screenshots.push({ id: 's1', assetId: 'a', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '' });
    p.screenshots.push({ id: 's2', assetId: 'b', fit: 'cover', zoom: 1, focalX: 0.5, focalY: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, caption: '' });
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
  it('defaults to browser and keeps a valid style', () => {
    expect(createProject().desktopFrame).toBe('browser');
    expect(migrateProject({ desktopFrame: 'laptop' }).desktopFrame).toBe('laptop');
    expect(migrateProject({ desktopFrame: 'tv' }).desktopFrame).toBe('browser');
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
    const slides = buildCarouselSlides(p);
    expect(templates(p)).toEqual(['browser-hero', 'spotlight', 'mobile-trio', 'features']);
    expect(slides.every((s) => s.auto)).toBe(true);
    expect(slides[1].project.content.title).toBe('Dashboard');
    expect(slides[1].project.screenshots.map((x) => x.id)).toEqual(['sd']);
    expect(slides[2].label).toBe('Mobile Trio');
    expect(slides[0].project.content.kicker).toBe(p.content.kicker); // cover keeps its kicker
    expect(slides[3].project.content.kicker).toBe('4 / 4');
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
    expect(migrateProject({}).carousel).toEqual({ slides: [], pageNumbers: true });
  });
});
