import { describe, expect, it } from 'vitest';
import {
  analyzeProject,
  autoCarouselVariants,
  createProject,
  createScreenshotSlot,
  FORMAT_PRESETS,
  legendToText,
  migrateProject,
  parseLegendMarkdown,
  parseLegendText,
} from './index';
// Real capture report (a SharePoint web part's property pane), loaded as text by Vite.
import report from './__fixtures__/legende.md?raw';


describe('legend markdown report', () => {
  const doc = parseLegendMarkdown(report);

  it('reads the title and context', () => {
    expect(doc.title).toBe('Wave Banner');
    expect(doc.meta.find((m) => m.key === 'Version')?.value).toBe('0.0.1');
    expect(doc.meta.find((m) => m.key === 'SPFx')?.value).toBe('1.23.2');
  });

  it('reads every group with its file, alt text and fields', () => {
    expect(doc.groups).toHaveLength(10);
    const content = doc.groups[1];
    expect(content).toMatchObject({ heading: 'Contenu', file: '02-Contenu.png' });
    expect(content.alt).toContain('groupe Contenu');
    expect(content.items).toHaveLength(15);
    expect(content.items[0]).toEqual({ label: 'Afficher un contenu sur la bannière', prop: 'showContent', off: false });
    expect(content.items[9]).toEqual({ label: 'Libellé du bouton', prop: 'ctaLabel', off: true });
    const variant = doc.groups[8];
    expect(variant.heading).toBe('Forme et mouvement, variante Diagonale et biseau');
    expect(variant.file).toBe('05-Forme-et-mouvement_Diagonale-et-biseau.png');
    expect(variant.items.map((i) => i.prop)).toEqual(['slope', 'pivot', 'layers', 'mirror', 'waveOpacity', 'liseret', 'liseretColor', 'liseretOffset']);
  });

  it('accepts English headers and tables without a number column', () => {
    const d = parseLegendMarkdown(
      ['# Settings: Demo', '## General (general.png)', '| Field | Property | State |', '|--|--|--|', '| Title | `title` | Disabled |', '| Size | size | Active |'].join('\n'),
    );
    expect(d.title).toBe('Demo');
    expect(d.groups[0].items).toEqual([
      { label: 'Title', prop: 'title', off: true },
      { label: 'Size', prop: 'size', off: false },
    ]);
  });

  it('never throws on unrelated text', () => {
    expect(parseLegendMarkdown('hello\n| a |\n## nothing').groups).toEqual([]);
  });
});

describe('legend text form', () => {
  it('round-trips label, property and state', () => {
    const items = [
      { label: 'Amplitude (px)', prop: 'amplitude', off: false },
      { label: 'Couleur du liseré', prop: 'liseretColor', off: true },
      { label: 'Only a label', prop: '', off: false },
      { label: 'Off without prop', prop: '', off: true },
    ];
    expect(parseLegendText(legendToText(items))).toEqual(items);
  });

  it('ignores numbers and blank lines, and understands French and Dutch states', () => {
    expect(parseLegendText('1. Titre | title | Désactivé\n\n2) Taille | size | uitgeschakeld\n3 Hauteur')).toEqual([
      { label: 'Titre', prop: 'title', off: true },
      { label: 'Taille', prop: 'size', off: true },
      { label: '3 Hauteur', prop: '', off: false },
    ]);
  });
});

describe('annotated panel', () => {
  it('migrates legends safely', () => {
    const p = migrateProject({
      assets: [{ id: 'a', mime: 'image/png' }],
      screenshots: [{ assetId: 'a', legend: [{ label: 'x'.repeat(200), prop: '`p`', off: 'yes' }, 3, { label: '' }, ...Array(30).fill({ label: 'y' })] }, { assetId: 'a' }],
    });
    expect(p.screenshots[0].legend[0]).toEqual({ label: 'x'.repeat(90), prop: 'p', off: false });
    expect(p.screenshots[0].legend).toHaveLength(20);
    expect(p.screenshots[1].legend).toEqual([]);
  });

  it('builds a guide carousel: a title page, then one annotated page per screenshot', () => {
    const p = createProject({ template: 'annotated' });
    p.assets = [{ id: 'a', name: 'a.png', mime: 'image/png', width: 700, height: 1600, size: 1 }];
    p.screenshots = ['Affichage', 'Contenu'].map((caption) => ({ ...createScreenshotSlot('a'), caption }));
    const pages = autoCarouselVariants(p);
    expect(pages.map((v) => v.template)).toEqual(['minimal', 'annotated', 'annotated']);
    expect(pages[2]).toMatchObject({ screenshotIds: [p.screenshots[1].id], content: { title: 'Contenu' } });
  });

  it('suggests a legend, and a portrait format for long legends', () => {
    const p = createProject({ template: 'annotated' });
    p.assets = [{ id: 'a', name: 'a.png', mime: 'image/png', width: 700, height: 1600, size: 1 }];
    p.screenshots = [createScreenshotSlot('a')];
    expect(analyzeProject(p, FORMAT_PRESETS.linkedin).map((s) => s.id)).toContain('legend-empty');
    p.screenshots[0].legend = Array.from({ length: 12 }, (_, i) => ({ label: `Field ${i}`, prop: '', off: false }));
    expect(analyzeProject(p, FORMAT_PRESETS['open-graph']).map((s) => s.id)).toContain('legend-dense');
    expect(analyzeProject(p, FORMAT_PRESETS['linkedin-carousel']).map((s) => s.id)).not.toContain('legend-dense');
  });
});
