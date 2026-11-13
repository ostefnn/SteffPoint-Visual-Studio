/**
 * Captures the phone and tablet screenshots shown in the template gallery's iPhones and iPads
 * (apps/web/public/samples). They are real screens of this app, on a real mobile viewport, with
 * real content (counts read from the app, its own logo), so the gallery never shows a desktop
 * screenshot squeezed into a phone.
 *
 * Usage, with the production build served on port 4173:
 *   npm run build && npm run preview -w @svs/web -- --port 4173
 *   node scripts/capture-samples.mjs [baseUrl]
 * Set PW_CHROMIUM_PATH to use an already installed Chromium.
 */
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'apps/web/public/samples');
const BASE = process.argv[2] ?? 'http://localhost:4173/';

// Phone screens use the gallery's phone frame ratio (0.48); the tablet uses the tablet frame's (0.75).
const PHONE = { width: 390, height: 812 };
const TABLET = { width: 768, height: 1024 };

/** Each phone screen: one style, one template, real content, shown in Story 9:16 so the visual fills the screen. */
const PHONES = [
  { file: 'phone-1.jpg', style: 'Bold', template: 'Key Figures', title: 'Create once. Publish everywhere.', subtitle: 'Launch visuals for every format, from your screenshots.' },
  { file: 'phone-2.jpg', style: 'Tint', template: 'Features', title: 'Your brand, from your logo', subtitle: 'Import a logo: its colour dresses every visual.' },
  { file: 'phone-3.jpg', style: 'Technical', template: 'Code', title: 'One palette, in code', subtitle: 'The same core drives the editor and the exports.', kicker: 'visual-core' },
];

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});

/** The app's own logo, rasterised from its favicon so it can be imported like any PNG. */
async function logoPng(page) {
  const svg = await readFile(path.join(ROOT, 'apps/web/public/favicon.svg'), 'utf8');
  const b64 = await page.evaluate(async (svgText) => {
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${btoa(svgText)}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    c.getContext('2d').drawImage(img, 0, 0, 512, 512);
    return c.toDataURL('image/png').split(',')[1];
  }, svg);
  return { name: 'steffpoint-logo.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

/** A new project with the logo, a name, a style and a template, opened in the editor. */
async function setUp(page, { style, template, title, subtitle, kicker = '' }) {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'New Project' }).first().click();
  await page.getByTestId('save-state').waitFor();
  await page.getByRole('textbox', { name: 'Project name' }).fill('SteffPoint launch');
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: new RegExp(`^${template}`) }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByRole('textbox', { name: 'Subtitle', exact: true }).fill(subtitle);
  await page.getByRole('textbox', { name: 'Kicker', exact: true }).fill(kicker);
  if (template === 'Features') {
    const items = ['Brand colour picked from your logo', 'Every style compared side by side', 'LinkedIn carousel as a PDF'];
    const fields = page.getByRole('textbox', { name: /^Feature \d+$/ });
    for (let i = 0; i < Math.min(await fields.count(), items.length); i++) await fields.nth(i).fill(items[i]);
  }
  await page.getByRole('tab', { name: 'Brand' }).click();
  await page.locator('[role=tabpanel] input[type=file]:not([multiple])').setInputFiles(await logoPng(page));
  await page.getByRole('img', { name: 'Logo' }).waitFor();
  await page.getByRole('radio', { name: new RegExp(`^${style}`) }).click();
}

/**
 * Real figures for Key Figures, read from the gallery's own Key Figures card, which counts
 * templates, formats and styles from the code: nothing is typed by hand here.
 */
async function realFigures(page) {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'All', exact: true }).click(); // the gallery opens on Recommended
  const card = page.getByRole('listitem').filter({ has: page.getByText('Key Figures', { exact: true }) });
  const text = await card.innerText();
  const out = [];
  for (const label of ['templates', 'export formats', 'styles']) {
    const m = text.match(new RegExp(`(\\d+)\\s+${label}`));
    if (m) out.push([m[1], label]);
  }
  if (out.length !== 3) throw new Error(`Could not read the figures from the gallery card:\n${text}`);
  return out;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Toasts (logo colour) are not part of the screen.
  for (const close of await page.getByRole('button', { name: 'Dismiss' }).all()) await close.click();
  await page.waitForTimeout(400);
}

// ---- Phones ---------------------------------------------------------------------------------
const phone = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await phone.newPage();
const figures = await realFigures(page);
for (const shot of PHONES) {
  await setUp(page, shot);
  if (shot.template === 'Key Figures') {
    const values = page.getByRole('textbox', { name: /^Figure \d+ value$/ });
    const labels = page.getByRole('textbox', { name: /^Figure \d+ label$/ });
    for (let i = 0; i < Math.min(await values.count(), figures.length); i++) {
      await values.nth(i).fill(figures[i][0]);
      await labels.nth(i).fill(figures[i][1]);
    }
  }
  if (shot.template === 'Code') {
    await page.getByRole('textbox', { name: 'File name' }).fill('brand.ts');
    await page.getByRole('textbox', { name: 'Code', exact: true }).fill(
      [
        "import { derivePalette } from '@svs/visual-core';",
        '',
        "const palette = derivePalette('#2563eb', 'light', 'technical');",
        'palette.text; // readable on every ground',
      ].join('\n'),
    );
  }
  await page.getByRole('button', { name: 'Preview Story 9:16' }).click();
  await settle(page);
  await page.screenshot({ path: path.join(OUT, shot.file), type: 'jpeg', quality: 86 });
  console.log('wrote', shot.file);
}
await phone.close();

// ---- Tablet: the style matrix, the screen a tablet is best at ---------------------------------
const tablet = await browser.newContext({ viewport: TABLET, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const tpage = await tablet.newPage();
await setUp(tpage, { style: 'Minimal', template: 'Features', title: 'Create once. Publish everywhere.', subtitle: 'Every style, side by side.' });
await tpage.getByRole('button', { name: 'Preview Square 1:1' }).click();
await tpage.getByRole('button', { name: 'Compare Styles' }).click();
await settle(tpage);
await tpage.screenshot({ path: path.join(OUT, 'tablet.jpg'), type: 'jpeg', quality: 86 });
console.log('wrote tablet.jpg');
await tablet.close();

await browser.close();
