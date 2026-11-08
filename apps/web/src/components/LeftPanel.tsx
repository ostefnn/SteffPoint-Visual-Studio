import { useEffect, useRef, useState } from 'react';
import {
  BRAND_COLOR_PRESETS,
  createProject,
  derivePalette,
  FORMAT_PRESETS,
  isHexColor,
  LIMITS,
  LOGO_ADVICE,
  TEMPLATES,
  type BackgroundType,
  type HeadingFont,
  type LogoSize,
} from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { imageFilesFrom, importImages, moveScreenshot, removeLogo, removeScreenshot } from '../lib/actions';
import { Button, cx, Field, Icon, inputCls, Section, Segmented, Slider } from './ui';
import { Stage } from './Stage';

const NONE: never[] = [];
const DEFAULT_BRAND = createProject().brand;

type Tab = 'templates' | 'images' | 'brand' | 'background';

const TABS: { id: Tab; label: string }[] = [
  { id: 'templates', label: 'Templates' },
  { id: 'images', label: 'Images' },
  { id: 'brand', label: 'Brand' },
  { id: 'background', label: 'Background' },
];

export function LeftPanel({ className }: { className?: string }) {
  const [tab, setTab] = useState<Tab>('templates');
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  // WAI-ARIA tabs pattern: arrows / Home / End move focus and select (automatic activation).
  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = TABS[(next + TABS.length) % TABS.length].id;
    setTab(id);
    tabRefs.current[id]?.focus();
  };

  return (
    <aside className={className}>
      <div
        role="tablist"
        aria-label="Editor panels"
        onKeyDown={onTabKeyDown}
        className="sticky top-0 z-10 flex gap-1 border-b border-zinc-200 bg-zinc-50 p-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls="editor-tabpanel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={cx(
              'flex-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition-transform duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-safe:active:scale-[0.97]',
              tab === t.id ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-600 hover:text-zinc-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="editor-tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'images' && <ImagesTab />}
        {tab === 'brand' && <BrandTab />}
        {tab === 'background' && <BackgroundTab />}
      </div>
    </aside>
  );
}

function TemplatesTab() {
  const project = useEditor((s) => s.project)!;
  const urls = useEditor((s) => s.urls);
  const { update } = useEditor.getState();
  return (
    <div className="grid grid-cols-2 gap-3 p-3">
      {TEMPLATES.map((t) => {
        const active = project.template === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => update((d) => void (d.template = t.id))}
            aria-pressed={active}
            title={t.description}
            className={cx(
              'overflow-hidden rounded-lg bg-white text-left ring-1 transition',
              active ? 'ring-2 ring-blue-600' : 'ring-zinc-200 hover:ring-zinc-400',
            )}
          >
            <Stage project={{ ...project, template: t.id }} format={FORMAT_PRESETS.linkedin} urls={urls} maxWidth={124} maxHeight={65} className="w-full" />
            <span className="block truncate px-2 py-1.5 text-xs font-medium">{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function ImagesTab() {
  const screenshots = useEditor((s) => s.project?.screenshots ?? NONE);
  const assets = useEditor((s) => s.project?.assets ?? NONE);
  const urls = useEditor((s) => s.urls);
  const selected = useEditor((s) => s.selectedShotId);
  const { selectShot } = useEditor.getState();
  const input = useRef<HTMLInputElement>(null);
  const full = screenshots.length >= LIMITS.screenshots;

  return (
    <Section title={`Screenshots ${screenshots.length}/${LIMITS.screenshots}`}>
      <button
        type="button"
        disabled={full}
        onClick={() => input.current?.click()}
        className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 bg-white px-3 py-5 text-center text-sm text-zinc-600 hover:border-blue-500 hover:text-blue-700 disabled:opacity-50"
      >
        <Icon name="upload" className="size-5" />
        <span className="font-medium">Add Screenshots</span>
        <span className="text-xs text-zinc-400">Click, drop anywhere, or paste (Ctrl/Cmd+V)</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          importImages(imageFilesFrom(e.target.files), 'screenshot');
          e.target.value = '';
        }}
      />
      <ul className="space-y-2">
        {screenshots.map((s, i) => {
          const a = assets.find((x) => x.id === s.assetId);
          return (
            <li
              key={s.id}
              className={cx('flex items-center gap-2 rounded-lg bg-white p-1.5 ring-1', selected === s.id ? 'ring-2 ring-blue-600' : 'ring-zinc-200')}
            >
              <button type="button" onClick={() => selectShot(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="checker block size-11 flex-none overflow-hidden rounded">
                  {urls[s.assetId] && <img src={urls[s.assetId]} alt="" className="size-full object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">
                    {i + 1}. {a?.name ?? 'image'}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {a?.width} × {a?.height}
                  </span>
                </span>
              </button>
              <div className="flex flex-none">
                <Button size="sm" variant="ghost" className="px-1.5" disabled={i === 0} onClick={() => moveScreenshot(s.id, -1)} aria-label="Move up">
                  <Icon name="left" className="size-3.5 rotate-90" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-1.5"
                  disabled={i === screenshots.length - 1}
                  onClick={() => moveScreenshot(s.id, 1)}
                  aria-label="Move down"
                >
                  <Icon name="right" className="size-3.5 rotate-90" />
                </Button>
                <Button size="sm" variant="ghost" className="px-1.5 text-red-600" onClick={() => removeScreenshot(s.id)} aria-label="Remove screenshot">
                  <Icon name="trash" className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const FONTS: { value: HeadingFont; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'rounded', label: 'Round' },
  { value: 'mono', label: 'Mono' },
];

function BrandTab() {
  const brand = useEditor((s) => s.project?.brand) ?? DEFAULT_BRAND;
  const urls = useEditor((s) => s.urls);
  const { update } = useEditor.getState();
  const [hex, setHex] = useState(brand.primary);
  useEffect(() => setHex(brand.primary), [brand.primary]); // keep in sync with undo/redo
  const logoInput = useRef<HTMLInputElement>(null);
  const pal = derivePalette(brand.primary, brand.theme);

  const setPrimary = (c: string) => {
    setHex(c);
    if (isHexColor(c)) update((d) => void (d.brand.primary = c.toLowerCase()), 'primary');
  };

  return (
    <>
      <Section title="Colour">
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Primary colour"
            value={brand.primary.length === 7 ? brand.primary : '#2563eb'}
            onChange={(e) => setPrimary(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
          />
          <input aria-label="Primary colour hex" value={hex} onChange={(e) => setPrimary(e.target.value.trim())} className={cx(inputCls, 'font-mono')} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BRAND_COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPrimary(c)}
              aria-label={`Use ${c}`}
              className={cx('size-6 rounded-full ring-offset-2', brand.primary === c && 'ring-2 ring-zinc-900')}
              style={{ background: c }}
            />
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-600">Derived palette</p>
          <div className="flex overflow-hidden rounded-lg ring-1 ring-zinc-200">
            {[pal.bg, pal.primarySoft, pal.primary, pal.primaryStrong, pal.accent, pal.text].map((c, i) => (
              <span key={i} className="h-6 flex-1" style={{ background: c }} title={c} />
            ))}
          </div>
        </div>
        <Segmented
          label="Theme"
          value={brand.theme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(v) => update((d) => void (d.brand.theme = v))}
        />
      </Section>
      <Section title="Typography & shape">
        <Field label="Heading font">
          <Segmented label="Heading font" value={brand.headingFont} options={FONTS} onChange={(v) => update((d) => void (d.brand.headingFont = v))} />
        </Field>
        <Slider label="Corner radius" min={0} max={1} step={0.05} value={brand.radius} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.brand.radius = v), 'radius')} />
        <Slider label="Shadow" min={0} max={1} step={0.05} value={brand.shadow} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.brand.shadow = v), 'shadow')} />
      </Section>
      <Section title="Logo">
        {brand.logoAssetId && urls[brand.logoAssetId] ? (
          <div className="flex items-center gap-3">
            <span className="checker flex h-12 w-24 items-center justify-center rounded-lg p-1.5">
              <img src={urls[brand.logoAssetId]} alt="Logo" className="max-h-full max-w-full object-contain" />
            </span>
            <Button size="sm" onClick={() => logoInput.current?.click()}>
              Replace
            </Button>
            <Button size="sm" variant="danger" onClick={removeLogo}>
              Remove
            </Button>
          </div>
        ) : (
          <Button onClick={() => logoInput.current?.click()}>
            <Icon name="upload" /> Upload Logo
          </Button>
        )}
        {brand.logoAssetId && (
          <div>
            <p className="mb-1 text-xs font-medium text-zinc-600">Logo size</p>
            <Segmented<LogoSize>
              label="Logo size"
              value={brand.logoSize ?? 'medium'}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
              onChange={(v) => update((d) => void (d.brand.logoSize = v))}
            />
          </div>
        )}
        <p className="text-xs text-zinc-500">
          Best: a transparent PNG or WebP, cropped tight to the logo, at least {LOGO_ADVICE.iconPx}&nbsp;×&nbsp;{LOGO_ADVICE.iconPx}&nbsp;px for an icon or{' '}
          {LOGO_ADVICE.wordmarkWidthPx}&nbsp;px wide for a wordmark.
        </p>
        <input
          ref={logoInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            importImages(imageFilesFrom(e.target.files), 'logo');
            e.target.value = '';
          }}
        />
      </Section>
    </>
  );
}

const BACKGROUNDS: { value: BackgroundType; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'glow', label: 'Soft glow' },
  { value: 'grid', label: 'Grid' },
  { value: 'mesh', label: 'Mesh' },
];

function BackgroundTab() {
  const project = useEditor((s) => s.project)!;
  const urls = useEditor((s) => s.urls);
  const bg = project.background;
  const { update } = useEditor.getState();
  return (
    <Section title="Background">
      <div className="grid grid-cols-2 gap-2">
        {BACKGROUNDS.map((b) => (
          <button
            key={b.value}
            type="button"
            aria-pressed={bg.type === b.value}
            onClick={() => update((d) => void (d.background.type = b.value))}
            className={cx(
              'overflow-hidden rounded-lg bg-white text-left ring-1',
              bg.type === b.value ? 'ring-2 ring-blue-600' : 'ring-zinc-200 hover:ring-zinc-400',
            )}
          >
            <Stage
              project={{ ...project, template: 'minimal', content: { ...project.content, kicker: '', title: '', subtitle: '' }, brand: { ...project.brand, logoAssetId: null }, background: { ...bg, type: b.value } }}
              format={FORMAT_PRESETS.linkedin}
              urls={urls}
              maxWidth={124}
              maxHeight={48}
              className="w-full"
            />
            <span className="block px-2 py-1 text-xs font-medium">{b.label}</span>
          </button>
        ))}
      </div>
      <Slider label="Intensity" min={0} max={1} step={0.05} value={bg.intensity} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.background.intensity = v), 'bg-intensity')} />
      {bg.type === 'gradient' && (
        <Slider label="Angle" min={0} max={360} step={5} value={bg.angle} format={(v) => `${v}°`} onChange={(v) => update((d) => void (d.background.angle = v), 'bg-angle')} />
      )}
    </Section>
  );
}
