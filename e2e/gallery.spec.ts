import { expect, test } from '@playwright/test';

const card = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) });

test('gallery cards show real facts and real code, never invented ones', async ({ page }) => {
  await page.goto('/');
  const figures = card(page, 'Key Figures');
  await expect(figures.getByText('templates', { exact: true })).toBeVisible();
  await expect(figures.getByText('00')).toHaveCount(0);
  // The template count is the number of cards in the gallery.
  const count = await page.getByRole('heading', { name: 'Start from a Template' }).locator('xpath=../..').getByRole('listitem').count();
  await expect(figures.getByText(String(count), { exact: true })).toBeVisible();
  await expect(card(page, 'Features').getByText('Nothing leaves your device')).toBeVisible();
  await expect(card(page, 'Code').getByText(/@svs\/visual-core/)).toBeVisible();
});

test('App Store is previewed as a row of iPhone screens, one caption each', async ({ page }) => {
  await page.goto('/');
  const store = card(page, 'App Store');
  for (const caption of ['Every format at once', 'Your brand, from your logo', 'Nothing leaves your device']) {
    await expect(store.locator('h1', { hasText: caption })).toHaveCount(1);
  }
});

test('the preview style restyles every card and a card opens in that style', async ({ page }) => {
  await page.goto('/');
  const styles = page.getByRole('combobox', { name: 'Preview style' });
  await expect(styles).toHaveValue('minimal');
  await expect(styles.getByRole('option')).toHaveCount(6);
  await styles.selectOption({ label: 'Editorial' });
  await expect(card(page, 'Minimal').locator('h1').first()).toHaveCSS('font-family', /Instrument Serif/);
  await card(page, 'Minimal').getByRole('button').click();
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  await page.getByRole('tab', { name: 'Brand' }).click();
  await expect(page.getByRole('radio', { name: /^Editorial/ }).first()).toHaveAttribute('aria-checked', 'true');
});

test('phones and tablets in the gallery show real mobile screens, never a desktop screenshot', async ({ page }) => {
  await page.goto('/');
  const srcs = async (name: string) => card(page, name).locator('img').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src.split('/').pop()));
  expect(await srcs('Mobile Trio')).toEqual(expect.arrayContaining(['phone-1.jpg', 'phone-2.jpg', 'phone-3.jpg']));
  expect((await srcs('Mobile Trio')).every((f) => f?.startsWith('phone-'))).toBe(true);
  expect((await srcs('App Store')).every((f) => f?.startsWith('phone-'))).toBe(true);
  expect(await srcs('Device Mix')).toEqual(expect.arrayContaining(['editor.jpg', 'tablet.jpg', 'phone-1.jpg']));
  // Every sample image actually loads.
  for (const img of await page.locator('main img').all()) {
    await expect.poll(() => img.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
});
