import { useMemo, useRef } from 'react';
import {
  analyzeProject,
  clampCode,
  CROP_MAX,
  DESKTOP_FRAME_TEMPLATES,
  DEVICE_KINDS,
  DEVICE_LABELS,
  getTemplate,
  LIMITS,
  MIN_DEVICES,
  NO_CROP,
  normalizeDevices,
  resolveFormat,
  screenshotRange,
  ZOOM_RANGE,
  type Crop,
  type DesktopFrame,
  type DeviceKind,
  type DeviceOrientation,
  type RotatableDevice,
  type ScreenshotSlot,
} from '@svs/visual-core';
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
  const devices = useEditor((s) => s.project?.devices);
  const orientation = useEditor((s) => s.project?.deviceOrientation);
  const desktopFrame = useEditor((s) => s.project?.desktopFrame);
  const { update } = useEditor.getState();
  if (!content || !template) return null;
  const showsDesktop =
    DESKTOP_FRAME_TEMPLATES.includes(template) && (template !== 'device-mix' || normalizeDevices(devices).includes('desktop'));

  type TextKey =
    | 'kicker'
    | 'title'
    | 'subtitle'
    | 'beforeLabel'
    | 'afterLabel'
    | 'codeFile'
    | 'quote'
    | 'author'
    | 'authorRole'
    | 'eventDate'
    | 'eventTime'
    | 'eventPlace'
    | 'cta';
  const maxLen: Record<TextKey, number> = {
    kicker: LIMITS.kicker,
    title: LIMITS.title,
    subtitle: LIMITS.subtitle,
    beforeLabel: LIMITS.label,
    afterLabel: LIMITS.label,
    codeFile: LIMITS.codeFile,
    quote: LIMITS.quote,
    author: LIMITS.person,
    authorRole: LIMITS.person,
    eventDate: LIMITS.eventField,
    eventTime: LIMITS.eventField,
    eventPlace: LIMITS.eventField,
    cta: LIMITS.cta,
  };
  // Single-line fields drop newlines; the quote keeps them.
  const set = (key: TextKey) => (e: { target: { value: string } }) =>
    update((d) => {
      const v = key === 'quote' || key === 'title' || key === 'subtitle' ? e.target.value : e.target.value.replace(/\n/g, ' ');
      d.content[key] = v.slice(0, maxLen[key]);
    }, `content-${key}`);
  const slots = getTemplate(template).slots;
  const stats = Array.from({ length: LIMITS.statItems }, (_, i) => content.stats[i] ?? { value: '', label: '' });
  const setStat = (i: number, key: 'value' | 'label', value: string) =>
    update((d) => {
      const list = Array.from({ length: LIMITS.statItems }, (_, j) => (d.content.stats[j] ? { ...d.content.stats[j] } : { value: '', label: '' }));
      list[i] = { ...list[i], [key]: value.replace(/\n/g, ' ').slice(0, key === 'value' ? LIMITS.statValue : LIMITS.statLabel) };
      // Keep trailing empty rows out of the project.
      while (list.length && !list[list.length - 1].value && !list[list.length - 1].label) list.pop();
      d.content.stats = list;
    }, `stat-${i}-${key}`);
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
      {slots.title && (
        <Field label="Title" hint={count(content.title, LIMITS.title)}>
          <textarea value={content.title} onChange={set('title')} rows={2} className={cx(inputCls, 'resize-y')} />
        </Field>
      )}
      {slots.subtitle && (
        <Field label="Subtitle" hint={count(content.subtitle, LIMITS.subtitle)}>
          <textarea value={content.subtitle} onChange={set('subtitle')} rows={3} className={cx(inputCls, 'resize-y')} />
        </Field>
      )}
      {template === 'testimonial' && (
        <>
          <Field label="Quote" hint={count(content.quote, LIMITS.quote)}>
            <textarea value={content.quote} onChange={set('quote')} rows={4} className={cx(inputCls, 'resize-y')} />
          </Field>
          <Field label="Name">
            <input value={content.author} onChange={set('author')} className={inputCls} placeholder="e.g. Alex Martin…" />
          </Field>
          <Field label="Role">
            <input value={content.authorRole} onChange={set('authorRole')} className={inputCls} placeholder="e.g. Head of Marketing, Northwind…" />
          </Field>
          <p className="text-[11px] text-zinc-500">The first screenshot is used as the photo; without one, the initials are shown.</p>
        </>
      )}
      {template === 'stats' && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-medium text-zinc-600">Figures (up to {LIMITS.statItems})</legend>
          {stats.map((st, i) => (
            <div key={i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
              <input
                value={st.value}
                aria-label={`Figure ${i + 1} value`}
                placeholder={i === 0 ? '10k+…' : 'Value…'}
                onChange={(e) => setStat(i, 'value', e.target.value)}
                className={cx(inputCls, 'font-semibold tabular-nums')}
              />
              <input
                value={st.label}
                aria-label={`Figure ${i + 1} label`}
                placeholder={i === 0 ? 'e.g. Visuals exported…' : 'Label…'}
                onChange={(e) => setStat(i, 'label', e.target.value)}
                className={inputCls}
              />
            </div>
          ))}
        </fieldset>
      )}
      {template === 'event' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date">
              <input value={content.eventDate} onChange={set('eventDate')} className={inputCls} placeholder="e.g. Thu 12 Dec…" />
            </Field>
            <Field label="Time">
              <input value={content.eventTime} onChange={set('eventTime')} className={inputCls} placeholder="e.g. 14:00 CET…" />
            </Field>
          </div>
          <Field label="Place">
            <input value={content.eventPlace} onChange={set('eventPlace')} className={inputCls} placeholder="e.g. Online · Microsoft Teams…" />
          </Field>
          <Field label="Call to action">
            <input value={content.cta} onChange={set('cta')} className={inputCls} placeholder="e.g. Register now…" />
          </Field>
          <p className="text-[11px] text-zinc-500">Screenshots 1–3 are shown as speaker photos.</p>
        </>
      )}
      {showsDesktop && (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-600">Desktop frame</p>
          <Segmented<DesktopFrame>
            label="Desktop frame"
            value={desktopFrame ?? 'browser'}
            options={[
              { value: 'browser', label: 'Browser' },
              { value: 'window', label: 'Window' },
              { value: 'plain', label: 'Plain' },
              { value: 'laptop', label: 'Laptop' },
            ]}
            onChange={(v) => update((d) => void (d.desktopFrame = v))}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Use Plain for app screenshots that already include their own title bar.
          </p>
        </div>
      )}
      {template === 'device-mix' && (
        <DevicePicker devices={normalizeDevices(devices)} orientation={orientation ?? { tablet: 'portrait', mobile: 'portrait' }} />
      )}
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
  const devices = useEditor((s) => s.project?.devices);
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

  const { max } = screenshotRange({ template: template ?? 'browser-hero', devices: devices ?? [] });
  const crop: Crop = shot.crop ?? NO_CROP;
  const cropped = crop.top + crop.right + crop.bottom + crop.left > 0;
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
      <Field label="Carousel caption" hint={`${(shot.caption ?? '').length}/${LIMITS.caption}`}>
        <input
          value={shot.caption ?? ''}
          maxLength={LIMITS.caption}
          name="caption"
          autoComplete="off"
          placeholder="e.g. Every environment at a glance…"
          onChange={(e) => set('caption', e.target.value.replace(/\n/g, ' ').slice(0, LIMITS.caption), `caption-${shot.id}`)}
          className={inputCls}
        />
      </Field>
      <FocalPicker
        url={urls[shot.assetId]}
        asset={assets?.find((a) => a.id === shot.assetId)}
        crop={crop}
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
      <Slider
        label="Zoom"
        min={ZOOM_RANGE.min}
        max={ZOOM_RANGE.max}
        step={0.05}
        value={shot.zoom}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(v) => set('zoom', v, `zoom-${shot.id}`)}
      />
      <fieldset className="space-y-2">
        <legend className="flex w-full items-center justify-between text-xs font-medium text-zinc-600">
          Crop
          {cropped && (
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => set('crop', { ...NO_CROP })}>
              Reset Crop
            </Button>
          )}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
            <Slider
              key={edge}
              label={`Crop ${edge}`}
              min={0}
              max={CROP_MAX}
              step={0.01}
              value={crop[edge]}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => set('crop', { ...crop, [edge]: v }, `crop-${edge}-${shot.id}`)}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Focal X" min={0} max={1} step={0.01} value={shot.focalX} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('focalX', v, `focal-${shot.id}`)} />
        <Slider label="Focal Y" min={0} max={1} step={0.01} value={shot.focalY} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('focalY', v, `focal-${shot.id}`)} />
      </div>
    </Section>
  );
}

