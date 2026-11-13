import { expect, test } from '@playwright/test';
import { addScreenshot, newProject } from './helpers';

test('editor is usable on touch devices', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  // The main preview is visible and reasonably large.
  const box = await page.getByTestId('canvas').boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(200);
  // No horizontal page scroll.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('on phones and tablets the preview takes the format’s shape; on a phone the bar is one row', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch layout');
  await newProject(page);
  // The one-row bar is the phone layout (below 640 px); tablets keep the wrapping bar with labels.
  if (page.viewportSize()!.width < 640) {
    const bar = (await page.getByRole('banner').first().boundingBox())!;
    expect(bar.height).toBeLessThan(64);
  }
  // LinkedIn (landscape): the preview box is wider than tall.
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  expect(canvas.width).toBeGreaterThan(canvas.height);
});

test('the dashboard does not download the export engine', async ({ page }) => {
  const loaded: string[] = [];
  page.on('request', (r) => loaded.push(r.url()));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New Project' }).first()).toBeVisible();
  expect(loaded.some((u) => /jszip|pdf-lib|legendImport/.test(u))).toBe(false);
});

test('small previews use reduced copies of large images; the export keeps the original', async ({ page, isMobile }) => {
  await newProject(page);
  // A 2000 × 2000 photo: larger than the 1024 px previews.
  const big = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = c.height = 2000;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ff00aa';
    g.fillRect(0, 0, 2000, 2000);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByRole('tab', { name: 'Images' }).click();
  await page.locator('[role=tabpanel] input[type=file][multiple]').setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(big) });
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  const widths = (sel: string) =>
    page.locator(sel).evaluateAll((els) => els.filter((e) => (e as HTMLImageElement).src.startsWith('blob:')).map((e) => (e as HTMLImageElement).naturalWidth));
  await expect.poll(async () => Math.max(...(await widths('[aria-label="Formats"] img')))).toBe(1024);
  // The main preview: the original on a desktop, the reduced copy on a phone.
  await expect.poll(async () => (await widths('[data-testid=canvas] img'))[0]).toBe(isMobile && page.viewportSize()!.width < 1024 ? 1024 : 2000);
});
