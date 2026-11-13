/**
 * Captures the finished examples shown at the top of the dashboard (apps/web/public/showcase).
 * Each one is made with the app itself, the way a user would: a screenshot of a fictional product
 * (scripts/showcase/mock-*.html), its text, a style and a colour, then exported as WebP.
 * The products (Ledgerly, Tidepool) are invented for these examples; no real company is shown.
 *
 * Usage, with the production build served on port 4173:
 *   npm run build && npm run preview -w @svs/web -- --port 4173
 *   node scripts/capture-showcase.mjs [baseUrl]
 * Set PW_CHROMIUM_PATH to use an already installed Chromium.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'apps/web/public/showcase');
const MOCKS = path.join(ROOT, 'scripts/showcase');
const BASE = process.argv[2] ?? 'http://localhost:4173/';

/** Must match SHOWCASE in apps/web/src/components/Dashboard.tsx. */
const EXAMPLES = [
  {
    file: 'ledgerly-linkedin.webp',
    template: 'Browser Hero',
    format: 'LinkedIn',
    style: 'Tint',
    colour: '#0f766e',
    shot: 'desktop',
    frame: 'Window',
    kicker: 'Ledgerly 2.0',
    title: 'Get paid in nine days, not thirty',
    subtitle: 'Send an invoice in two clicks. Reminders go out on their own.',
  },
  {
    file: 'tidepool-linkedin-4x5.webp',
    template: 'Mobile Trio',
    format: 'LinkedIn 4:5',
    style: 'Bold',
    colour: '#ea580c',
    shot: 'mobile',
    title: 'Your whole week at a glance',
    subtitle: 'Tidepool plans meetings, focus time and deadlines for you.',
  },
  {
    file: 'ledgerly-features-square.webp',
    template: 'Features',
    format: 'Square 1:1',
    style: 'Technical',
    colour: '#0f766e',
    kicker: 'changelog',
    title: 'What’s new in Ledgerly 2.0',
    subtitle: 'Shipped on 12 November.',
    features: ['Recurring invoices', 'Automatic reminders', 'Card and SEPA payments', 'Export to your accountant'],
  },
];

const launch = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launch);

/** Screenshots of the fictional products, rendered from their HTML mock-ups. */
async function mockShot(name, viewport, scale) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.join(MOCKS, `mock-${name}.html`)).href);
  const buffer = await page.screenshot({ type: 'png' });
  await ctx.close();
  return { name: `${name}.png`, mimeType: 'image/png', buffer };
}
const shots = {
  desktop: await mockShot('desktop', { width: 1600, height: 1000 }, 1),
  mobile: await mockShot('mobile', { width: 390, height: 844 }, 3),
};

await mkdir(OUT, { recursive: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();

for (const ex of EXAMPLES) {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'New Project' }).first().click();
  await page.getByTestId('save-state').waitFor();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: new RegExp(`^${ex.template}`) }).click();
  if (ex.shot) {
    await page.getByRole('tab', { name: 'Images' }).click();
    await page.locator('[role=tabpanel] input[type=file][multiple]').setInputFiles(shots[ex.shot]);
    await page.locator('[role=tabpanel] li').first().waitFor();
  }
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(ex.title);
  await page.getByRole('textbox', { name: 'Subtitle', exact: true }).fill(ex.subtitle);
  await page.getByRole('textbox', { name: 'Kicker', exact: true }).fill(ex.kicker ?? '');
  if (ex.features) {
    for (const [i, text] of ex.features.entries()) await page.getByRole('textbox', { name: `Feature ${i + 1}`, exact: true }).fill(text);
  }
  if (ex.steps) {
    for (const [i, [title, text]] of ex.steps.entries()) {
      await page.getByRole('textbox', { name: `Step ${i + 1} title` }).fill(title);
      await page.getByRole('textbox', { name: `Step ${i + 1} text` }).fill(text);
    }
  }
  if (ex.frame) await page.getByRole('radio', { name: ex.frame, exact: true }).click();
  await page.getByRole('tab', { name: 'Brand' }).click();
  await page.getByRole('radio', { name: new RegExp(`^${ex.style}`) }).click();
  await page.getByRole('textbox', { name: 'Primary colour hex' }).fill(ex.colour);
  await page.evaluate(() => document.fonts.ready);

  // Export that one format as WebP, without project.json.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const ticked = dialog.getByRole('group').getByRole('checkbox', { checked: true });
  while (await ticked.count()) await ticked.first().uncheck();
  await dialog.getByRole('checkbox', { name: new RegExp(`^${ex.format.replace(/[:]/g, '\\$&')}\\b`) }).first().check();
  await dialog.getByRole('checkbox', { name: /project\.json/ }).uncheck();
  await dialog.getByRole('radio', { name: 'WebP' }).click();
  await dialog.getByRole('radio', { name: '1×' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Export Image' }).click()]);
  await download.saveAs(path.join(OUT, ex.file));
  console.log('wrote', ex.file);
}

// ---- The app's own link preview (apps/web/public/og-image.png), from a screenshot of its dashboard ----
{
  const shotCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const shotPage = await shotCtx.newPage();
  await shotPage.goto(BASE);
  await shotPage.getByText('Made with SteffPoint Visual Studio').scrollIntoViewIfNeeded();
  await shotPage.evaluate(() => document.fonts.ready);
  const dashboard = { name: 'dashboard.png', mimeType: 'image/png', buffer: await shotPage.screenshot({ type: 'png' }) };
  await shotCtx.close();

  await page.goto(BASE);
  await page.getByRole('button', { name: 'New Project' }).first().click();
  await page.getByTestId('save-state').waitFor();
  await page.locator('[role=tabpanel] input[type=file][multiple]').setInputFiles(dashboard);
  await page.locator('[role=tabpanel] li').first().waitFor();
  await page.getByRole('textbox', { name: 'Kicker', exact: true }).fill('SteffPoint Visual Studio');
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Create once. Publish everywhere.');
  await page.getByRole('textbox', { name: 'Subtitle', exact: true }).fill('Launch visuals for every format, from your screenshots. Nothing leaves your device.');
  await page.getByRole('radio', { name: 'Window', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const ticked = dialog.getByRole('group').getByRole('checkbox', { checked: true });
  while (await ticked.count()) await ticked.first().uncheck();
  await dialog.getByRole('checkbox', { name: /^Open Graph\b/ }).check();
  await dialog.getByRole('checkbox', { name: /project\.json/ }).uncheck();
  await dialog.getByRole('radio', { name: 'PNG' }).click();
  await dialog.getByRole('radio', { name: '1×' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Export Image' }).click()]);
  await download.saveAs(path.join(ROOT, 'apps/web/public/og-image.png'));
  console.log('wrote og-image.png');
}

await browser.close();
// Keep the list in one place: the dashboard reads the same file names.
await writeFile(path.join(OUT, 'README.md'), `Generated by scripts/capture-showcase.mjs. Fictional products, made with the app.\n`);
