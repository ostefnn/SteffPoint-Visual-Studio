import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCarouselSlides,
  carouselFormat as carouselFormatOf,
  FORMAT_GROUPS,
  FORMAT_ORDER,
  IOS_CANVAS_PIXELS,
  isScaleReasonable,
  placeholderFields,
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

import { t } from '../i18n';

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
  // Example texts still drawn in the images or on carousel pages. Shown, never blocking.
  const examples = useMemo(() => placeholderFields(project), [project]);
  const slideExamples = useMemo(
    () => slides.map((s, i) => ({ page: i + 1, fields: placeholderFields(s.project) })).filter((x) => x.fields.length),
    [slides],
  );
  const fieldList = (fields: string[]) => fields.map((f) => t(f)).join(', ');
  const editText = () => {
    const first = examples[0] ?? slideExamples[0]?.fields[0];
    onClose();
    // After the dialog closes, take the user to the first field to fix when the Content panel shows it.
    requestAnimationFrame(() => {
      const el = first ? document.querySelector<HTMLElement>(`[data-example-field="${first}"]`) : null;
      el?.scrollIntoView({ block: 'center' });
      el?.focus();
    });
  };
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
      className="m-auto w-[min(560px,calc(100vw-32px))] overscroll-contain rounded-2xl bg-surface p-0 shadow-2xl backdrop:bg-[rgb(0_0_0/0.45)]"
      aria-labelledby="export-title"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="export-title" className="font-semibold">
          {t('Export Pack')}
        </h2>
        <Button variant="ghost" onClick={onClose} disabled={busy} aria-label={t('Close')}>
          <Icon name="x" />
        </Button>
      </div>
      <div className="space-y-5 px-5 py-4">
        {examples.length > 0 && (
          <div role="status" className="flex items-center gap-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-ink ring-1 ring-warn-line">
            <p className="min-w-0 flex-1">{t('Example text is still in: {fields}. Replace it before publishing, or export anyway.', { fields: fieldList(examples) })}</p>
            <Button size="sm" className="flex-none" onClick={editText} disabled={busy}>
              {t('Edit Text')}
            </Button>
          </div>
        )}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">{t('Formats')}</legend>
          <div className="space-y-3">
            {FORMAT_GROUPS.map((g) => (
              <div key={g.label} role="group" aria-label={t(g.label)}>
                <p className="mb-1.5 text-xs font-medium text-muted">{t(g.label)}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {g.formats.map((id) => {
                    const f = resolveFormat(id, project.customFormat);
                    const on = formats.includes(id);
                    return (
                      <label key={id} className={cx('flex cursor-pointer items-start gap-2 rounded-lg p-2 ring-1', on ? 'bg-accent-soft ring-accent-line' : 'ring-line')}>
                        <input type="checkbox" className="mt-0.5" checked={on} onChange={() => toggle(id)} />
                        <span>
                          <span className="block text-sm font-medium">{t(f.label)}</span>
                          <span className="text-xs tabular-nums text-muted">
                            {f.width}×{f.height}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted">{t('File type')}</p>
            <Segmented
              label={t('File type')}
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
            <p className="mb-1 text-xs font-medium text-muted">{t('Resolution')}</p>
            <Segmented
              label={t('Resolution')}
              value={String(scale) as '1' | '2' | '3'}
              options={[
                { value: '1', label: '1×' },
                { value: '2', label: '2×' },
                { value: '3', label: '3×' },
              ]}
              onChange={(v) => setScale(Number(v))}
            />
            {blocked ? (
              <p className="mt-1 text-xs text-danger">{t('Too large for this device (iPhone/iPad limit). Choose a lower resolution.')}</p>
            ) : (
              tooBig(scale) && <p className="mt-1 text-xs text-warn">{t('Very large output: export may be slow or fail on some devices.')}</p>
            )}
          </div>
        </div>
        {type !== 'png' && (
          <Slider label={t('Quality')} min={0.5} max={1} step={0.01} value={quality} format={(v) => `${Math.round(v * 100)}%`} onChange={setQuality} />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeProject} onChange={(e) => setIncludeProject(e.target.checked)} />
          {t('Include')}{' '}<code className="rounded bg-subtle px-1 text-xs">project.json</code>{' '}{t('(re-importable, images embedded)')}
        </label>
        <section aria-labelledby="carousel-title" className="rounded-xl bg-panel p-3 ring-1 ring-line">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="carousel-title" className="text-sm font-semibold text-ink">
              {t('LinkedIn Carousel (PDF)')}
            </h3>
            <span className="text-xs tabular-nums text-muted">
              {t(slides.length === 1 ? '1 page of {w} × {h}' : '{n} pages of {w} × {h}', { n: slides.length, w: carouselFormat.width, h: carouselFormat.height })}
            </span>
          </div>
          <ol className="flex gap-2 overflow-x-auto pb-1" aria-label={t('Carousel slides')}>
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
              ? t('Automatic pages: cover, one page per screenshot (titled with its caption), then your features.')
              : t('Your custom pages.')}{' '}
            {t('Choose templates, text and order in the Carousel tab. Post the PDF on LinkedIn as a document.')}
          </p>
          {slideExamples.length > 0 && (
            <p role="status" className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-ink ring-1 ring-warn-line">
              {t('Pages with example text: {pages}.', {
                pages: slideExamples.map((x) => `${x.page} (${fieldList(x.fields)})`).join(', '),
              })}
            </p>
          )}
          <Button className="mt-3" onClick={runCarousel} disabled={busy || carouselBlocked}>
            <Icon name="download" /> {slides.length === 1 ? t('Export Carousel PDF (1 Page)') : t('Export Carousel PDF ({n} Pages)', { n: slides.length })}
          </Button>
        </section>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <p className="text-xs text-muted">{t('Rendered in your browser. Nothing is uploaded.')}</p>
        <Button variant="primary" onClick={run} disabled={busy || formats.length === 0 || blocked}>
          <Icon name="download" />
          {busy
            ? t('Rendering {done}/{total}…', { done: progress.done, total: progress.total })
            : formats.length === 1 && !includeProject
              ? t('Export Image')
              : t('Export ZIP ({n})', { n: formats.length })}
        </Button>
      </div>
    </dialog>
  );
}
