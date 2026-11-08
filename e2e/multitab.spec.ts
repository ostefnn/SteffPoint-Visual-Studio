import { expect, test } from '@playwright/test';
import { addScreenshot, newProject, titleBox } from './helpers';

test('closing a stale tab does not delete images added in another tab', async ({ context }) => {
  const a = await context.newPage();
  await newProject(a);
  const url = a.url();

  const b = await context.newPage();
  await b.goto(url);
  await expect(b.getByTestId('save-state')).toHaveText('Saved');
  await addScreenshot(b, 'desktop-cyan.png');

  // Tab A had no unsaved change: it follows B instead of keeping a stale copy.
  await a.getByRole('tab', { name: 'Images' }).click();
  await expect(a.locator('[role=tabpanel] li')).toHaveCount(1);

  // Leave A (triggers its exit save + garbage collection), then check B's image is intact.
  await a.getByRole('button', { name: 'Back to Projects' }).click();
  await a.waitForTimeout(500);
  await b.reload();
  await b.getByRole('tab', { name: 'Images' }).click();
  await expect.poll(() => b.locator('[role=tabpanel] li img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
});

test('concurrent edits raise a conflict instead of overwriting', async ({ context }) => {
  const a = await context.newPage();
  await newProject(a);
  const b = await context.newPage();
  await b.goto(a.url());
  await expect(b.getByTestId('save-state')).toHaveText('Saved');

  // Both tabs edit from the same revision before either has saved.
  await Promise.all([titleBox(a).fill('From tab A'), titleBox(b).fill('From tab B')]);

  const conflictA = a.getByRole('alert').filter({ hasText: 'changed in another tab' });
  const conflictB = b.getByRole('alert').filter({ hasText: 'changed in another tab' });
  await expect.poll(async () => (await conflictA.isVisible()) || (await conflictB.isVisible())).toBe(true);
  const loser = (await conflictA.isVisible()) ? a : b;
  const winner = loser === a ? b : a;
  const loserTitle = await titleBox(loser).inputValue();

  // Nothing was silently overwritten: the stored version is the winner's.
  await loser.getByRole('button', { name: 'Keep My Version' }).click();
  await expect(loser.getByTestId('save-state')).toHaveText('Saved');
  // The other tab follows the explicit choice.
  await expect(titleBox(winner)).toHaveValue(loserTitle);
});
