/**
 * Editor theme: follow the system, or force light or dark. Stored per browser.
 * Only the editor's own UI changes; exported visuals keep the project's theme.
 */
import { useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'svs-theme';

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // Storage blocked: follow the system.
  }
  return 'system';
}

let current: ThemePref = read();
const listeners = new Set<() => void>();

function apply() {
  const root = document.documentElement;
  if (current === 'system') delete root.dataset.theme;
  else root.dataset.theme = current;
}
if (typeof document !== 'undefined') apply();

export function getThemePref(): ThemePref {
  return current;
}

export function setThemePref(pref: ThemePref): void {
  current = pref;
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Not remembered, still applied.
  }
  apply();
  listeners.forEach((f) => f());
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    getThemePref,
    getThemePref,
  );
}
