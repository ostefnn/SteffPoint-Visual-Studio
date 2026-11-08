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
