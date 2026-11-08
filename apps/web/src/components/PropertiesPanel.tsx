import { useMemo, useRef } from 'react';
import { analyzeProject, clampCode, getTemplate, LIMITS, resolveFormat, type ScreenshotSlot } from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { duplicateScreenshot, removeScreenshot } from '../lib/actions';
import { Button, cx, Field, Icon, inputCls, Section, Segmented, Slider } from './ui';

export function PropertiesPanel({ className }: { className?: string }) {
  return (
    <aside className={className}>
      <ContentSection />
      <ImageSection />
      <Suggestions />
    </aside>
  );
}

function ContentSection() {
  const content = useEditor((s) => s.project?.content);
  const template = useEditor((s) => s.project?.template);
  const { update } = useEditor.getState();
  if (!content || !template) return null;

  type TextKey = 'kicker' | 'title' | 'subtitle' | 'beforeLabel' | 'afterLabel' | 'codeFile';
  const maxLen: Record<TextKey, number> = {
    kicker: LIMITS.kicker,
    title: LIMITS.title,
    subtitle: LIMITS.subtitle,
    beforeLabel: LIMITS.label,
    afterLabel: LIMITS.label,
    codeFile: LIMITS.codeFile,
  };
  const set = (key: TextKey) => (e: { target: { value: string } }) =>
    update((d) => void (d.content[key] = e.target.value.slice(0, maxLen[key])), `content-${key}`);
  const setFeature = (i: number, value: string) =>
    update((d) => {
      const list = [...d.content.features];
      while (list.length <= i) list.push('');
      list[i] = value.replace(/\n/g, ' ').slice(0, LIMITS.feature);
      d.content.features = list.slice(0, LIMITS.featureItems);
    }, `feature-${i}`);
  const features = Array.from({ length: LIMITS.featureItems }, (_, i) => content.features[i] ?? '');
  const codeLines = content.code.split('\n').length;
  const count = (v: string, max: number) => (
    <span className={cx(v.length > max * 0.8 && 'text-amber-600')}>
      {v.length}/{max}
    </span>
  );

  return (
    <Section title="Content">
      <Field label="Kicker" hint={count(content.kicker, LIMITS.kicker)}>
        <input value={content.kicker} onChange={set('kicker')} className={inputCls} placeholder="e.g. New release…" />
      </Field>
      <Field label="Title" hint={count(content.title, LIMITS.title)}>
        <textarea value={content.title} onChange={set('title')} rows={2} className={cx(inputCls, 'resize-y')} />
      </Field>
      <Field label="Subtitle" hint={count(content.subtitle, LIMITS.subtitle)}>
        <textarea value={content.subtitle} onChange={set('subtitle')} rows={3} className={cx(inputCls, 'resize-y')} />
      </Field>
      {template === 'before-after' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Before label">
            <input value={content.beforeLabel} onChange={set('beforeLabel')} className={inputCls} />
          </Field>
          <Field label="After label">
            <input value={content.afterLabel} onChange={set('afterLabel')} className={inputCls} />
          </Field>
        </div>
      )}
      {template === 'features' && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-medium text-zinc-600">Features (up to {LIMITS.featureItems})</legend>
          {features.map((f, i) => (
            <input
              key={i}
              value={f}
              aria-label={`Feature ${i + 1}`}
              placeholder={i === 0 ? 'e.g. Works offline…' : 'Optional…'}
              onChange={(e) => setFeature(i, e.target.value)}
              className={inputCls}
            />
          ))}
        </fieldset>
      )}
      {template === 'code' && (
        <>
          <Field label="File name">
            <input value={content.codeFile} onChange={set('codeFile')} className={cx(inputCls, 'font-mono')} placeholder="e.g. index.ts" />
          </Field>
          <Field label="Code" hint={
              <span className={cx(codeLines >= LIMITS.codeLines && 'text-amber-600')}>
                {codeLines}/{LIMITS.codeLines} lines
              </span>
            }>
            <textarea
              value={content.code}
              spellCheck={false}
              rows={10}
              onChange={(e) => update((d) => void (d.content.code = clampCode(e.target.value)), 'content-code')}
              onKeyDown={(e) => {
                // Tab inserts two spaces instead of leaving the field.
                if (e.key !== 'Tab' || e.shiftKey) return;
                e.preventDefault();
                const el = e.currentTarget;
                const { selectionStart: a, selectionEnd: b, value } = el;
                update((d) => void (d.content.code = clampCode(value.slice(0, a) + '  ' + value.slice(b))), 'content-code');
                requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
              }}
              className={cx(inputCls, 'resize-y font-mono text-xs leading-relaxed')}
            />
          </Field>
        </>
      )}
    </Section>
  );
}

