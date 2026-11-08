/**
 * Editor state with a bounded undo/redo history.
 * Every change goes through `update`, which snapshots the previous project.
 * Rapid changes sharing a `coalesceKey` (typing, slider drags) collapse into one history entry.
 */
import { create } from 'zustand';
import type { FormatId, Project } from '@svs/visual-core';

const HISTORY_LIMIT = 60;
const COALESCE_MS = 700;

interface EditorState {
  project: Project | null;
  past: Project[];
  future: Project[];
  lastKey: string | null;
  lastAt: number;
  /** Object URLs for the current project's assets, keyed by asset id. */
  urls: Record<string, string>;
  selectedShotId: string | null;
  activeFormat: FormatId;
  showSafeZones: boolean;

  open(project: Project, urls: Record<string, string>): void;
  close(): void;
  update(mutate: (draft: Project) => void, coalesceKey?: string): void;
  undo(): void;
  redo(): void;
  addUrl(assetId: string, url: string): void;
  selectShot(id: string | null): void;
  setActiveFormat(id: FormatId): void;
  toggleSafeZones(): void;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
  urls: {},
  selectedShotId: null,
  activeFormat: 'linkedin',
  showSafeZones: false,

  open(project, urls) {
    revokeAll(get().urls);
    set({
      project,
      urls,
      past: [],
      future: [],
      lastKey: null,
      selectedShotId: project.screenshots[0]?.id ?? null,
      activeFormat: project.exportPresets[0] ?? 'linkedin',
    });
  },

  close() {
    revokeAll(get().urls);
    set({ project: null, urls: {}, past: [], future: [], selectedShotId: null });
  },

  update(mutate, coalesceKey) {
    const { project, past, lastKey, lastAt } = get();
    if (!project) return;
    const next = structuredClone(project);
    mutate(next);
    const now = Date.now();
    const coalesce = !!coalesceKey && coalesceKey === lastKey && now - lastAt < COALESCE_MS;
    set({
      project: next,
      past: coalesce ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      lastKey: coalesceKey ?? null,
      lastAt: now,
    });
  },

  undo() {
    const { project, past, future } = get();
    if (!project || !past.length) return;
    const prev = past[past.length - 1];
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastKey: null });
  },

  redo() {
    const { project, past, future } = get();
    if (!project || !future.length) return;
    const [next, ...rest] = future;
    set({ project: next, past: [...past, project], future: rest, lastKey: null });
  },

  addUrl(assetId, url) {
    set({ urls: { ...get().urls, [assetId]: url } });
  },
  selectShot(id) {
    set({ selectedShotId: id });
  },
  setActiveFormat(id) {
    set({ activeFormat: id });
  },
  toggleSafeZones() {
    set({ showSafeZones: !get().showSafeZones });
  },
}));

function revokeAll(urls: Record<string, string>) {
  Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
}
