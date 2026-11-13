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
  // The original file (1600 px) is back: the main preview draws it (the list shows a reduced copy).
  await expect.poll(() => b.locator('[data-testid=canvas] img').first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
});

test('concurrent edits raise a conflict instead of overwriting', async ({ context }) => {
  // Freeze timers (the clock is shared by every tab of the context) so both autosaves
  // stay pending: both tabs then edit from the same revision, whatever the machine speed.
  await context.clock.install();
  const a = await context.newPage();
  await newProject(a);
  const b = await context.newPage();
  await b.goto(a.url());
  await expect(b.getByTestId('save-state')).toHaveText('Saved');

  await titleBox(b).fill('From tab B');
  await titleBox(a).fill('From tab A');
  // Both saves now run; IndexedDB serialises them, so exactly one wins and the other is refused.
  await context.clock.runFor(1000);

  const conflict = (p: typeof a) => p.getByRole('alert').filter({ hasText: 'changed in another tab' });
  await expect.poll(async () => [await conflict(a).isVisible(), await conflict(b).isVisible()].filter(Boolean).length).toBe(1);
  const loser = (await conflict(a).isVisible()) ? a : b;
  const winner = loser === a ? b : a;
  const loserTitle = loser === a ? 'From tab A' : 'From tab B';
  const winnerTitle = loser === a ? 'From tab B' : 'From tab A';
  await expect(winner.getByTestId('save-state')).toHaveText('Saved');
  await expect(titleBox(winner)).toHaveValue(winnerTitle); // the stored version was not overwritten
  await expect(titleBox(loser)).toHaveValue(loserTitle); // and the refused edit is kept, not lost

  // The explicit choice wins, and the other tab follows it.
  await loser.getByRole('button', { name: 'Keep My Version' }).click();
  await expect(loser.getByTestId('save-state')).toHaveText('Saved');
  await expect(titleBox(winner)).toHaveValue(loserTitle);
});
