import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { addScreenshot, CYAN, expectColor, FIXTURES, MAGENTA, newProject, probePng, readZip } from './helpers';

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

test('Device Mix desktop + mobile renders both screenshots', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await addScreenshot(page, 'desktop-cyan.png');
  await useTemplate(page, 'Device Mix');
  await page.getByRole('group', { name: 'Devices' }).getByRole('checkbox', { name: 'Tablet' }).uncheck({ force: true });
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

test('Device Mix turns the tablet and phone to landscape', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await addScreenshot(page, 'desktop-cyan.png');
  await useTemplate(page, 'Device Mix');
  await page.getByRole('group', { name: 'Devices' }).getByRole('checkbox', { name: 'Desktop' }).uncheck({ force: true });
  const images = page.getByTestId('canvas').locator('img');
  await expect(images).toHaveCount(2);
  const isWide = async (i: number) => {
    // The image box clips the screenshot; its shape is the device screen's shape.
    const box = (await images.nth(i).locator('..').boundingBox())!;
    return box.width > box.height;
  };
  expect([await isWide(0), await isWide(1)]).toEqual([false, false]);

  for (const device of ['Tablet', 'Mobile']) {
    await page.getByRole('radiogroup', { name: `${device} orientation` }).getByRole('radio', { name: 'Landscape' }).click();
  }
  await expect.poll(async () => [await isWide(0), await isWide(1)]).toEqual([true, true]);

  // The choice is saved with the project.
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Mobile orientation' }).getByRole('radio', { name: 'Landscape' })).toBeChecked();
});

test('Layout options mirror and tilt the template, and are saved', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await useTemplate(page, 'Browser Hero');
  // Browser Hero puts the screenshot on the right of the text.
  let png = await exportLinkedIn(page);
  expectColor((await probePng(page, png, [0.75, 0.55])).rgb, MAGENTA);

  // Mirrored: the screenshot moves to the left, the text to the right.
  await page.getByRole('checkbox', { name: /^Mirror/ }).check();
  png = await exportLinkedIn(page);
  expectColor((await probePng(page, png, [0.25, 0.55])).rgb, MAGENTA);
  expect((await probePng(page, png, [0.75, 0.55])).rgb).not.toEqual([...MAGENTA]);

  // Tilted and 3D screens still show the screenshot.
  for (const tilt of ['Tilted', '3D']) {
    await page.getByRole('radiogroup', { name: 'Screens' }).getByRole('radio', { name: tilt, exact: true }).click();
    await expect(page.getByTestId('canvas').locator('[data-tilt]')).toHaveCount(1);
    expectColor((await probePng(page, await exportLinkedIn(page), [0.25, 0.55])).rgb, MAGENTA);
  }

  // Templates without tilt do not offer it, and their canvas stays straight.
  await useTemplate(page, 'Minimal');
  await expect(page.getByRole('radiogroup', { name: 'Screens' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /^Mirror/ })).toHaveCount(0);
  await expect(page.getByTestId('canvas').locator('[data-tilt]')).toHaveCount(0);

  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  await page.reload();
  await useTemplate(page, 'Browser Hero');
  await expect(page.getByRole('checkbox', { name: /^Mirror/ })).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Screens' }).getByRole('radio', { name: '3D' })).toBeChecked();
});

test('Text position Bottom puts the text below the screens in stacked formats', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await useTemplate(page, 'Spotlight');
  await page.getByRole('button', { name: 'Preview Square 1:1', exact: true }).click();
  const canvas = page.getByTestId('canvas');
  const title = canvas.locator('h1');
  const shot = canvas.locator('img').first();
  const centre = async (l: typeof title) => {
    const b = (await l.boundingBox())!;
    return b.y + b.height / 2;
  };
  expect(await centre(title)).toBeLessThan(await centre(shot));
  await page.getByRole('radiogroup', { name: 'Text position' }).getByRole('radio', { name: 'Bottom' }).click();
  await expect.poll(async () => (await centre(title)) > (await centre(shot))).toBe(true);
});

