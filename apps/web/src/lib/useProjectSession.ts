/**
 * Owns the lifecycle of an open project: load, autosave, conflict handling between
 * tabs, lock for safe garbage collection, and flush on exit.
 *
 * Rules
 * - Writes are guarded by `revision` (see db.saveProjectGuarded). A stale tab never overwrites.
 * - A tab with no unsaved change silently reloads when another tab saves the same project.
 * - A tab with unsaved changes gets a conflict and must choose: load latest or keep mine.
 * - Nothing is written on exit unless something changed.
 * - Unused image blobs are deleted only when no editor holds the project lock.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { notify } from '../store/toasts';
import { collectGarbage, describeStorageError, getBlob, getProject, holdProjectLock, putThumbnail, saveProjectGuarded } from './db';
import { renderThumbnail } from './exporter';

const SAVE_DELAY = 400;
const THUMB_DELAY = 2500;
const CHANNEL = 'svs-projects';

export type SaveState = 'saved' | 'saving' | 'error' | 'conflict';

type Message = { type: 'saved'; id: string; revision: number; tab: string } | { type: 'deleted'; id: string };

const TAB_ID = Math.random().toString(36).slice(2);

export function useProjectSession(projectId: string) {
  const project = useEditor((s) => s.project);
  const unsaved = useEditor((s) => s.unsaved);
  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [generation, setGeneration] = useState(0);

  const base = useRef(0); // revision this tab's state is based on
  const loaded = useRef<Project | null>(null); // object identity right after load/save
  const dirty = useRef(false);
  const conflict = useRef(false);
  const skipExitSave = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const setConflict = (v: boolean) => {
    conflict.current = v;
    setSaveState(v ? 'conflict' : dirty.current ? 'saving' : 'saved');
  };

  /** Write the current project. Returns true when stored. */
  const persist = useCallback(async (force = false): Promise<boolean> => {
    const p = useEditor.getState().project;
    if (!p || p.id !== projectId) return false;
    if (conflict.current && !force) return false;
    try {
      const res = await saveProjectGuarded(p, base.current, force);
      if (!res.ok) {
        if (res.reason === 'missing') {
          setSaveState('error');
          notify('This project was deleted in another tab. Your changes cannot be saved.', 'error');
        } else {
          setConflict(true);
        }
        return false;
      }
      base.current = res.revision;
      conflict.current = false;
      // Only clean if nothing changed while we were writing.
      if (useEditor.getState().project === p) {
        dirty.current = false;
        loaded.current = p;
        setSaveState('saved');
        useEditor.getState().markSaved(p);
      }
      channel.current?.postMessage({ type: 'saved', id: p.id, revision: res.revision, tab: TAB_ID } satisfies Message);
      return true;
    } catch (e) {
      setSaveState('error');
      notify(describeStorageError(e), 'error');
      return false;
    }
  }, [projectId]);

  // ---- Load, lock, exit ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const release = holdProjectLock(projectId);
    skipExitSave.current = false;
    (async () => {
      const p = await getProject(projectId);
      if (!p) return !cancelled && setStatus('missing');
      const urls: Record<string, string> = {};
      for (const a of p.assets) {
        const b = await getBlob(p.id, a.id);
        if (b) urls[a.id] = URL.createObjectURL(b);
      }
      if (cancelled) return Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
      base.current = p.revision;
      loaded.current = p;
      dirty.current = false;
      conflict.current = false;
      useEditor.getState().open(p, urls);
      setSaveState('saved');
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
      const p = useEditor.getState().project;
      const mustSave = !skipExitSave.current && p?.id === projectId && dirty.current && !conflict.current;
      const finish = async () => {
        if (mustSave) await persist();
        release();
        await collectGarbage(projectId).catch(() => {});
      };
      // Persist before close() revokes URLs; the write does not need them.
      void finish();
      useEditor.getState().close();
    };
  }, [projectId, generation, persist]);

  // ---- Cross-tab notifications ----------------------------------------------------
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<Message>) => {
      const m = e.data;
      if (m?.id !== projectId) return;
      if (m.type === 'saved' && m.tab !== TAB_ID && m.revision !== base.current) {
        if (dirty.current) setConflict(true);
        else reload(); // nothing to lose: follow the other tab
      }
    };
    return () => {
      ch.close();
      channel.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ---- Autosave + thumbnail --------------------------------------------------------
  useEffect(() => {
    if (!project || status !== 'ready' || project.id !== projectId) return;
    const changed = project !== loaded.current;
    if (changed) {
      dirty.current = true;
      if (!conflict.current) setSaveState('saving');
    }
    const t1 = changed && !conflict.current ? setTimeout(() => void persist(), SAVE_DELAY) : undefined;
    const t2 = setTimeout(async () => {
      try {
        await putThumbnail(project.id, await renderThumbnail(project, useEditor.getState().urls));
      } catch {
        /* thumbnails are best effort */
      }
    }, THUMB_DELAY);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [project, status, projectId, persist]);

  // ---- Leaving the page --------------------------------------------------------------
  useEffect(() => {
    const onHide = () => {
      if (dirty.current && !conflict.current) void persist();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current && conflict.current) e.preventDefault();
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [persist]);

  /** Discard local state and load the stored version. */
  function reload() {
    skipExitSave.current = true;
    dirty.current = false;
    setStatus('loading');
    setGeneration((g) => g + 1);
  }

  // Errors and conflicts win; otherwise any change not yet written reads as "Saving…"
  // from the very first render after the edit (no stale "Saved").
  const effectiveState: SaveState = saveState === 'error' || saveState === 'conflict' ? saveState : unsaved ? 'saving' : 'saved';

  return {
    status,
    saveState: effectiveState,
    /** Save immediately (Ctrl/Cmd+S). */
    saveNow: () => persist(),
    /** Conflict resolution: overwrite the other tab's version with ours. */
    keepMine: async () => {
      if (await persist(true)) notify('Your version was saved.');
    },
    /** Conflict resolution: drop our changes and load the latest stored version. */
    loadLatest: reload,
    /** True when leaving now would lose changes. */
    hasUnsavedConflict: () => dirty.current && conflict.current,
  };
}