function ImageSection() {
  const shots = useEditor((s) => s.project?.screenshots);
  const selectedId = useEditor((s) => s.selectedShotId);
  const urls = useEditor((s) => s.urls);
  const assets = useEditor((s) => s.project?.assets);
  const template = useEditor((s) => s.project?.template);
  const { update } = useEditor.getState();
  const index = shots?.findIndex((s) => s.id === selectedId) ?? -1;
  const shot = index >= 0 ? shots![index] : undefined;

  if (!shot) {
    return (
      <Section title="Image">
        <p className="text-xs text-zinc-500">Select a screenshot in the Images tab to adjust its crop and focal point.</p>
      </Section>
    );
  }

  const max = getTemplate(template ?? '').slots.screenshots.max;
  const set = <K extends keyof ScreenshotSlot>(key: K, value: ScreenshotSlot[K], coalesce?: string) =>
    update((d) => {
      const s = d.screenshots.find((x) => x.id === shot.id);
      if (s) s[key] = value;
    }, coalesce);

  return (
    <Section
      title={`Image ${index + 1}`}
      action={
        <div className="flex">
          <Button size="sm" variant="ghost" className="px-1.5" onClick={() => duplicateScreenshot(shot.id)} aria-label="Duplicate screenshot" title="Duplicate (Ctrl/Cmd+D)">
            <Icon name="copy" className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="px-1.5 text-red-600" onClick={() => removeScreenshot(shot.id)} aria-label="Remove screenshot" title="Remove (Delete)">
            <Icon name="trash" className="size-3.5" />
          </Button>
        </div>
      }
    >
      {index >= max && <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">This template shows {max} screenshot(s); this one is hidden.</p>}
      <FocalPicker
        url={urls[shot.assetId]}
        asset={assets?.find((a) => a.id === shot.assetId)}
        x={shot.focalX}
        y={shot.focalY}
        onChange={(x, y) =>
          update((d) => {
            const s = d.screenshots.find((v) => v.id === shot.id);
            if (s) Object.assign(s, { focalX: x, focalY: y });
          }, `focal-${shot.id}`)
        }
      />
      <Segmented
        label="Fit"
        value={shot.fit}
        options={[
          { value: 'cover', label: 'Cover' },
          { value: 'contain', label: 'Contain' },
        ]}
        onChange={(v) => set('fit', v)}
      />
      <Slider label="Zoom" min={1} max={3} step={0.05} value={shot.zoom} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => set('zoom', v, `zoom-${shot.id}`)} />
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Focal X" min={0} max={1} step={0.01} value={shot.focalX} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('focalX', v, `focal-${shot.id}`)} />
        <Slider label="Focal Y" min={0} max={1} step={0.01} value={shot.focalY} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('focalY', v, `focal-${shot.id}`)} />
      </div>
    </Section>
  );
}

/** Click or drag on the image to set the point that must stay visible in every format. */
const FOCAL_MAX_HEIGHT = 192; // matches max-h-48

function FocalPicker({
  url,
  asset,
  x,
  y,
  onChange,
}: {
  url?: string;
  asset?: { width: number; height: number };
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
    onChange(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
  };
  const nudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    onChange(Math.min(1, Math.max(0, x + d[0])), Math.min(1, Math.max(0, y + d[1])));
  };
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-600">Focal point</p>
      <div className="checker flex justify-center rounded-lg p-1">
        <div
          ref={ref}
          role="slider"
          tabIndex={0}
          aria-label="Focal point"
          aria-valuetext={`${Math.round(x * 100)}% horizontal, ${Math.round(y * 100)}% vertical`}
          onKeyDown={nudge}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove={(e) => e.buttons === 1 && pick(e)}
          className="relative cursor-crosshair touch-none select-none focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          {url &&
            (asset && asset.width > 0 && asset.height > 0 ? (
              // Known dimensions reserve the box before decode (no layout shift); max-w-full + h-auto keep the ratio on narrow panels.
              <img
                src={url}
                alt=""
                draggable={false}
                width={asset.width}
                height={asset.height}
                style={{ width: Math.min(asset.width, (FOCAL_MAX_HEIGHT * asset.width) / asset.height) }}
                className="block h-auto max-w-full"
              />
            ) : (
              <img src={url} alt="" draggable={false} className="block max-h-48 max-w-full" />
            ))}
          <span
            className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600/60 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          />
        </div>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">This area stays visible when the layout changes between formats.</p>
    </div>
  );
}

function Suggestions() {
  const project = useEditor((s) => s.project);
  const active = useEditor((s) => s.activeFormat);
  const { update } = useEditor.getState();
  const list = useMemo(() => (project ? analyzeProject(project, resolveFormat(active, project.customFormat)) : []), [project, active]);
  return (
    <Section title={`Suggestions (${list.length})`}>
      {list.length === 0 ? (
        <p className="text-xs text-emerald-700">Looks good for this format.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li
              key={s.id}
              className={cx('rounded-md px-2.5 py-2 text-xs', s.level === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-white text-zinc-700 ring-1 ring-zinc-200')}
            >
              {s.message}
              {s.action?.template && (
                <button
                  type="button"
                  className="ml-1 font-medium text-blue-700 underline underline-offset-2"
                  onClick={() => update((d) => void (d.template = s.action!.template!))}
                >
                  {s.action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-zinc-400">Checks run locally and never block export.</p>
    </Section>
  );
}
