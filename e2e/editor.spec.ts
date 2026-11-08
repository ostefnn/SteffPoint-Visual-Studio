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
  await page.getByRole('button', { name: 'Back to projects' }).click();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON' }).first().click()]);
  await page.locator('input[type=file][accept*=json]').setInputFiles(await download.path());
  await expect(titleBox(page)).toHaveValue('Round trip');
  await page.getByRole('tab', { name: 'Images' }).click();
  await expect.poll(() => page.locator('[role=tabpanel] li img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
});
