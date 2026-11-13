import { expect, test } from '@playwright/test';
import { addScreenshot, newProject } from './helpers';

// Reading the clipboard back needs permissions only Chromium grants to tests.
test('Copy Image puts the format on screen in the clipboard as a PNG', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium-only in Playwright.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await page.getByRole('button', { name: 'Copy Image' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Image copied' })).toBeVisible();
  const size = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const blob = await item.getType('image/png');
    const bmp = await createImageBitmap(blob);
    return { type: blob.type, width: bmp.width, height: bmp.height };
  });
  // LinkedIn 1200 × 627 at 2×.
  expect(size).toEqual({ type: 'image/png', width: 2400, height: 1254 });
});
