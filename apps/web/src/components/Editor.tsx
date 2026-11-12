import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCarouselSlides, CAROUSEL_FORMAT, resolveFormat, STYLE_IDS, STYLES, withStyle, type FormatPreset, type Project } from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { notify, useToasts } from '../store/toasts';
import { useProjectSession, type SaveState } from '../lib/useProjectSession';
import { applyStyle, duplicateScreenshot, imageFilesFrom, importImages, removeScreenshot } from '../lib/actions';
import { Button, cx, Icon, inputCls, useElementSize } from './ui';
import { Stage } from './Stage';
import { PrivacyBadge } from './PrivacyBadge';
import { LeftPanel } from './LeftPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { FormatStrip } from './FormatStrip';
import { ExportDialog } from './ExportDialog';

function isTextField(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function Editor({ projectId, onExit }: { projectId: string; onExit: () => void }) {
  const project = useEditor((s) => s.project);
  const session = useProjectSession(projectId);
  const { status, saveState } = session;
  const [exportOpen, setExportOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const exit = () => {
    if (session.hasUnsavedConflict() && !confirm('Your changes conflict with another tab and are not saved. Leave anyway?')) return;
    onExit();
  };

  // ---- Keyboard shortcuts and paste ------------------------------------------
  const saveRef = useRef(session.saveNow);
  saveRef.current = session.saveNow;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const ed = useEditor.getState();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        ed.redo();
      } else if (mod && key === 's') {
        e.preventDefault();
        saveRef.current().then((ok) => ok && notify('Project saved locally.'));
      } else if (mod && key === 'd' && !isTextField(e.target)) {
        e.preventDefault();
        if (ed.selectedShotId) duplicateScreenshot(ed.selectedShotId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isTextField(e.target) && ed.selectedShotId) {
        e.preventDefault();
        removeScreenshot(ed.selectedShotId);
      } else if (e.key === 'Escape') {
        if (isTextField(e.target)) (e.target as HTMLElement).blur();
        else ed.selectShot(null);
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const files = imageFilesFrom(e.clipboardData?.files);
      if (!files.length) return;
      e.preventDefault();
      importImages(files, 'screenshot');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  if (status === 'missing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="font-medium">This project does not exist on this device.</p>
        <Button onClick={onExit}>Back to Projects</Button>
      </div>
    );
  }
  if (!project) return <div className="flex h-full items-center justify-center text-sm text-muted">Loading project…</div>;

  return (
    <div
      className="flex min-h-full flex-col lg:h-full"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        importImages(imageFilesFrom(e.dataTransfer.files), 'screenshot');
      }}
    >
      <TopBar saveState={saveState} onExit={exit} onExport={() => setExportOpen(true)} />
      {saveState === 'conflict' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-warn-line bg-warn-soft px-4 py-2 text-sm text-warn-ink">
          <span className="mr-auto">
            This project was changed in another tab. Your latest edits are <strong>not saved</strong>.
          </span>
          <Button size="sm" onClick={session.loadLatest}>
            Load Latest Version
          </Button>
          <Button size="sm" variant="primary" onClick={session.keepMine}>
            Keep My Version
          </Button>
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[288px_minmax(0,1fr)_320px]">
        <LeftPanel className="order-2 border-line bg-panel lg:order-1 lg:overflow-y-auto lg:border-r" />
        <main className="order-1 flex min-h-0 flex-col lg:order-2">
          <Canvas />
          <FormatStrip />
        </main>
        <PropertiesPanel className="order-3 border-line bg-panel lg:overflow-y-auto lg:border-l" />
      </div>
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-accent/10 ring-4 ring-inset ring-accent">
          <p className="rounded-xl bg-surface px-5 py-3 text-sm font-medium shadow-lg">Drop images to add screenshots</p>
        </div>
      )}
      <Toasts />
    </div>
  );
}

const SAVE_LABEL: Record<SaveState, { text: string; cls: string }> = {
  saved: { text: 'Saved', cls: 'text-muted' },
  saving: { text: 'Saving…', cls: 'text-muted' },
  error: { text: 'Not saved', cls: 'font-medium text-danger' },
  conflict: { text: 'Not saved (conflict)', cls: 'font-medium text-warn' },
};

function TopBar({ saveState, onExit, onExport }: { saveState: SaveState; onExit: () => void; onExport: () => void }) {
  const name = useEditor((s) => s.project?.name ?? '');
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { update, undo, redo } = useEditor.getState();
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
      <h1 className="sr-only">Editing: {name || 'Untitled project'}</h1>
      <Button variant="ghost" onClick={onExit} aria-label="Back to Projects">
        <Icon name="back" /> <span className="hidden sm:inline">Projects</span>
      </Button>
      <input
        aria-label="Project name"
        value={name}
        maxLength={80}
        onChange={(e) => update((d) => void (d.name = e.target.value), 'name')}
        className={cx(inputCls, 'w-48 font-medium sm:w-64')}
      />
      <div className="flex">
        <Button variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)">
          <Icon name="undo" />
        </Button>
        <Button variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)">
          <Icon name="redo" />
        </Button>
      </div>
      <span className={cx('text-xs', SAVE_LABEL[saveState].cls)} aria-live="polite" data-testid="save-state">
        {SAVE_LABEL[saveState].text}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden md:inline">
          <PrivacyBadge />
        </span>
        <Button variant="primary" onClick={onExport}>
          <Icon name="download" /> Export
        </Button>
      </div>
    </header>
  );
}

