import { expect, test } from '@playwright/test';
import { addScreenshot, expectColor, newProject, probePng, readZip, titleBox } from './helpers';

/** Export only the LinkedIn format at 1× and return the PNG bytes. */
async function exportLinkedIn(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const box of await dialog.getByRole('checkbox').all()) {
    const label = (await box.locator('xpath=..').innerText()).trim();
    if (label.startsWith('Include')) continue;
    const want = label.startsWith('LinkedIn') && !label.startsWith('LinkedIn 4:5');
    if ((await box.isChecked()) !== want) await box.click();
  }
  await dialog.getByRole('radio', { name: '1×' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Export ZIP/ }).click()]);
  return (await readZip(download)).file('linkedin.png')!.async('uint8array');
}

test('new projects start in Minimal with neutral ground and no invented copy', async ({ page }) => {
  await newProject(page);
  await page.getByRole('tab', { name: 'Brand' }).click();
  await expect(page.getByRole('radio', { name: /^Minimal/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('textbox', { name: 'Kicker', exact: true })).toHaveValue('');
  // The canvas never shows tracked capitals for the kicker in the new styles.
  await page.getByRole('textbox', { name: 'Kicker', exact: true }).fill('Version 2.4');
  const kicker = page.getByTestId('canvas').getByText('Version 2.4');
  await expect(kicker).toHaveCSS('text-transform', 'none');
});

test('Bold paints the brand colour as background and the title uses the bundled condensed face', async ({ page }) => {
  await newProject(page);
  await titleBox(page).fill('Cockpit SteffPoint');
  await page.getByRole('tab', { name: 'Brand' }).click();
  await page.getByRole('radio', { name: /^Bold/ }).click();
  await page.getByRole('textbox', { name: 'Primary colour hex' }).fill('#0f766e');
  const title = page.getByTestId('canvas').locator('h1', { hasText: 'Cockpit SteffPoint' });
  await expect(title).toHaveCSS('font-family', /Bricolage Grotesque Variable/);
  // The bundled face is actually loaded (no silent fallback).
  await expect.poll(() => page.evaluate(() => document.fonts.check("800 40px 'Bricolage Grotesque Variable'"))).toBe(true);
  const png = await exportLinkedIn(page);
  expectColor((await probePng(page, png, [0.02, 0.5])).rgb, [0x0f, 0x76, 0x6e], 6);
});

test('switching style is undoable and keeps the content', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await titleBox(page).fill('Kept title');
  await page.getByRole('tab', { name: 'Brand' }).click();
  await page.getByRole('radio', { name: /^Editorial/ }).click();
  await expect(page.getByTestId('canvas').locator('h1', { hasText: 'Kept title' })).toHaveCSS('font-family', /Instrument Serif/);
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('radio', { name: /^Minimal/ })).toHaveAttribute('aria-checked', 'true');
  await expect(titleBox(page)).toHaveValue('Kept title');
});
