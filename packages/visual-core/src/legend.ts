/**
 * Legends for the Annotated Panel template: the numbered fields of a screenshot whose
 * badges (1, 2, 3…) are already drawn in the image. Item i of the legend answers badge i + 1.
 *
 * Two text formats are supported:
 *   - an editable plain-text form, one field per line: `Label | property | off`
 *   - a Markdown capture report (`## Group (file.png)` sections with a field table),
 *     such as the ones exported by property-pane capture tools.
 */

export interface LegendItem {
  /** Field name as shown in the screenshot. */
  label: string;
  /** Technical name (property, setting key…). Optional. */
  prop: string;
  /** The field is disabled (greyed out) in the screenshot. */
  off: boolean;
}

export const LEGEND_LIMITS = { items: 20, label: 90, prop: 48 } as const;

const clean = (s: string, max: number) =>
  // eslint-disable-next-line no-control-regex
  s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Normalise any value into a valid legend (used by migration and imports). */
export function normalizeLegend(v: unknown): LegendItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      label: clean(typeof x.label === 'string' ? x.label : '', LEGEND_LIMITS.label),
      prop: clean(typeof x.prop === 'string' ? x.prop : '', LEGEND_LIMITS.prop).replace(/`/g, ''),
      off: x.off === true,
    }))
    .filter((x) => x.label || x.prop)
    .slice(0, LEGEND_LIMITS.items);
}

// ---------------------------------------------------------------------------
// Plain-text form
// ---------------------------------------------------------------------------

const OFF_WORDS = /^(off|disabled|inactive|d[ée]sactiv[ée]e?|gris[ée]e?|uitgeschakeld|inactief|uit)$/i;

export function legendToText(items: LegendItem[]): string {
  return items
    .map((i) => {
      const parts = [i.label];
      if (i.prop || i.off) parts.push(i.prop);
      if (i.off) parts.push('off');
      return parts.join(' | ');
    })
    .join('\n');
}

/** One field per line: `Label | property | off`. Property and state are optional. */
export function parseLegendText(text: string): LegendItem[] {
  return normalizeLegend(
    text
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((line) => {
        const [label = '', prop = '', state = ''] = line.split('|').map((s) => s.trim());
        // A leading "1." or "1)" is allowed: numbers come from the order.
        return { label: label.replace(/^\d+\s*[.)]\s*/, ''), prop: prop.replace(/`/g, ''), off: OFF_WORDS.test(state) };
      }),
  );
}

// ---------------------------------------------------------------------------
// Markdown capture report
// ---------------------------------------------------------------------------

export interface LegendGroup {
  /** Section heading without the file name, e.g. "Forme et mouvement, variante Fondu de teinte". */
  heading: string;
  /** Image file the section describes, e.g. "05-Forme-et-mouvement.png". Empty if none. */
  file: string;
  /** Suggested alt text, when the report gives one. */
  alt: string;
  items: LegendItem[];
}

export interface LegendDocument {
  /** Name of what is documented (web part, component…). */
  title: string;
  /** "Key: value" lines of the context section, in order. */
  meta: { key: string; value: string }[];
  groups: LegendGroup[];
}

const LABEL_HEADERS = /^(champ|field|label|name|nom|veld|setting|réglage|reglage|instelling)$/i;
const PROP_HEADERS = /^(propri[ée]t[ée]|property|prop|key|cl[ée]|eigenschap|id)$/i;
const STATE_HEADERS = /^([ée]tat|state|status|staat|toestand)$/i;
const NUMBER_HEADERS = /^(n°|no|nr|#|num|number|numéro|nummer)\.?$/i;
const TITLE_KEYS = /^(web ?part|component|composant|name|nom|naam|app|application|product|produit)$/i;

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

const stripInline = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/^\*(.*)\*$/, '$1').trim();

/** Read a Markdown capture report. Unknown parts are ignored; it never throws. */
export function parseLegendMarkdown(md: string): LegendDocument {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const doc: LegendDocument = { title: '', meta: [], groups: [] };
  let h1 = '';
  let group: LegendGroup | null = null;
  let table: { label: number; prop: number; state: number } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      table = null;
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1) {
        h1 = text;
        group = null;
        continue;
      }
      const file = /\(([^()]+\.(?:png|jpe?g|webp|gif))\)\s*$/i.exec(text);
      if (level === 2 && file) {
        group = { heading: clean(text.slice(0, file.index), 200), file: file[1].trim(), alt: '', items: [] };
        doc.groups.push(group);
      } else {
        group = null;
      }
      continue;
    }
    if (!group) {
      // Context bullets: "- **Web part** : Wave Banner"
      const meta = /^[-*]\s+(.+?)\s*:\s*(.+)$/.exec(line);
      if (meta) doc.meta.push({ key: stripInline(meta[1]), value: stripInline(meta[2]) });
      continue;
    }
    const img = /!\[([^\]]*)\]\(([^)]+)\)/.exec(line);
    if (img) {
      if (!group.alt) group.alt = clean(img[1], 300);
      if (!group.file) group.file = img[2].trim();
      continue;
    }
    const alt = /^\*?(texte alternatif|alt text|alternatieve tekst)[^:]*:\s*(.+)$/i.exec(stripInline(line));
    if (alt) {
      group.alt = clean(stripInline(alt[2]), 300);
      continue;
    }
    if (!line.startsWith('|')) {
      table = null;
      continue;
    }
    const row = cells(line);
    if (row.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator
    if (!table) {
      // Header row: find the columns by name, fall back to "N° | Field | Property | State".
      const find = (re: RegExp) => row.findIndex((c) => re.test(stripInline(c)));
      const hasNumber = NUMBER_HEADERS.test(stripInline(row[0] ?? ''));
      const label = find(LABEL_HEADERS);
      table = {
        label: label >= 0 ? label : hasNumber ? 1 : 0,
        prop: find(PROP_HEADERS),
        state: find(STATE_HEADERS),
      };
      if (table.prop < 0 && row.length > table.label + 1) table.prop = table.label + 1;
      continue;
    }
    if (group.items.length >= LEGEND_LIMITS.items) continue;
    const state = table.state >= 0 ? stripInline(row[table.state] ?? '') : '';
    group.items.push({
      label: clean(stripInline(row[table.label] ?? ''), LEGEND_LIMITS.label),
      prop: table.prop >= 0 ? clean(stripInline(row[table.prop] ?? ''), LEGEND_LIMITS.prop) : '',
      off: OFF_WORDS.test(state),
    });
  }

  const named = doc.meta.find((m) => TITLE_KEYS.test(m.key));
  // "# Volet de propriétés : Wave Banner" → "Wave Banner"
  const fromH1 = h1.includes(':') ? h1.slice(h1.lastIndexOf(':') + 1).trim() : h1;
  doc.title = clean(named?.value || fromH1, 120);
  doc.groups = doc.groups.map((g) => ({ ...g, items: normalizeLegend(g.items) }));
  return doc;
}
