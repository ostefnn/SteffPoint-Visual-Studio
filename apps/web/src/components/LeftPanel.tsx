import { useEffect, useRef, useState } from 'react';
import {
  BRAND_COLOR_PRESETS,
  getStyle,
  STYLE_IDS,
  STYLES,
  type StyleId,
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
import { CarouselPanel } from './CarouselPanel';

const NONE: never[] = [];
const DEFAULT_BRAND = createProject().brand;

type Tab = 'templates' | 'images' | 'brand' | 'background' | 'carousel';

const TABS: { id: Tab; label: string }[] = [
  { id: 'templates', label: 'Templates' },
  { id: 'images', label: 'Images' },
  { id: 'brand', label: 'Brand' },
  { id: 'background', label: 'Background' },
  { id: 'carousel', label: 'Carousel' },
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
        className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-line bg-panel p-2"
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
              'min-w-[30%] flex-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition-transform duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:active:scale-[0.97]',
              tab === t.id ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink',
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
        {tab === 'carousel' && <CarouselPanel />}
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
              'overflow-hidden rounded-lg bg-surface text-left ring-1 transition',
              active ? 'ring-2 ring-accent' : 'ring-line hover:ring-field',
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
        className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-field bg-surface px-3 py-5 text-center text-sm text-muted hover:border-accent hover:text-accent-deep disabled:opacity-50"
      >
        <Icon name="upload" className="size-5" />
        <span className="font-medium">Add Screenshots</span>
        <span className="text-xs text-faint">Click, drop anywhere, or paste (Ctrl/Cmd+V)</span>
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
              className={cx('flex items-center gap-2 rounded-lg bg-surface p-1.5 ring-1', selected === s.id ? 'ring-2 ring-accent' : 'ring-line')}
            >
              <button type="button" onClick={() => selectShot(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="checker block size-11 flex-none overflow-hidden rounded">
                  {urls[s.assetId] && <img src={urls[s.assetId]} alt="" className="size-full object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">
                    {i + 1}. {a?.name ?? 'image'}
                  </span>
                  <span className="text-[11px] text-muted">
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
                <Button size="sm" variant="ghost" className="px-1.5 text-danger" onClick={() => removeScreenshot(s.id)} aria-label="Remove screenshot">
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

/** Style presets: one choice sets typefaces, kicker, frames, shadows and background treatment. */
function StylePicker() {
  const project = useEditor((s) => s.project);
  const urls = useEditor((s) => s.urls);
  const { update } = useEditor.getState();
  if (!project) return null;
  const current = project.brand.style;
  const choose = (id: StyleId) =>
    update((d) => {
      if (d.brand.style === id) return;
      d.brand.style = id;
      // A style brings its own background and screenshot frame; both stay editable afterwards.
      d.background.type = STYLES[id].defaults.background;
      d.desktopFrame = STYLES[id].defaults.desktopFrame;
    });
  return (
    <Section title="Style">
      <div role="radiogroup" aria-label="Style" className="grid grid-cols-2 gap-2">
        {STYLE_IDS.map((id) => {
          const st = STYLES[id];
          const on = current === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(id)}
              title={st.description}
              className={cx(
                'overflow-hidden rounded-lg bg-surface text-left ring-1 transition-transform duration-100 ease-out motion-safe:active:scale-[0.97]',
                on ? 'ring-2 ring-accent' : 'ring-line hover:ring-field',
              )}
            >
              <Stage
                project={{
                  ...project,
                  brand: { ...project.brand, style: id },
                  background: { ...project.background, type: st.defaults.background },
                  desktopFrame: st.defaults.desktopFrame,
                }}
                format={FORMAT_PRESETS.linkedin}
                urls={urls}
                maxWidth={124}
                maxHeight={65}
                className="w-full"
              />
              <span className="block px-2 pt-1.5 text-xs font-medium text-ink">
                {st.name}
                {id === 'soft' && <span className="font-normal text-muted"> (original)</span>}
              </span>
              <span className="block px-2 pb-1.5 text-[11px] leading-snug text-muted">{st.description}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function BrandTab() {
  const brand = useEditor((s) => s.project?.brand) ?? DEFAULT_BRAND;
  const urls = useEditor((s) => s.urls);
  const { update } = useEditor.getState();
  const [hex, setHex] = useState(brand.primary);
  useEffect(() => setHex(brand.primary), [brand.primary]); // keep in sync with undo/redo
  const logoInput = useRef<HTMLInputElement>(null);
  const pal = derivePalette(brand.primary, brand.theme, brand.style);
  const spec = getStyle(brand.style);

  const setPrimary = (c: string) => {
    setHex(c);
    if (isHexColor(c)) update((d) => void (d.brand.primary = c.toLowerCase()), 'primary');
  };

  return (
    <>
      <StylePicker />
      <Section title="Colour">
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Primary colour"
            value={brand.primary.length === 7 ? brand.primary : DEFAULT_BRAND.primary}
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
              className={cx('size-6 rounded-full ring-offset-2', brand.primary === c && 'ring-2 ring-ink')}
              style={{ background: c }}
            />
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Derived palette</p>
          <div className="flex overflow-hidden rounded-lg ring-1 ring-line">
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
        {spec.heading === null ? (
          <Field label="Heading font">
            <Segmented label="Heading font" value={brand.headingFont} options={FONTS} onChange={(v) => update((d) => void (d.brand.headingFont = v))} />
          </Field>
        ) : (
          <p className="text-xs text-muted">Typefaces come from the {spec.name} style.</p>
        )}
        <Slider label="Corner radius" min={0} max={1} step={0.05} value={brand.radius} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.brand.radius = v), 'radius')} />
        {spec.shadow === 'soft' && (
          <Slider label="Shadow" min={0} max={1} step={0.05} value={brand.shadow} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.brand.shadow = v), 'shadow')} />
        )}
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
            <p className="mb-1 text-xs font-medium text-muted">Logo size</p>
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
        <p className="text-xs text-muted">
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
  const spec = getStyle(project.brand.style);
  return (
    <Section title="Background">
      {spec.brandBackground && (
        <p className="rounded-md bg-accent-soft px-2 py-1.5 text-xs text-accent-deep">
          The {spec.name} style uses your brand colour as the background. These settings apply when you switch to another style.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {BACKGROUNDS.map((b) => (
          <button
            key={b.value}
            type="button"
            aria-pressed={bg.type === b.value}
            onClick={() => update((d) => void (d.background.type = b.value))}
            className={cx(
              'overflow-hidden rounded-lg bg-surface text-left ring-1',
              bg.type === b.value ? 'ring-2 ring-accent' : 'ring-line hover:ring-field',
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
