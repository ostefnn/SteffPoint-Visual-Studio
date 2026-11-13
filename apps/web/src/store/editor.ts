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
  /**
   * True from the instant the project changes until it is stored. Set synchronously
   * so the UI never shows "Saved" for an edit that has not been written yet.
   */
  unsaved: boolean;
  /** Object URLs for the current project's assets, keyed by asset id (original files). */
  urls: Record<string, string>;
  /**
   * The URLs small previews use: a reduced copy of each large image (lib/previews), else the
   * original. Exports and the main preview use `urls`.
   */
  previewUrls: Record<string, string>;
  /** Object URLs of the reduced copies only, to revoke them. */
  smallUrls: Record<string, string>;
  selectedShotId: string | null;
  activeFormat: FormatId;
  showSafeZones: boolean;
  /** Canvas shows the same content in every style side by side. */
  compareStyles: boolean;
  /** Carousel page shown on the canvas (index into the carousel pages), or null for the project itself. */
  carouselPage: number | null;

  open(project: Project, urls: Record<string, string>): void;
  close(): void;
  update(mutate: (draft: Project) => void, coalesceKey?: string): void;
  undo(): void;
  redo(): void;
  markSaved(saved: Project): void;
  addUrl(assetId: string, url: string): void;
  addPreview(assetId: string, url: string): void;
  selectShot(id: string | null): void;
  setActiveFormat(id: FormatId): void;
  toggleSafeZones(): void;
  toggleCompareStyles(): void;
  setCarouselPage(index: number | null): void;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
  unsaved: false,
  urls: {},
  previewUrls: {},
  smallUrls: {},
  selectedShotId: null,
  activeFormat: 'linkedin',
  showSafeZones: false,
  compareStyles: false,
  carouselPage: null,

  open(project, urls) {
    revokeAll(get().urls);
    revokeAll(get().smallUrls);
    set({
      project,
      unsaved: false,
      urls,
      previewUrls: { ...urls },
      smallUrls: {},
      past: [],
      future: [],
      lastKey: null,
      selectedShotId: project.screenshots[0]?.id ?? null,
      carouselPage: null,
      activeFormat: project.exportPresets[0] ?? 'linkedin',
    });
  },

  close() {
    revokeAll(get().urls);
    revokeAll(get().smallUrls);
    set({ project: null, urls: {}, previewUrls: {}, smallUrls: {}, past: [], future: [], selectedShotId: null });
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
      unsaved: true,
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
    set({ project: prev, unsaved: true, past: past.slice(0, -1), future: [project, ...future], lastKey: null });
  },

  redo() {
    const { project, past, future } = get();
    if (!project || !future.length) return;
    const [next, ...rest] = future;
    set({ project: next, unsaved: true, past: [...past, project], future: rest, lastKey: null });
  },

  markSaved(saved) {
    // Only clear the flag if nothing changed since `saved` was written.
    if (get().project === saved) set({ unsaved: false });
  },
  addUrl(assetId, url) {
    const { urls, previewUrls, smallUrls } = get();
    set({ urls: { ...urls, [assetId]: url }, previewUrls: { ...previewUrls, [assetId]: smallUrls[assetId] ?? url } });
  },
  addPreview(assetId, url) {
    const { previewUrls, smallUrls, urls } = get();
    // A preview made for an asset of a project that is no longer open is dropped.
    if (!urls[assetId]) return URL.revokeObjectURL(url);
    if (smallUrls[assetId]) URL.revokeObjectURL(smallUrls[assetId]);
    set({ previewUrls: { ...previewUrls, [assetId]: url }, smallUrls: { ...smallUrls, [assetId]: url } });
  },
  selectShot(id) {
    set({ selectedShotId: id });
  },
  setActiveFormat(id) {
    set({ activeFormat: id });
  },
  setCarouselPage(index) {
    set({ carouselPage: index });
  },
  toggleSafeZones() {
    set({ showSafeZones: !get().showSafeZones });
  },
  toggleCompareStyles() {
    set({ compareStyles: !get().compareStyles });
  },
}));

function revokeAll(urls: Record<string, string>) {
  Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
}
