import { expect, test, type Page } from '@playwright/test';
import { addScreenshot, CYAN, expectColor, MAGENTA, newProject, probePng, readZip } from './helpers';

async function useTemplate(page: Page, name: string) {
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.locator('[role=tabpanel] button', { hasText: name }).click();
  await expect(page.locator('[role=tabpanel] button[aria-pressed=true]')).toContainText(name);
}

/** Export only the LinkedIn format at 1× and return the PNG bytes. */
async function exportLinkedIn(page: Page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const box of await dialog.getByRole('checkbox').all()) {
    const label = (await box.locator('xpath=..').innerText()).trim();
    const want = label.startsWith('LinkedIn');
    if ((await box.isChecked()) !== want && !label.startsWith('Include')) await box.click();
  }
  await dialog.getByRole('radio', { name: '1×' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Export ZIP/ }).click()]);
  const zip = await readZip(download);
  return zip.file('linkedin.png')!.async('uint8array');
}

test('Desktop + Mobile renders both screenshots', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await addScreenshot(page, 'desktop-cyan.png');
  await useTemplate(page, 'Desktop + Mobile');
  const png = await exportLinkedIn(page);
  expectColor((await probePng(page, png, [0.55, 0.5])).rgb, MAGENTA); // browser
  expectColor((await probePng(page, png, [0.89, 0.6])).rgb, CYAN); // phone
});

test('Features lists the edited items', async ({ page }) => {
  await newProject(page);
  await useTemplate(page, 'Features');
  await page.getByRole('textbox', { name: 'Feature 4' }).fill('Works offline');
  await expect(page.getByTestId('canvas')).toContainText('Works offline');
  const res = await probePng(page, await exportLinkedIn(page), [0.5, 0.5]);
  expect([res.width, res.height]).toEqual([1200, 627]);
});

test('Code renders the snippet in a dark editor', async ({ page }) => {
  await newProject(page);
  await useTemplate(page, 'Code');
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill('const answer = 42;');
  await expect(page.getByTestId('canvas')).toContainText('const answer = 42;');
  // Near the bottom-right of the window, below the single line of code: editor background.
  const { rgb } = await probePng(page, await exportLinkedIn(page), [0.9, 0.55]);
  expectColor(rgb, [15, 17, 23], 10);
});
