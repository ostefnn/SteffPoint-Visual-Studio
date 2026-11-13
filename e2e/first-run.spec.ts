import { expect, test } from '@playwright/test';
import path from 'node:path';
import { FIXTURES, newProject, titleBox } from './helpers';

test('first run: the empty preview adds a screenshot, then the title is focused', async ({ page }) => {
  await newProject(page);
  // No screenshot yet: the editor opens on Images.
  await expect(page.getByRole('tab', { name: 'Images' })).toHaveAttribute('aria-selected', 'true');

  // The whole preview is a button that opens the file picker.
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('canvas-add-screenshot').click()]);
  await chooser.setFiles(path.join(FIXTURES, 'desktop-cyan.png'));
  await expect(page.locator('[role=tabpanel] li')).toHaveCount(1);
  await expect(page.getByTestId('canvas-add-screenshot')).toHaveCount(0);

  // Next step: the headline, still the example text, is focused and selected.
  await expect(titleBox(page)).toBeFocused();
});

test('example text is flagged in the suggestions and in the export dialog', async ({ page }) => {
  await newProject(page);
  await expect(page.getByText('Title still contains the example text. Replace it before publishing.', { exact: true })).toBeVisible();
  await titleBox(page).fill('Acme Billing 2.0');
  await expect(page.getByText('Title still contains the example text. Replace it before publishing.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Subtitle still contains the example text. Replace it before publishing.')).toBeVisible();

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Example text is still in: Subtitle. Replace it before publishing, or export anyway.')).toBeVisible();
  // Export stays possible.
  await expect(dialog.getByRole('button', { name: /Export ZIP/ })).toBeEnabled();
  // Edit Text closes the dialog and goes to the field.
  await dialog.getByRole('button', { name: 'Edit Text' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Subtitle', exact: true })).toBeFocused();
});

test('an untitled project takes its name from the title until renamed', async ({ page }) => {
  await newProject(page);
  const name = page.getByRole('textbox', { name: 'Project name' });
  await expect(name).toHaveValue(/^Untitled /);
  await titleBox(page).fill('Acme Billing 2.0');
  await expect(name).toHaveValue('Acme Billing 2.0');
  await titleBox(page).fill('Acme Billing 2.1');
  await expect(name).toHaveValue('Acme Billing 2.1');
  // Once renamed by hand, the name stays.
  await name.fill('Launch week');
  await titleBox(page).fill('Acme Billing 3');
  await expect(name).toHaveValue('Launch week');
});

test('Import Legend lives in the More menu and on the Annotated Panel card', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner').getByRole('button', { name: 'Import Legend' })).toHaveCount(0);
  await page.getByRole('button', { name: 'More' }).click();
  const item = page.getByRole('menuitem', { name: /Import Legend/ });
  await expect(item).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(item).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Or start from a legend file (.md and its screenshots)' })).toBeVisible();
});

test('after three exports without a backup, the editor offers to save a copy once', async ({ page }) => {
  await newProject(page);
  await titleBox(page).fill('Acme Billing 2.0');
  const exportImage = async () => {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /project\.json/ }).uncheck();
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /^Export (Image|ZIP)/ }).click()]);
    expect(download.suggestedFilename()).not.toMatch(/\.json$/);
  };
  const reminder = page.getByText('This project only lives in this browser. Keep a copy as a JSON file.');
  await exportImage();
  await exportImage();
  await expect(reminder).toHaveCount(0);
  await exportImage();
  await expect(reminder).toBeVisible();
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a Copy' }).click()]);
  expect(backup.suggestedFilename()).toBe('acme-billing-2-0.svs.json');
});

test('the dashboard warns about storage only once the browser has refused to keep the data', async ({ page }) => {
  await newProject(page);
  await page.getByRole('button', { name: 'Back to Projects' }).click();
  const status = page.getByTestId('storage-status');
  await expect(status).not.toContainText('Your browser may clear this data');
  await page.evaluate(() => localStorage.setItem('svs-persistence', 'refused'));
  await page.reload();
  // Headless Chromium does not persist storage, so the refusal applies.
  await expect(status).toContainText(/Your browser may clear this data|Protected from automatic clean-up/);
});