test('Call to Action draws a scannable QR code and the brand footer', async ({ page }) => {
  await newProject(page);
  await useTemplate(page, 'Call to Action');
  const canvas = page.getByTestId('canvas');
  await page.getByRole('textbox', { name: 'Button', exact: true }).fill('Open the app');
  await page.getByRole('textbox', { name: 'Link', exact: false }).first().fill('https://example.com/app');
  await expect(canvas).toContainText('Open the app');
  await expect(canvas).toContainText('https://example.com/app');
  await expect(canvas.locator('[data-qr]')).toHaveCount(0);
  await page.getByRole('checkbox', { name: /QR code/ }).check();
  await expect(canvas.locator('[data-qr] path')).toHaveAttribute('d', /^M\d/);

  // The footer takes the link: it is not written twice.
  await page.getByRole('tab', { name: 'Brand' }).click();
  await page.getByRole('checkbox', { name: /Brand footer/ }).check();
  await expect(canvas.locator('[data-footer]')).toContainText('https://example.com/app');
  await expect(canvas.getByText('https://example.com/app')).toHaveCount(1);

  // On a carousel page that is not the last, the footer invites people to swipe.
  await page.getByRole('tab', { name: 'Carousel' }).click();
  await page.getByRole('button', { name: 'Customize Pages' }).click();
  await page.getByRole('button', { name: 'Add Page' }).click();
  await expect(canvas.locator('[data-footer]')).not.toContainText('Swipe');
  await page.getByRole('button', { name: /^Page 1:/ }).click();
  await expect(canvas.locator('[data-footer]')).toContainText('Swipe');
});

test('Hidden areas are covered in the export, and in the Detail Zoom lens', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await useTemplate(page, 'Spotlight');
  expectColor((await probePng(page, await exportLinkedIn(page), [0.5, 0.75])).rgb, MAGENTA);

  // Drag across the middle of the screenshot.
  const area = page.getByTestId('redact-area');
  await area.scrollIntoViewIfNeeded();
  const b = (await area.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.05, b.y + b.height * 0.05);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.95, b.y + b.height * 0.95, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Show area 1 again' })).toBeVisible();
  expectColor((await probePng(page, await exportLinkedIn(page), [0.5, 0.75])).rgb, [42, 46, 56]);

  await useTemplate(page, 'Detail Zoom');
  await expect(page.getByTestId('canvas').locator('[data-lens] [data-redactions]')).toHaveCount(1);

  // Removing the area shows the screenshot again.
  await page.getByRole('button', { name: 'Show area 1 again' }).click();
  await expect(page.getByTestId('canvas').locator('[data-redactions]')).toHaveCount(0);
});

test('Crop and zoom out reshape the screenshot in the export', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'split-cyan-magenta.png'); // left half cyan, right half magenta
  await useTemplate(page, 'Spotlight'); // the imported screenshot is already selected
  // Uncropped: the left of the frame shows the cyan half.
  expectColor((await probePng(page, await exportLinkedIn(page), [0.4, 0.7])).rgb, CYAN);

  // Cropping 45% from the left leaves (almost) only the magenta half.
  await page.getByRole('slider', { name: /^Crop left/ }).fill('0.45');
  await expect(page.getByTestId('crop-area')).toBeVisible();
  expectColor((await probePng(page, await exportLinkedIn(page), [0.4, 0.7])).rgb, MAGENTA);

  // Reset, then zoom out: the image shrinks and the frame's edge shows the card background.
  await page.getByRole('button', { name: 'Reset Crop' }).click();
  await page.getByRole('slider', { name: /^Zoom/ }).fill('0.5');
  const { rgb } = await probePng(page, await exportLinkedIn(page), [0.2, 0.7]);
  const [r, g, b] = rgb;
  expect(Math.abs(r - CYAN[0]) + Math.abs(g - CYAN[1]) + Math.abs(b - CYAN[2])).toBeGreaterThan(150);
});

test('Logo size switches between small, medium and large', async ({ page }) => {
  await newProject(page);
  await page.getByRole('tab', { name: 'Brand' }).click();
  await page.locator('[role=tabpanel] input[type=file]:not([multiple])').setInputFiles(path.join(FIXTURES, 'logo-300.png'));
  const preview = page.getByRole('img', { name: 'Logo' });
  await expect(preview).toBeVisible();
  const src = (await preview.getAttribute('src'))!;
  const logo = page.getByTestId('canvas').locator(`img[src="${src}"]`);
  const height = async () => (await logo.boundingBox())!.height;
  const sizes = page.getByRole('radiogroup', { name: 'Logo size' });
  await expect(sizes.getByRole('radio', { name: 'Medium' })).toBeChecked();
  const medium = await height();
  await sizes.getByRole('radio', { name: 'Large' }).click();
  await expect.poll(height).toBeCloseTo((medium * 2) / 1.4, 0);
  await sizes.getByRole('radio', { name: 'Small' }).click();
  await expect.poll(height).toBeCloseTo(medium / 1.4, 0);
});

