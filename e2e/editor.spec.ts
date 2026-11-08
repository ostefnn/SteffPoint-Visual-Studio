import { expect, test } from '@playwright/test';
import { addScreenshot, expectColor, MAGENTA, newProject, probePng, readZip, titleBox } from './helpers';

test('project survives a reload', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await titleBox(page).fill('Cockpit SteffPoint');
  await expect(page.getByTestId('save-state')).toHaveText('Saved');

  await page.reload();
  await expect(titleBox(page)).toHaveValue('Cockpit SteffPoint');
  await page.getByRole('tab', { name: 'Images' }).click();
  await expect(page.locator('[role=tabpanel] li img')).toHaveCount(1);
  // The image blob itself came back from IndexedDB.
  await expect.poll(() => page.locator('[role=tabpanel] li img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
});

test('undo and redo the title', async ({ page }) => {
  await newProject(page);
  const original = await titleBox(page).inputValue();
  await titleBox(page).fill('Changed');
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(titleBox(page)).toHaveValue(original);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(titleBox(page)).toHaveValue('Changed');
});

test('export pack contains every format with the screenshot rendered', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export ZIP/ }).click()]);
  const zip = await readZip(download);

  expect(Object.keys(zip.files).sort()).toEqual(
    ['github@2x.png', 'linkedin@2x.png', 'open-graph@2x.png', 'project.json', 'square@2x.png', 'story@2x.png'].sort(),
  );

  // Browser Hero: the screenshot sits inside the browser frame.
  const cases: [string, number, number, [number, number]][] = [
    ['linkedin@2x.png', 2400, 1254, [0.75, 0.6]],
    ['square@2x.png', 2160, 2160, [0.5, 0.8]],
    ['story@2x.png', 2160, 3840, [0.5, 0.8]],
  ];
  for (const [name, w, h, at] of cases) {
    const png = await zip.file(name)!.async('uint8array');
    const res = await probePng(page, png, at);
    expect([res.width, res.height], name).toEqual([w, h]);
    expectColor(res.rgb, MAGENTA);
  }

  const json = JSON.parse(await zip.file('project.json')!.async('string'));
  expect(json.format).toBe('steffpoint-visual-studio/project');
  expect(Object.keys(json.assets)).toHaveLength(1);
});

test('project JSON round trip through import', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await titleBox(page).fill('Round trip');
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Back to Projects' }).click();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON' }).first().click()]);
  await page.locator('input[type=file][accept*=json]').setInputFiles(await download.path());
  await expect(titleBox(page)).toHaveValue('Round trip');
  await page.getByRole('tab', { name: 'Images' }).click();
  await expect.poll(() => page.locator('[role=tabpanel] li img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
});

test('editor tabs follow the ARIA tabs keyboard pattern', async ({ page }) => {
  await newProject(page);
  const tab = (name: string) => page.getByRole('tab', { name });
  await tab('Templates').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab('Images')).toBeFocused();
  await expect(tab('Images')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tab('Background')).toBeFocused();
  await page.keyboard.press('ArrowRight'); // wraps around
  await expect(tab('Templates')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tab('Background')).toBeFocused();
  // Roving tabindex: only the selected tab is in the tab order.
  await expect(page.locator('[role=tab][tabindex="0"]')).toHaveCount(1);
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-background');
});

test('focal point image reserves its size before decoding', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await page.locator('[role=tabpanel] li button').first().click();
  const img = page.getByRole('slider', { name: 'Focal point' }).locator('img');
  await expect(img).toHaveAttribute('width', '1600');
  const box = (await img.boundingBox())!;
  const ratio = await img.evaluate((i: HTMLImageElement) => i.naturalWidth / i.naturalHeight);
  expect(box.height).toBeLessThanOrEqual(192.5);
  expect(Math.abs(box.width / box.height - ratio)).toBeLessThan(0.02);
});

test('rename a project inline from the dashboard', async ({ page }) => {
  await newProject(page);
  await page.getByRole('button', { name: 'Back to Projects' }).click();
  const card = page.locator('li', { has: page.getByRole('button', { name: /^Rename / }) }).first();
  const nameBox = card.getByRole('textbox', { name: 'Project name' });

  // Esc cancels.
  const original = (await card.locator('p.truncate').innerText()).trim();
  await card.getByRole('button', { name: /^Rename / }).click();
  await expect(nameBox).toBeFocused();
  await nameBox.fill('Discarded');
  await page.keyboard.press('Escape');
  await expect(nameBox).toHaveCount(0);
  await expect(card).toContainText(original);

  // An empty name is rejected: Enter keeps editing, blur keeps the old name.
  await card.getByRole('button', { name: /^Rename / }).click();
  await nameBox.fill('   ');
  await page.keyboard.press('Enter');
  await expect(nameBox).toBeVisible();
  await expect(nameBox).toHaveAttribute('aria-invalid', 'true');

  // Enter saves, and the name survives a reload.
  await nameBox.fill('Launch visuals');
  await page.keyboard.press('Enter');
  await expect(nameBox).toHaveCount(0);
  await expect(card).toContainText('Launch visuals');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename Launch visuals' })).toBeVisible();

  // Blur saves too.
  await page.getByRole('button', { name: 'Rename Launch visuals' }).click();
  await page.getByRole('textbox', { name: 'Project name' }).fill('Blurred name');
  await page.getByRole('heading', { name: 'Projects' }).click();
  await expect(page.getByRole('button', { name: 'Rename Blurred name' })).toBeVisible();
});

test('editor screen exposes an h1 for assistive tech', async ({ page }) => {
  await newProject(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Editing: /);
});