/** Device Mix: choose which frames to show. At least MIN_DEVICES stay selected. */
const ORIENTATIONS: { value: DeviceOrientation; label: string }[] = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

function DevicePicker({ devices, orientation }: { devices: DeviceKind[]; orientation: Record<RotatableDevice, DeviceOrientation> }) {
  const { update } = useEditor.getState();
  const toggle = (d: DeviceKind) =>
    update((p) => {
      const next = devices.includes(d) ? devices.filter((x) => x !== d) : DEVICE_KINDS.filter((x) => x === d || devices.includes(x));
      if (next.length >= MIN_DEVICES) p.devices = next;
    });
  const atMin = devices.length <= MIN_DEVICES;
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-zinc-600">Devices</legend>
      <div className="flex gap-1.5">
        {DEVICE_KINDS.map((d) => {
          const on = devices.includes(d);
          return (
            <label
              key={d}
              className={cx(
                'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium ring-1 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600',
                on ? 'bg-blue-50 text-blue-800 ring-blue-300' : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50',
              )}
            >
              <input type="checkbox" className="sr-only" checked={on} disabled={on && atMin} onChange={() => toggle(d)} />
              {DEVICE_LABELS[d]}
            </label>
          );
        })}
      </div>
      {(['tablet', 'mobile'] as const)
        .filter((d) => devices.includes(d))
        .map((d) => (
          <div key={d} className="mt-2 flex items-center gap-2">
            <span className="w-14 flex-none text-xs text-zinc-600">{DEVICE_LABELS[d]}</span>
            <div className="flex-1">
              <Segmented
                label={`${DEVICE_LABELS[d]} orientation`}
                value={orientation[d]}
                options={ORIENTATIONS}
                onChange={(v) =>
                  update((p) => {
                    p.deviceOrientation = { ...orientation, [d]: v };
                  })
                }
              />
            </div>
          </div>
        ))}
      <p className="mt-1 text-[11px] text-zinc-500">
        Pick {MIN_DEVICES} or 3. Screenshots fill the devices in order: {devices.map((d) => DEVICE_LABELS[d].toLowerCase()).join(', ')}.
      </p>
    </fieldset>
  );
}

