import { expect, test } from '@playwright/test';
import path from 'node:path';
import { FIXTURES, newProject, probePng } from './helpers';

test('the ? key opens the help, which sets the editor theme', async ({ page }) => {
  await newProject(page);
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Shift+Slash');
  const help = page.getByRole('dialog', { name: 'Help' });
  await expect(help).toBeVisible();
  await expect(help.getByRole('cell', { name: 'Open this help' })).toBeVisible();

  await help.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();

  // Remembered after a reload; System follows the operating system again.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('dialog', { name: 'Help' }).getByRole('radio', { name: 'System' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
});

test('a background photo and a second colour reach the export', async ({ page }) => {
  await newProject(page);
  await page.getByRole('tab', { name: 'Background' }).click();
  await page.getByRole('button', { name: /Gradient/ }).click();
  await page.getByRole('checkbox', { name: 'Second colour' }).check();
  await page.getByRole('textbox', { name: 'Second colour hex' }).fill('#000000');

  await page.locator('input[aria-label="Background image"]').setInputFiles(path.join(FIXTURES, 'desktop-magenta.png'));
  await expect(page.getByRole('button', { name: 'Image', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('slider', { name: /Photo visibility/ }).fill('1');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const box of await dialog.getByRole('checkbox').all()) {
    const label = (await box.locator('xpath=..').innerText()).trim();
    const want = label.startsWith('LinkedIn') && !label.includes('4:5') && !label.includes('Company');
    if ((await box.isChecked()) !== want && !label.startsWith('Include')) await box.click();
  }
  await dialog.getByRole('radio', { name: '1×' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Export Image|Export ZIP/ }).click()]);
  const { readFile } = await import('node:fs/promises');
  const JSZip = (await import('jszip')).default;
  const bytes = await readFile(await download.path());
  const png = download.suggestedFilename().endsWith('.zip') ? await (await JSZip.loadAsync(bytes)).file('linkedin.png')!.async('uint8array') : new Uint8Array(bytes);
  // The corner shows the magenta photo through a light veil.
  const { rgb } = await probePng(page, png, [0.02, 0.97]);
  expect(rgb[0]).toBeGreaterThan(200);
  expect(rgb[1]).toBeLessThan(90);
});