test('Export shadows fade out instead of leaving a grey block (Safari)', async ({ page }) => {
  await newProject(page);
  await page.getByRole('tab', { name: 'Brand' }).click();
  // Soft shadows belong to the Soft style (the others use no shadow or a hard one).
  await page.getByRole('radio', { name: /^Soft/ }).click();
  await page.getByRole('slider', { name: /^Shadow/ }).fill('1');
  await page.getByRole('tab', { name: 'Background' }).click();
  await page.locator('[role=tabpanel] button', { hasText: 'Solid' }).click();
  // Browser Hero on LinkedIn: the window's left edge is at x = 600 px, 1u = 6.27 px.
  const png = await exportLinkedIn(page);
  await test.info().attach('linkedin-export.png', { body: Buffer.from(png), contentType: 'image/png' });
  const u = 6.27 / 1200; // 1u (1% of the 627 px height) as a fraction of the width
  const lum = async (x: number) => {
    const [r, g, b] = (await probePng(page, png, [x, 0.9])).rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // Walk left from the window edge in 0.5u steps: a soft shadow lightens gradually; WebKit's broken
  // box-shadow left a flat grey block that ends in a hard edge.
  const row: number[] = [];
  for (let i = 1; i <= 16; i++) row.push(await lum(0.5 - (i * u) / 2));
  const background = await lum(0.4);
  for (let i = 1; i < row.length; i++) {
    expect(Math.abs(row[i] - row[i - 1]), `luminance jump between ${(i / 2).toFixed(1)}u and ${((i + 1) / 2).toFixed(1)}u: ${row.map(Math.round)}`).toBeLessThanOrEqual(25);
  }
  expect(Math.abs(row[row.length - 1] - background), `8u out should be plain background: ${row.map(Math.round)}`).toBeLessThanOrEqual(6);
});

test('App Store exports the exact iPhone screenshot size', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await useTemplate(page, 'App Store');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const box of await dialog.getByRole('checkbox').all()) {
    const label = (await box.locator('xpath=..').innerText()).trim();
    const want = label.startsWith('App Store iPhone');
    if ((await box.isChecked()) !== want && !label.startsWith('Include')) await box.click();
  }
  await dialog.getByRole('radio', { name: '1×' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Export ZIP/ }).click()]);
  const png = await (await readZip(download)).file('appstore-iphone.png')!.async('uint8array');
  const res = await probePng(page, png, [0.5, 0.7]); // inside the phone
  expect([res.width, res.height]).toEqual([1320, 2868]);
  expectColor(res.rgb, MAGENTA);
});

test('Testimonial, Key Figures and Event render their own fields', async ({ page }) => {
  await newProject(page);
  const canvas = page.getByTestId('canvas');
  await useTemplate(page, 'Testimonial');
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Quote', exact: true }).fill('Best tool we bought this year.');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Dana Smith');
  await expect(canvas).toContainText('Best tool we bought this year.');
  await expect(canvas).toContainText('DS'); // initials without a photo

  await useTemplate(page, 'Key Figures');
  await page.getByRole('textbox', { name: 'Figure 4 value' }).fill('99%');
  await page.getByRole('textbox', { name: 'Figure 4 label' }).fill('Uptime');
  await expect(canvas).toContainText('99%');
  await expect(canvas).toContainText('Uptime');

  await useTemplate(page, 'Event');
  await page.getByRole('textbox', { name: 'Date', exact: true }).fill('Fri 6 June');
  await page.getByRole('textbox', { name: 'Call to action' }).fill('Save your seat');
  await expect(canvas).toContainText('Fri 6 June');
  await expect(canvas).toContainText('Save your seat');
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

test('Laptop frame keeps a real 16:10 screen in every format', async ({ page }) => {
  await newProject(page);
  await addScreenshot(page, 'desktop-magenta.png');
  await page.getByRole('radio', { name: 'Laptop' }).click();
  for (const format of ['LinkedIn', 'Square 1:1', 'Story 9:16', 'Banner']) {
    await page.locator('ul[aria-label=Formats] li', { hasText: format }).first().locator('button').click();
    const ratio = await page.getByTestId('canvas').locator('[data-laptop-screen-ratio] > div').first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    });
    expect(ratio, format).toBeCloseTo(1.6, 1);
    // The whole laptop, base included, stays inside the canvas.
    const [laptop, canvas] = await Promise.all([
      page.getByTestId('canvas').locator('[data-laptop-screen-ratio]').first().locator('xpath=..').boundingBox(),
      page.getByTestId('canvas').locator('> div').first().boundingBox(),
    ]);
    expect(laptop!.y + laptop!.height, format).toBeLessThanOrEqual(canvas!.y + canvas!.height + 1);
  }
});
