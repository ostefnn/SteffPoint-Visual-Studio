import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { addScreenshot, newProject, titleBox } from './helpers';

const pages = (page: Page) => page.getByRole('list', { name: 'Carousel pages' }).getByRole('listitem');

test('custom carousel: templates per page, own text, reorder, add, undo, export', async ({ page }) => {
  await newProject(page);
  await titleBox(page).fill('Cockpit SteffPoint');
  await addScreenshot(page, 'desktop-magenta.png');
  await addScreenshot(page, 'desktop-cyan.png');

  await page.getByRole('tab', { name: 'Carousel' }).click();
  // Opening the tab shows page 1 on the canvas.
  await expect(page.getByText('Carousel page 1 of 4')).toBeVisible();
  await expect(pages(page)).toHaveCount(4);

  await page.getByRole('button', { name: 'Customize Pages' }).click();
  await expect(page.getByRole('button', { name: 'Add Page' })).toBeVisible();

  // Page 1 becomes a Minimal hook with its own title.
  await page.getByRole('combobox', { name: 'Template' }).selectOption('minimal');
  await page.getByRole('checkbox', { name: 'Page 1 title: same as project' }).uncheck();
  await page.getByRole('textbox', { name: 'Page 1 title' }).fill('Too many tabs?');
  await expect(page.getByTestId('canvas')).toContainText('Too many tabs?');
  await expect(pages(page).first()).toContainText('Too many tabs?');

  // Add a closing page: it is added last and selected.
  await page.getByRole('button', { name: 'Add Page' }).click();
  await expect(pages(page)).toHaveCount(5);
  await expect(page.getByText('Carousel page 5 of 5')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Page 5 title: same as project' }).uncheck();
  await page.getByRole('textbox', { name: 'Page 5 title' }).fill('Try it today');

  // Reorder with the keyboard: move the closing page up one place, then undo it.
  await page.getByRole('button', { name: /^Page 5: Try it today/ }).focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect(pages(page).nth(3)).toContainText('Try it today');
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(pages(page).nth(4)).toContainText('Try it today');

  // The project itself is unchanged by page overrides.
  await page.getByRole('button', { name: 'Show Project' }).click();
  await expect(titleBox(page)).toHaveValue('Cockpit SteffPoint');

  // Custom pages survive a reload.
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  await page.reload();
  await page.getByRole('tab', { name: 'Carousel' }).click();
  await expect(pages(page)).toHaveCount(5);
  await expect(pages(page).first()).toContainText('Too many tabs?');

  // Export: 5 pages in the PDF, matching the custom list.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('list', { name: 'Carousel slides' }).getByRole('listitem')).toHaveCount(5);
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Export Carousel PDF \(5 Pages\)/ }).click()]);
  const pdf = await PDFDocument.load(await readFile(await download.path()));
  expect(pdf.getPageCount()).toBe(5);
});

test('reset to automatic pages', async ({ page }) => {
  await newProject(page);
  await page.getByRole('tab', { name: 'Carousel' }).click();
  await page.getByRole('button', { name: 'Customize Pages' }).click();
  await page.getByRole('button', { name: 'Add Page' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Reset to Automatic' }).click();
  await expect(page.getByRole('button', { name: 'Customize Pages' })).toBeVisible();
});

test('reorder carousel pages by drag and drop', async ({ page }) => {
  await newProject(page);
  await page.getByRole('tab', { name: 'Carousel' }).click();
  await page.getByRole('button', { name: 'Customize Pages' }).click();
  await page.getByRole('button', { name: 'Add Page' }).click(); // Call to Action, last
  const before = await pages(page).allInnerTexts();
  await pages(page).last().dragTo(pages(page).first());
  await expect(pages(page).first()).toContainText('Call to Action');
  expect((await pages(page).allInnerTexts()).length).toBe(before.length);
});
