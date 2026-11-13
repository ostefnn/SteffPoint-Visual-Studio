import { expect, test } from '@playwright/test';

test('the interface switches to French and Dutch, and remembers the choice', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('fr');
  await expect(page.getByRole('button', { name: 'Nouveau projet' }).first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

  // A new project starts with French placeholder content.
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click();
  await expect(page.getByTestId('save-state')).toHaveText('Enregistré');
  await expect(page.getByRole('textbox', { name: 'Titre', exact: true })).toHaveValue('Nom de votre produit');
  await expect(page.getByRole('tab', { name: 'Carrousel' })).toBeVisible();

  // Kept after a reload; Dutch from the dashboard.
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Carrousel' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour aux projets' }).click();
  await page.getByRole('combobox', { name: 'Langue' }).selectOption('nl');
  await expect(page.getByRole('button', { name: 'Nieuw project' }).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Taal' }).selectOption('en');
  await expect(page.getByRole('button', { name: 'New Project' }).first()).toBeVisible();
});
