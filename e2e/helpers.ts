import { expect, type Download, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const FIXTURES = path.join(import.meta.dirname, 'fixtures');
export const MAGENTA = [255, 0, 170] as const;
export const CYAN = [0, 170, 255] as const;

export async function newProject(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project' }).first().click();
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
}

export async function addScreenshot(page: Page, file: string) {
  await page.getByRole('tab', { name: 'Images' }).click();
  const before = await page.locator('[role=tabpanel] li').count();
  await page.locator('input[type=file][multiple]').setInputFiles(path.join(FIXTURES, file));
  try {
    await expect(page.locator('[role=tabpanel] li')).toHaveCount(before + 1);
  } catch (e) {
    // Surface the app's own error toast, if any, to make CI failures diagnosable.
    const toast = await page.getByRole('alert').allInnerTexts().catch(() => []);
    throw new Error(`Screenshot was not added. App message: ${toast.join(' | ') || '(none)'}\n${e}`);
  }
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
}

export const titleBox = (page: Page) => page.getByRole('textbox', { name: 'Title', exact: true });

export async function readZip(download: Download) {
  return JSZip.loadAsync(await readFile(await download.path()));
}

/** Decode a PNG in the page and return its size and the RGB value at relative coordinates. */
export async function probePng(page: Page, png: Uint8Array, at: [number, number]) {
  return page.evaluate(
    async ({ b64, at }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(Math.round(at[0] * bmp.width), Math.round(at[1] * bmp.height), 1, 1).data;
      return { width: bmp.width, height: bmp.height, rgb: [d[0], d[1], d[2]] };
    },
    { b64: Buffer.from(png).toString('base64'), at },
  );
}

export function expectColor(rgb: number[], expected: readonly number[], tolerance = 16) {
  rgb.forEach((v, i) => expect(Math.abs(v - expected[i]), `channel ${i}: got ${rgb} expected ${expected}`).toBeLessThanOrEqual(tolerance));
}
