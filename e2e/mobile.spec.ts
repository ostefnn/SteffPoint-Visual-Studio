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

test('on a phone the editor bar is one row and the preview takes the format’s shape', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await newProject(page);
  const bar = (await page.getByRole('banner').first().boundingBox())!;
  expect(bar.height).toBeLessThan(64);
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
