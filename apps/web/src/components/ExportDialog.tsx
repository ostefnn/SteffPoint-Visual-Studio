import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCarouselSlides,
  carouselFormat as carouselFormatOf,
  FORMAT_ORDER,
  IOS_CANVAS_PIXELS,
  isScaleReasonable,
  resolveFormat,
  type FormatId,
} from '@svs/visual-core';

/** iPhone, iPad (iPadOS reports itself as a Mac with touch). */
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
import { useEditor } from '../store/editor';
import { exportPack, type ImageType } from '../lib/exporter';
import { downloadBlob } from '../lib/download';
import { exportCarouselPdf } from '../lib/carouselPdf';
import { Stage } from './Stage';
import { Button, cx, Icon, Segmented, Slider } from './ui';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project)!;
  const urls = useEditor((s) => s.urls);
  const [formats, setFormats] = useState<FormatId[]>(project.exportPresets.length ? project.exportPresets : ['linkedin']);
  const [type, setType] = useState<ImageType>('png');
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(0.92);
  const [includeProject, setIncludeProject] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const tooBig = (s: number, limit?: number) =>
    formats.some((id) => {
      const f = resolveFormat(id, project.customFormat);
      return !isScaleReasonable(f.width, f.height, s, limit);
    });
  // Hard limit on iOS: canvases above ~16.7 MP fail to render.
  const blocked = IS_IOS && tooBig(scale, IOS_CANVAS_PIXELS);

  const toggle = (id: FormatId) =>
    setFormats((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : FORMAT_ORDER.filter((x) => x === id || cur.includes(x))));

  const run = async () => {
    setError(null);
    setProgress({ done: 0, total: formats.length });
    try {
      // Remember the chosen formats on the project.
      useEditor.getState().update((d) => void (d.exportPresets = formats));
      const { blob, filename } = await exportPack(project, urls, formats, { scale, type, quality, includeProject }, (done, total) =>
        setProgress({ done, total }),
      );
      downloadBlob(blob, filename);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;

  // LinkedIn carousel: slides derived from the project (cover, one per screenshot, features).
  const slides = useMemo(() => buildCarouselSlides(project), [project]);
  const carouselFormat = resolveFormat(carouselFormatOf(project));
  const carouselBlocked = IS_IOS && !isScaleReasonable(carouselFormat.width, carouselFormat.height, scale, IOS_CANVAS_PIXELS);
  const runCarousel = async () => {
    setError(null);
    setProgress({ done: 0, total: slides.length + 1 });
    try {
      const { blob, filename } = await exportCarouselPdf(project, urls, { scale, quality: type === 'png' ? 0.9 : quality }, (done, total) =>
        setProgress({ done, total }),
      );
      downloadBlob(blob, filename);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[min(560px,calc(100vw-32px))] overscroll-contain rounded-2xl bg-surface p-0 shadow-2xl backdrop:bg-ink/40"
      aria-labelledby="export-title"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="export-title" className="font-semibold">
          Export Pack
        </h2>
        <Button variant="ghost" onClick={onClose} disabled={busy} aria-label="Close">
          <Icon name="x" />
        </Button>
      </div>
      <div className="space-y-5 px-5 py-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Formats</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FORMAT_ORDER.map((id) => {
              const f = resolveFormat(id, project.customFormat);
              const on = formats.includes(id);
              return (
                <label key={id} className={cx('flex cursor-pointer items-start gap-2 rounded-lg p-2 ring-1', on ? 'bg-accent-soft ring-accent-line' : 'ring-line')}>
                  <input type="checkbox" className="mt-0.5" checked={on} onChange={() => toggle(id)} />
                  <span>
                    <span className="block text-sm font-medium">{f.label}</span>
                    <span className="text-xs tabular-nums text-muted">
                      {f.width}×{f.height}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted">File type</p>
            <Segmented
              label="File type"
              value={type}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpeg', label: 'JPEG' },
                { value: 'webp', label: 'WebP' },
              ]}
              onChange={setType}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted">Resolution</p>
            <Segmented
              label="Resolution"
              value={String(scale) as '1' | '2' | '3'}
              options={[
                { value: '1', label: '1×' },
                { value: '2', label: '2×' },
                { value: '3', label: '3×' },
              ]}
              onChange={(v) => setScale(Number(v))}
            />
            {blocked ? (
              <p className="mt-1 text-xs text-danger">Too large for this device (iPhone/iPad limit). Choose a lower resolution.</p>
            ) : (
              tooBig(scale) && <p className="mt-1 text-xs text-warn">Very large output: export may be slow or fail on some devices.</p>
            )}
          </div>
        </div>
        {type !== 'png' && (
          <Slider label="Quality" min={0.5} max={1} step={0.01} value={quality} format={(v) => `${Math.round(v * 100)}%`} onChange={setQuality} />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeProject} onChange={(e) => setIncludeProject(e.target.checked)} />
          Include <code className="rounded bg-subtle px-1 text-xs">project.json</code> (re-importable, images embedded)
        </label>
        <section aria-labelledby="carousel-title" className="rounded-xl bg-panel p-3 ring-1 ring-line">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="carousel-title" className="text-sm font-semibold text-ink">
              LinkedIn Carousel (PDF)
            </h3>
            <span className="text-xs tabular-nums text-muted">
              {slides.length} {slides.length === 1 ? 'page' : 'pages'} of {carouselFormat.width} × {carouselFormat.height}
            </span>
          </div>
          <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Carousel slides">
            {slides.map((s, i) => (
              <li key={i} className="flex-none">
                <Stage project={s.project} format={carouselFormat} urls={urls} maxWidth={72} maxHeight={90} className="rounded shadow-sm ring-1 ring-ink/5" />
                <span className="mt-1 block w-[72px] truncate text-[11px] text-muted" title={s.label}>
                  {i + 1}. {s.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">
            {slides[0]?.auto
              ? 'Automatic pages: cover, one page per screenshot (titled with its caption), then your features.'
              : 'Your custom pages.'}{' '}
            Choose templates, text and order in the <strong>Carousel</strong> tab. Post the PDF on LinkedIn as a document.
          </p>
          <Button className="mt-3" onClick={runCarousel} disabled={busy || carouselBlocked}>
            <Icon name="download" /> Export Carousel PDF ({slides.length} {slides.length === 1 ? 'Page' : 'Pages'})
          </Button>
        </section>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <p className="text-xs text-muted">Rendered in your browser. Nothing is uploaded.</p>
        <Button variant="primary" onClick={run} disabled={busy || formats.length === 0 || blocked}>
          <Icon name="download" />
          {busy
            ? `Rendering ${progress.done}/${progress.total}…`
            : formats.length === 1 && !includeProject
              ? 'Export Image'
              : `Export ZIP (${formats.length})`}
        </Button>
      </div>
    </dialog>
  );
}
