import { useEffect, useRef, useState } from 'react';
import { FORMAT_ORDER, IOS_CANVAS_PIXELS, isScaleReasonable, resolveFormat, type FormatId } from '@svs/visual-core';

/** iPhone, iPad (iPadOS reports itself as a Mac with touch). */
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
import { useEditor } from '../store/editor';
import { exportPack, type ImageType } from '../lib/exporter';
import { downloadBlob } from '../lib/download';
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

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[min(560px,calc(100vw-32px))] overscroll-contain rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-zinc-900/40"
      aria-labelledby="export-title"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <h2 id="export-title" className="font-semibold">
          Export Pack
        </h2>
        <Button variant="ghost" onClick={onClose} disabled={busy} aria-label="Close">
          <Icon name="x" />
        </Button>
      </div>
      <div className="space-y-5 px-5 py-4">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Formats</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FORMAT_ORDER.map((id) => {
              const f = resolveFormat(id, project.customFormat);
              const on = formats.includes(id);
              return (
                <label key={id} className={cx('flex cursor-pointer items-start gap-2 rounded-lg p-2 ring-1', on ? 'bg-blue-50 ring-blue-300' : 'ring-zinc-200')}>
                  <input type="checkbox" className="mt-0.5" checked={on} onChange={() => toggle(id)} />
                  <span>
                    <span className="block text-sm font-medium">{f.label}</span>
                    <span className="text-xs tabular-nums text-zinc-500">
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
            <p className="mb-1 text-xs font-medium text-zinc-600">File type</p>
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
            <p className="mb-1 text-xs font-medium text-zinc-600">Resolution</p>
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
              <p className="mt-1 text-xs text-red-600">Too large for this device (iPhone/iPad limit). Choose a lower resolution.</p>
            ) : (
              tooBig(scale) && <p className="mt-1 text-xs text-amber-700">Very large output: export may be slow or fail on some devices.</p>
            )}
          </div>
        </div>
        {type !== 'png' && (
          <Slider label="Quality" min={0.5} max={1} step={0.01} value={quality} format={(v) => `${Math.round(v * 100)}%`} onChange={setQuality} />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeProject} onChange={(e) => setIncludeProject(e.target.checked)} />
          Include <code className="rounded bg-zinc-100 px-1 text-xs">project.json</code> (re-importable, images embedded)
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
        <p className="text-xs text-zinc-500">Rendered in your browser. Nothing is uploaded.</p>
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
