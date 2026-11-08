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

test('Device Mix lets you pick the devices and renders each screenshot', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await addScreenshot(page, 'desktop-cyan.png');
  await useTemplate(page, 'Device Mix');
  const devices = page.getByRole('group', { name: 'Devices' });
  const desktop = devices.getByRole('checkbox', { name: 'Desktop' });
  const tablet = devices.getByRole('checkbox', { name: 'Tablet' });
  const mobile = devices.getByRole('checkbox', { name: 'Mobile' });
  await expect(desktop).toBeChecked();
  await expect(tablet).toBeChecked();
  await expect(mobile).toBeChecked();

  // Tablet + Mobile: screenshot 1 in the tablet, 2 in the phone; two devices is the minimum.
  await desktop.uncheck({ force: true });
  await expect(desktop).not.toBeChecked();
  await expect(tablet).toBeDisabled();
  await expect(mobile).toBeDisabled();
  await expect(page.getByTestId('canvas').locator('img')).toHaveCount(2);
  const png = await exportLinkedIn(page);
  expectColor((await probePng(page, png, [0.57, 0.5])).rgb, MAGENTA); // tablet
  expectColor((await probePng(page, png, [0.86, 0.75])).rgb, CYAN); // phone

  // Desktop + Mobile after re-enabling desktop and dropping the tablet.
  await desktop.check({ force: true });
  await tablet.uncheck({ force: true });
  await expect(page.getByText('Screenshots fill the devices in order: desktop, mobile.')).toBeVisible();
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
