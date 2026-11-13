/**
 * Interface language: English (default), French and Dutch.
 * Texts are written in English in the code and wrapped in `t()`; the French and Dutch dictionaries
 * map each English text to its translation. A missing translation falls back to English.
 * `{name}` placeholders are filled from `params`.
 */
import { useSyncExternalStore } from 'react';
import type { Content } from '@svs/visual-core';
import { fr } from './fr';
import { nl } from './nl';

export type Lang = 'en' | 'fr' | 'nl';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'nl', label: 'Nederlands' },
];

const DICTS: Record<Exclude<Lang, 'en'>, Record<string, string>> = { fr, nl };
const KEY = 'svs-lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'fr' || saved === 'nl') return saved;
  } catch {
    // Storage blocked: fall back to the browser language.
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  return nav.startsWith('fr') ? 'fr' : nav.startsWith('nl') ? 'nl' : 'en';
}

let current: Lang = detect();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Not remembered, still applied.
  }
  document.documentElement.lang = lang;
  listeners.forEach((f) => f());
}

/** Re-render on language change. Used once at the root: every component below re-renders with it. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    getLang,
    getLang,
  );
}

const fill = (text: string, params?: Record<string, string | number>) =>
  params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text;

/** Translate an English interface text. */
export function t(text: string, params?: Record<string, string | number>): string {
  const tr = current === 'en' ? text : (DICTS[current][text] ?? text);
  return fill(tr, params);
}

/** Translate a suggestion from the core: its template, and its text values (template and format names). */
export function tMessage(s: { message: string; text?: string; params?: Record<string, string | number> }): string {
  if (!s.text) return s.message;
  const params = s.params && Object.fromEntries(Object.entries(s.params).map(([k, v]) => [k, typeof v === 'string' ? t(v) : v]));
  return t(s.text, params);
}

/**
 * Content in the interface language: every text that is a known English default or sample is
 * replaced by its translation; anything the user wrote is left as is (it is not a key).
 */
export function localizeContent(c: Content): Content {
  return {
    ...c,
    kicker: t(c.kicker),
    title: t(c.title),
    subtitle: t(c.subtitle),
    beforeLabel: t(c.beforeLabel),
    afterLabel: t(c.afterLabel),
    features: c.features.map((f) => t(f)),
    quote: t(c.quote),
    author: t(c.author),
    authorRole: t(c.authorRole),
    stats: c.stats.map((s) => ({ value: s.value, label: t(s.label) })),
    eventDate: t(c.eventDate),
    eventTime: t(c.eventTime),
    eventPlace: t(c.eventPlace),
    cta: t(c.cta),
    steps: c.steps.map((s) => ({ title: t(s.title), text: t(s.text) })),
    compare: { columns: c.compare.columns.map((x) => t(x)), rows: c.compare.rows.map((r) => ({ label: t(r.label), cells: r.cells.map((x) => t(x)) })) },
    code: c.code.replace('// Replace with a short snippet from your product.', `// ${t('Replace with a short snippet from your product.')}`),
  };
}
