import { expect, test } from '@playwright/test';
import path from 'node:path';
import { FIXTURES, newProject, titleBox } from './helpers';

const uploadLogo = (page: import('@playwright/test').Page, file: string) =>
  page.locator('[role=tabpanel] input[type=file]:not([multiple])').setInputFiles(path.join(FIXTURES, file));

test('a colourful logo sets the brand colour, offers its palette, and is undoable in one step', async ({ page }) => {
  await newProject(page);
  await page.getByRole('tab', { name: 'Brand' }).click();
  const hex = page.getByRole('textbox', { name: 'Primary colour hex' });
  const before = await hex.inputValue();
  await uploadLogo(page, 'logo-brand.png');
  await expect(page.getByRole('img', { name: 'Logo' })).toBeVisible();
  // The teal mark covers the most opaque pixels and wins over the orange dot and the white bar.
  await expect(hex).toHaveValue('#0f766e');
  await expect(page.getByRole('status').filter({ hasText: 'Brand colour set to #0f766e from the logo' })).toBeVisible();
  const swatches = page.getByRole('group', { name: 'Colours from your logo' }).getByRole('button');
  await expect(swatches.first()).toHaveAccessibleName('Use #0f766e from the logo');
  await expect(swatches.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Use #f97316 from the logo' })).toBeVisible();
  // Another logo colour in one click.
  await page.getByRole('button', { name: 'Use #f97316 from the logo' }).click();
  await expect(hex).toHaveValue('#f97316');
  // Undo goes back to the logo colour, then removes logo and colour together.
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(hex).toHaveValue('#0f766e');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(hex).toHaveValue(before);
  await expect(page.getByRole('img', { name: 'Logo' })).toHaveCount(0);
});

test('the toast Undo restores the previous colour and keeps the logo', async ({ page }) => {
  await newProject(page);
  await page.getByRole('tab', { name: 'Brand' }).click();
  const hex = page.getByRole('textbox', { name: 'Primary colour hex' });
  const before = await hex.inputValue();
  await uploadLogo(page, 'logo-brand.png');
  await expect(hex).toHaveValue('#0f766e');
  const toast = page.getByRole('status').filter({ hasText: 'Brand colour set to #0f766e' });
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(hex).toHaveValue(before);
  await expect(page.getByRole('img', { name: 'Logo' })).toBeVisible();
  await expect(toast).toHaveCount(0);
});

test('a monochrome logo keeps the brand colour but lists its ink', async ({ page }) => {
  await newProject(page);
  await page.getByRole('tab', { name: 'Brand' }).click();
  const hex = page.getByRole('textbox', { name: 'Primary colour hex' });
  const before = await hex.inputValue();
  await uploadLogo(page, 'logo-300.png');
  await expect(page.getByRole('button', { name: 'Use #111827 from the logo' })).toBeVisible();
  await expect(hex).toHaveValue(before);
});

test('Compare Styles shows the content in every style and applies the one picked', async ({ page }) => {
  await newProject(page);
  await titleBox(page).fill('Matrix title');
  const toggle = page.getByRole('button', { name: 'Compare Styles' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const matrix = page.getByRole('radiogroup', { name: 'Compare styles' });
  await expect(matrix.getByRole('radio')).toHaveCount(6);
  await expect(matrix.locator('h1', { hasText: 'Matrix title' })).toHaveCount(6);
  await expect(matrix.getByRole('radio', { name: /^Minimal/ })).toHaveAttribute('aria-checked', 'true');
  // Each cell really renders its own style.
  await expect(matrix.getByRole('radio', { name: /^Editorial/ }).locator('h1')).toHaveCSS('font-family', /Instrument Serif/);
  await expect(matrix.getByRole('radio', { name: /^Bold/ }).locator('h1')).toHaveCSS('font-family', /Bricolage Grotesque/);
  // All four cells fit in the canvas.
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  for (const cell of await matrix.getByRole('radio').all()) {
    const b = (await cell.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(canvas.x - 1);
    expect(b.y).toBeGreaterThanOrEqual(canvas.y - 1);
    expect(b.x + b.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
    expect(b.y + b.height).toBeLessThanOrEqual(canvas.y + canvas.height + 1);
  }
  // Landscape: two columns. The active cell is named plainly, without a suffix.
  await expect(matrix).toHaveAttribute('data-columns', '2');
  await expect(matrix.getByRole('radio', { name: 'Minimal', exact: true })).toBeVisible();
  await matrix.getByRole('radio', { name: /^Editorial/ }).click();
  await expect(matrix.getByRole('radio', { name: /^Editorial/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('tab', { name: 'Brand' }).click();
  await expect(page.getByRole('radio', { name: /^Editorial/ }).first()).toHaveAttribute('aria-checked', 'true');
  // A tall format goes to three columns instead of two: each style is drawn larger.
  await page.getByRole('button', { name: 'Preview Story 9:16' }).click();
  await expect(matrix).toHaveAttribute('data-columns', '3');
  // The pressed toggle is tinted, not a second primary (filled) button.
  const bg = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  const exportBg = await page.getByRole('button', { name: 'Export', exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe(exportBg);
  // Back to the single preview.
  await toggle.click();
  await expect(matrix).toHaveCount(0);
  await expect(page.getByTestId('canvas').locator('h1', { hasText: 'Matrix title' })).toHaveCSS('font-family', /Instrument Serif/);
});