/** Click or drag on the image to set the point that must stay visible in every format. */
const FOCAL_MAX_HEIGHT = 192; // matches max-h-48

function FocalPicker({
  url,
  asset,
  crop,
  x,
  y,
  onChange,
}: {
  url?: string;
  asset?: { width: number; height: number };
  crop: Crop;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
    // The preview shows the whole image; the focal point is relative to the cropped area.
    const fx = ((e.clientX - r.left) / r.width - crop.left) / cw;
    const fy = ((e.clientY - r.top) / r.height - crop.top) / ch;
    onChange(clamp(fx), clamp(fy));
  };
  const cw = 1 - crop.left - crop.right;
  const ch = 1 - crop.top - crop.bottom;
  const hasCrop = cw < 1 || ch < 1;
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
          className="relative cursor-crosshair touch-none select-none overflow-hidden focus-visible:outline-2 focus-visible:outline-blue-600"
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
          {hasCrop && (
            // Dim what the crop removes.
            <span
              data-testid="crop-area"
              className="pointer-events-none absolute border border-white/80"
              style={{
                left: `${crop.left * 100}%`,
                top: `${crop.top * 100}%`,
                width: `${cw * 100}%`,
                height: `${ch * 100}%`,
                boxShadow: '0 0 0 9999px rgba(9, 9, 11, 0.55)',
              }}
            />
          )}
          <span
            className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600/60 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
            style={{ left: `${(crop.left + x * cw) * 100}%`, top: `${(crop.top + y * ch) * 100}%` }}
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