function Canvas() {
  const project = useEditor((s) => s.project)!;
  const urls = useEditor((s) => s.urls);
  const active = useEditor((s) => s.activeFormat);
  const showSafe = useEditor((s) => s.showSafeZones);
  const carouselPage = useEditor((s) => s.carouselPage);
  const compare = useEditor((s) => s.compareStyles);
  const [ref, size] = useElementSize<HTMLDivElement>();
  const { update, toggleSafeZones, toggleCompareStyles, setCarouselPage } = useEditor.getState();
  // While a carousel page is selected, the canvas shows that page at the carousel size.
  const slides = useMemo(() => (carouselPage === null ? [] : buildCarouselSlides(project)), [project, carouselPage]);
  const slide = carouselPage === null ? undefined : slides[carouselPage];
  const format = slide ? resolveFormat(CAROUSEL_FORMAT) : resolveFormat(active, project.customFormat);
  const shown = slide ? slide.project : project;
  const pad = 32;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2 text-sm">
        {slide ? (
          <span className="font-medium">
            Carousel page {carouselPage! + 1} of {slides.length}
          </span>
        ) : (
          <span className="font-medium">{format.label}</span>
        )}
        <span className="tabular-nums text-muted">
          {format.width} × {format.height}
        </span>
        {slide && (
          <Button size="sm" variant="ghost" onClick={() => setCarouselPage(null)}>
            Show Project
          </Button>
        )}
        {!slide && active === 'custom' && (
          <span className="flex items-center gap-1">
            {(['width', 'height'] as const).map((k) => (
              <input
                key={k}
                type="number"
                inputMode="numeric"
                min={64}
                max={4096}
                aria-label={`Custom ${k}`}
                value={project.customFormat[k]}
                onChange={(e) => update((d) => void (d.customFormat[k] = Number(e.target.value) || 64), `custom-${k}`)}
                className={cx(inputCls, 'w-20 py-1')}
              />
            ))}
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <Button
            size="sm"
            variant={compare ? 'primary' : 'ghost'}
            aria-pressed={compare}
            onClick={toggleCompareStyles}
            title="Show the same content in every style side by side"
          >
            <Icon name="grid" /> Compare Styles
          </Button>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showSafe} onChange={toggleSafeZones} /> Safe zones
          </label>
        </span>
      </div>
      <div ref={ref} className="checker relative flex h-[56vh] max-h-[640px] flex-none items-center justify-center overflow-hidden lg:h-auto lg:max-h-none lg:min-h-0 lg:flex-1" data-testid="canvas">
        {size.width > 0 && compare && <StyleMatrix project={shown} format={format} urls={urls} width={size.width} height={size.height} showSafeZones={showSafe} />}
        {size.width > 0 && !compare && (
          <Stage
            project={shown}
            format={format}
            urls={urls}
            maxWidth={size.width - pad * 2}
            maxHeight={size.height - pad * 2}
            showSafeZones={showSafe}
            label={slide ? `Preview: carousel page ${carouselPage! + 1} of ${slides.length}` : `Preview: ${format.label}, ${format.width} × ${format.height}`}
            className="shadow-xl ring-1 ring-ink/5"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Style matrix: the same content rendered in all four styles at once, in a 2 × 2 grid
 * sized to the canvas. Picking a cell applies that style (undoable) and keeps the grid open.
 */
function StyleMatrix({
  project,
  format,
  urls,
  width,
  height,
  showSafeZones,
}: {
  project: Project;
  format: Pick<FormatPreset, 'width' | 'height' | 'safe'>;
  urls: Record<string, string>;
  width: number;
  height: number;
  showSafeZones: boolean;
}) {
  const pad = 16;
  const gap = 12;
  const label = 22;
  const cellW = (width - pad * 2 - gap) / 2;
  const cellH = (height - pad * 2 - gap) / 2 - label;
  return (
    <div role="radiogroup" aria-label="Compare styles" data-testid="style-matrix" className="grid grid-cols-2 place-items-center" style={{ gap, padding: pad }}>
      {STYLE_IDS.map((id) => {
        const on = project.brand.style === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => applyStyle(id)}
            title={STYLES[id].description}
            className="group flex flex-col items-center gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <Stage
              project={withStyle(project, id)}
              format={format}
              urls={urls}
              maxWidth={cellW}
              maxHeight={cellH}
              showSafeZones={showSafeZones}
              className={cx('shadow-lg ring-1 transition', on ? 'ring-2 ring-accent' : 'ring-ink/5 group-hover:ring-field')}
            />
            <span className={cx('text-xs', on ? 'font-semibold text-ink' : 'text-muted')} style={{ height: label - 4 }}>
              {STYLES[id].name}
              {on && ' · current'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cx(
            'flex items-center gap-3 rounded-lg px-4 py-2 text-sm shadow-lg',
            t.tone === 'error' ? 'bg-danger text-on-accent' : 'bg-ink text-on-accent',
          )}
        >
          {t.message}
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <Icon name="x" className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
