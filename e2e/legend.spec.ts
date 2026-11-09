import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { FIXTURES } from './helpers';

const LEGEND = `# Volet de propriétés : Wave Banner

## Contexte de l'export

- **Web part** : Wave Banner
- **Version** : 0.0.1
- **SPFx** : 1.23.2

## Affichage (01-Affichage.png)

![Volet de réglages, groupe Affichage.](01-Affichage.png)

| N° | Champ | Propriété | État |
|---|---|---|---|
| 1 | Type de bord | \`edgeFamily\` | Actif |
| 2 | Hauteur de la bannière (px) | \`heroHeight\` | Actif |
| 3 | Libellé du bouton | \`ctaLabel\` | Désactivé |

## Couleurs (06-Couleurs.png)

| N° | Champ | Propriété | État |
|---|---|---|---|
| 1 | Origine des couleurs | \`colorMode\` | Actif |

## Apparence (07-Apparence.png)

| N° | Champ | Propriété | État |
|---|---|---|---|
| 1 | Couleur d'administration | \`adminColor\` | Actif |
`;

test('Import Legend turns a capture report into an annotated guide', async ({ page }) => {
  await page.goto('/');
  const tall = await readFile(path.join(FIXTURES, 'panel-tall.png'));
  const wide = await readFile(path.join(FIXTURES, 'desktop-cyan.png'));
  await page.getByLabel('Legend file and screenshots').setInputFiles([
    { name: 'legende.md', mimeType: 'text/markdown', buffer: Buffer.from(LEGEND) },
    { name: '01-Affichage.png', mimeType: 'image/png', buffer: tall },
    { name: '06-Couleurs.png', mimeType: 'image/png', buffer: wide },
    // 07-Apparence.png is not selected: it is reported, not invented.
  ]);
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  await expect(page.getByRole('alert').filter({ hasText: '07-Apparence.png' })).toBeVisible();

  const canvas = page.getByTestId('canvas');
  await expect(canvas).toContainText('Wave Banner');
  await expect(canvas).toContainText('Version 0.0.1, SPFx 1.23.2');
  await expect(canvas).toContainText('Hauteur de la bannière (px)');
  await expect(canvas).toContainText('heroHeight');

  // The screenshot keeps its own proportions, uncropped.
  const shot = canvas.locator('[data-annotated-shot]');
  const box = (await shot.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(600 / 1500, 1);

  // Editing the legend updates the canvas.
  await page.getByRole('tab', { name: 'Images' }).click();
  await page.locator('[role=tabpanel] li button').first().click();
  const legend = page.getByRole('textbox', { name: 'Legend' });
  await expect(legend).toHaveValue('Type de bord | edgeFamily\nHauteur de la bannière (px) | heroHeight\nLibellé du bouton | ctaLabel | off');
  await legend.fill('Type de bord | edgeFamily\nLargeur maximale | maxWidth');
  await expect(canvas).toContainText('Largeur maximale');
  await expect(canvas).not.toContainText('Libellé du bouton');
  await expect(page.getByTestId('save-state')).toHaveText('Saved');

  // Carousel: a title page, then one annotated page per imported section.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const slides = dialog.getByRole('list', { name: 'Carousel slides' }).getByRole('listitem');
  await expect(slides).toHaveCount(3);
  await expect(slides.nth(1)).toContainText('Affichage');
  await expect(slides.nth(2)).toContainText('Couleurs');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: /Export Carousel PDF \(3 Pages\)/ }).click(),
  ]);
  const pdf = await PDFDocument.load(await readFile(await download.path()));
  expect(pdf.getPageCount()).toBe(3);
});

test('Import Legend explains what is missing', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Legend file and screenshots').setInputFiles([
    { name: 'legende.md', mimeType: 'text/markdown', buffer: Buffer.from(LEGEND) },
  ]);
  await expect(page.getByRole('alert')).toContainText('None of the images named in legende.md were selected');
});
