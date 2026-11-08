import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { addScreenshot, newProject, titleBox } from './helpers';

test('exports a LinkedIn carousel PDF: cover, one page per screenshot, features', async ({ page }) => {
  await newProject(page);
  await titleBox(page).fill('Cockpit SteffPoint');
  await addScreenshot(page, 'desktop-magenta.png');
  await addScreenshot(page, 'desktop-cyan.png');

  // Caption the first screenshot: it becomes the title of its slide.
  await page.locator('[role=tabpanel] li button').first().click();
  await page.getByRole('textbox', { name: 'Carousel caption' }).fill('Every environment at a glance');
  await expect(page.getByTestId('save-state')).toHaveText('Saved');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const slides = dialog.getByRole('list', { name: 'Carousel slides' }).getByRole('listitem');
  await expect(slides).toHaveCount(4);
  await expect(slides.nth(1)).toContainText('Every environment at a glance');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: /Export Carousel PDF \(4 Pages\)/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/linkedin-carousel\.pdf$/);

  const pdf = await PDFDocument.load(await readFile(await download.path()));
  expect(pdf.getPageCount()).toBe(4);
  for (const p of pdf.getPages()) expect(p.getSize()).toEqual({ width: 1080, height: 1350 });
  expect(pdf.getTitle()).toBe('Cockpit SteffPoint');
  expect(pdf.getCreator()).toBe('SteffPoint Visual Studio');
});
