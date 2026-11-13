import { useEffect, useRef, useState } from 'react';
import {
  BRAND_COLOR_PRESETS,
  getStyle,
  STYLE_IDS,
  STYLES,
  createProject,
  derivePalette,
  FORMAT_PRESETS,
  isHexColor,
  LIMITS,
  LOGO_ADVICE,
  TEMPLATES,
  type BackgroundType,
  type HeadingFont,
  type LogoColor,
  type BrandKit,
  KIT_NAME_MAX,
  withStyle,
  type LogoSize,
} from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { applyStyle, imageFilesFrom, importImages, moveScreenshot, removeLogo, removeScreenshot } from '../lib/actions';
import { Button, cx, Field, Icon, inputCls, Section, Segmented, Slider } from './ui';
import { Stage } from './Stage';
import { CarouselPanel } from './CarouselPanel';
import { applyKitInEditor, saveKitFromEditor } from '../lib/brandKits';
import { deleteBrandKit, listBrandKits } from '../lib/db';
import { sampleLogoColorsFromUrl } from '../lib/logoColors';

import { t } from '../i18n';

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
        aria-label={t('Editor panels')}
        onKeyDown={onTabKeyDown}
        className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-line bg-panel p-2"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[item.id] = el;
            }}
            id={`tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            aria-controls="editor-tabpanel"
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            className={cx(
              'min-w-[30%] flex-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition-transform duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:active:scale-[0.97]',
              tab === item.id ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink',
            )}
          >
            {t(item.label)}
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
      {TEMPLATES.map((tpl) => {
        const active = project.template === tpl.id;
        return (
          <button
            key={tpl.id}
            type="button"
            onClick={() => update((d) => void (d.template = tpl.id))}
            aria-pressed={active}
            title={t(tpl.description)}
            className={cx(
              'overflow-hidden rounded-lg bg-surface text-left ring-1 transition',
              active ? 'ring-2 ring-accent' : 'ring-line hover:ring-field',
            )}
          >
            <Stage project={{ ...project, template: tpl.id }} format={FORMAT_PRESETS.linkedin} urls={urls} maxWidth={124} maxHeight={65} className="w-full" />
            <span className="block truncate px-2 py-1.5 text-xs font-medium">{t(tpl.name)}</span>
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
    <Section title={t('Screenshots {n}/{max}', { n: screenshots.length, max: LIMITS.screenshots })}>
      <button
        type="button"
        disabled={full}
        onClick={() => input.current?.click()}
        className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-field bg-surface px-3 py-5 text-center text-sm text-muted hover:border-accent hover:text-accent-deep disabled:opacity-50"
      >
        <Icon name="upload" className="size-5" />
        <span className="font-medium">{t('Add Screenshots')}</span>
        <span className="text-xs text-faint">{t('Click, drop anywhere, or paste (Ctrl/Cmd+V)')}</span>
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
                <Button size="sm" variant="ghost" className="px-1.5" disabled={i === 0} onClick={() => moveScreenshot(s.id, -1)} aria-label={t('Move up')}>
                  <Icon name="left" className="size-3.5 rotate-90" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-1.5"
                  disabled={i === screenshots.length - 1}
                  onClick={() => moveScreenshot(s.id, 1)}
                  aria-label={t('Move down')}
                >
                  <Icon name="right" className="size-3.5 rotate-90" />
                </Button>
                <Button size="sm" variant="ghost" className="px-1.5 text-danger" onClick={() => removeScreenshot(s.id)} aria-label={t('Remove screenshot')}>
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
  if (!project) return null;
  const current = project.brand.style;
  return (
    <Section title={t('Style')}>
      <div role="radiogroup" aria-label={t('Style')} className="grid grid-cols-2 gap-2">
        {STYLE_IDS.map((id) => {
          const st = STYLES[id];
          const on = current === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => applyStyle(id)}
              title={t(st.description)}
              className={cx(
                'overflow-hidden rounded-lg bg-surface text-left ring-1 transition-transform duration-100 ease-out motion-safe:active:scale-[0.97]',
                on ? 'ring-2 ring-accent' : 'ring-line hover:ring-field',
              )}
            >
              <Stage
                project={withStyle(project, id)}
                format={FORMAT_PRESETS.linkedin}
                urls={urls}
                maxWidth={124}
                maxHeight={65}
                className="w-full"
              />
              <span className="block px-2 pt-1.5 text-xs font-medium text-ink">
                {t(st.name)}
                {id === 'soft' && <span className="font-normal text-muted">{' '}{t('(original)')}</span>}
              </span>
              <span className="block px-2 pb-1.5 text-[11px] leading-snug text-muted">{t(st.description)}</span>
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
  const logoUrl = brand.logoAssetId ? urls[brand.logoAssetId] : undefined;
  const logoColors = useLogoColors(logoUrl);
  const link = useEditor((s) => s.project?.content.link ?? '');

  const setPrimary = (c: string) => {
    setHex(c);
    if (isHexColor(c)) update((d) => void (d.brand.primary = c.toLowerCase()), 'primary');
  };

  return (
    <>
      <BrandKitSection />
      <StylePicker />
      <Section title={t('Colour')}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={t('Primary colour')}
            value={brand.primary.length === 7 ? brand.primary : DEFAULT_BRAND.primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
          />
          <input aria-label={t('Primary colour hex')} value={hex} onChange={(e) => setPrimary(e.target.value.trim())} className={cx(inputCls, 'font-mono')} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BRAND_COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPrimary(c)}
              aria-label={t('Use {c}', { c })}
              className={cx('size-6 rounded-full ring-offset-2', brand.primary === c && 'ring-2 ring-ink')}
              style={{ background: c }}
            />
          ))}
        </div>
        {logoColors.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted">{t('From your logo')}</p>
            <div role="group" aria-label={t('Colours from your logo')} className="flex flex-wrap gap-1.5">
              {logoColors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setPrimary(c.hex)}
                  aria-label={t('Use {c} from the logo', { c: c.hex })}
                  aria-pressed={brand.primary === c.hex}
                  title={t('{c} · {n}% of the logo', { c: c.hex, n: Math.round(c.share * 100) })}
                  className={cx('size-6 rounded-full ring-1 ring-line ring-offset-2', brand.primary === c.hex && 'ring-2 ring-ink')}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-medium text-muted">{t('Derived palette')}</p>
          <div className="flex overflow-hidden rounded-lg ring-1 ring-line">
            {(
              [
                ['Background', pal.bg],
                ['Tint', pal.primarySoft],
                ['Primary', pal.primary],
                ['Shade', pal.primaryStrong],
                ['Accent', pal.accent],
                ['Text', pal.text],
              ] as const
            ).map(([role, c]) => (
              <span key={role} className="h-6 flex-1" style={{ background: c }} title={`${t(role)} · ${c}`} />
            ))}
          </div>
        </div>
        <Segmented
          label={t('Theme')}
          value={brand.theme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(v) => update((d) => void (d.brand.theme = v))}
        />
      </Section>
      <Section title={t('Typography & shape')}>
        {spec.heading === null ? (
          <Field label={t('Heading font')}>
            <Segmented label={t('Heading font')} value={brand.headingFont} options={FONTS} onChange={(v) => update((d) => void (d.brand.headingFont = v))} />
          </Field>
        ) : (
          <p className="text-xs text-muted">{t('Typefaces come from the {style} style.', { style: t(spec.name) })}</p>
        )}
        <Slider label={t('Corner radius')} min={0} max={1} step={0.05} value={brand.radius} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.brand.radius = v), 'radius')} />
        {spec.shadow === 'soft' && (
          <Slider label={t('Shadow')} min={0} max={1} step={0.05} value={brand.shadow} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.brand.shadow = v), 'shadow')} />
        )}
      </Section>
      <Section title={t('Logo')}>
        {brand.logoAssetId && urls[brand.logoAssetId] ? (
          <div className="flex items-center gap-3">
            <span className="checker flex h-12 w-24 items-center justify-center rounded-lg p-1.5">
              <img src={urls[brand.logoAssetId]} alt="Logo" className="max-h-full max-w-full object-contain" />
            </span>
            <Button size="sm" onClick={() => logoInput.current?.click()}>
              {t('Replace')}
            </Button>
            <Button size="sm" variant="danger" onClick={removeLogo}>
              {t('Remove')}
            </Button>
          </div>
        ) : (
          <Button onClick={() => logoInput.current?.click()}>
            <Icon name="upload" />{' '}{t('Upload Logo')}
          </Button>
        )}
        {brand.logoAssetId && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted">{t('Logo size')}</p>
            <Segmented<LogoSize>
              label={t('Logo size')}
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
          {t('Best: a transparent PNG or WebP, cropped tight to the logo, at least {icon} × {icon} px for an icon or {wide} px wide for a wordmark.', {
            icon: LOGO_ADVICE.iconPx,
            wide: LOGO_ADVICE.wordmarkWidthPx,
          })}
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
      <Section title={t('Footer')}>
        <label className="flex items-center gap-2 text-xs font-medium text-ink">
          <input
            type="checkbox"
            checked={brand.footer}
            onChange={(e) => update((d) => void (d.brand.footer = e.target.checked))}
            className="size-4 accent-accent"
          />
          {t('Brand footer on every visual')}
        </label>
        {brand.footer && (
          <Field label={t('Website or handle')} hint={`${link.length}/${LIMITS.link}`}>
            <input
              value={link}
              maxLength={LIMITS.link}
              onChange={(e) => update((d) => void (d.content.link = e.target.value.replace(/\n/g, ' ')), 'content-link')}
              className={inputCls}
              placeholder={t('e.g. steffpoint.com, @steffpoint…')}
            />
          </Field>
        )}
        <p className="text-xs text-muted">
          {t('A line along the bottom with your logo and link. The logo moves there from the title, and carousel pages invite people to swipe.')}
        </p>
      </Section>
    </>
  );
}

/**
 * Saved brand kits: apply one to this project in a single step (undo restores the previous look),
 * save the current identity as a new kit, or update a kit with it.
 */
function BrandKitSection() {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = () => listBrandKits().then(setKits).catch(() => setKits([]));
  useEffect(() => {
    reload();
  }, []);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title={t('Brand kit')}>
      {kits.length > 0 ? (
        <ul className="space-y-1.5" aria-label={t('Brand kits')}>
          {kits.map((k) => (
            <li key={k.id} className="flex items-center gap-2 rounded-lg bg-surface p-1.5 ring-1 ring-line">
              <span className="size-5 flex-none rounded-full ring-1 ring-line" style={{ background: k.brand.primary }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{k.name}</span>
                <span className="block text-[11px] text-muted">
                  {t(STYLES[k.brand.style].name)}
                  {k.logo ? ` · ${t('logo')}` : ''}
                  {k.brand.footer ? ` · ${t('footer')}` : ''}
                </span>
              </span>
              <Button size="sm" variant="primary" className="h-7 px-2 text-[11px]" disabled={busy} onClick={() => run(() => applyKitInEditor(k))}>
                {t('Apply')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-1.5"
                disabled={busy}
                aria-label={t('Update {name} with this project’s brand', { name: k.name })}
                title={t('Update the kit with this project\'s brand')}
                onClick={() => run(() => saveKitFromEditor(k.name, k))}
              >
                <Icon name="upload" className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-1.5 text-danger"
                disabled={busy}
                aria-label={t('Delete {name}', { name: k.name })}
                onClick={() => {
                  if (confirm(t('Delete the brand kit “{name}”? Projects that use it keep their look.', { name: k.name }))) void run(() => deleteBrandKit(k.id));
                }}
              >
                <Icon name="trash" className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">{t('Save this project’s style, colours, logo and footer as a kit to reuse them in one click.')}</p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void run(async () => {
            if (await saveKitFromEditor(name)) setName('');
          });
        }}
      >
        <input
          value={name}
          maxLength={KIT_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          aria-label={t('Brand kit name')}
          placeholder={t('Kit name, e.g. SteffPoint…')}
          className={inputCls}
        />
        <Button type="submit" size="sm" disabled={busy || !name.trim()} className="flex-none">
          {t('Save Kit')}
        </Button>
      </form>
    </Section>
  );
}

/** Dominant colours of the logo, sampled on a canvas whenever the logo changes. */
function useLogoColors(url: string | undefined): LogoColor[] {
  const [colors, setColors] = useState<LogoColor[]>([]);
  useEffect(() => {
    if (!url) return setColors([]);
    let live = true;
    sampleLogoColorsFromUrl(url).then((c) => live && setColors(c));
    return () => {
      live = false;
    };
  }, [url]);
  return colors;
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
    <Section title={t('Background')}>
      {spec.brandBackground && (
        <p className="rounded-md bg-accent-soft px-2 py-1.5 text-xs text-accent-deep">
          {t('The {style} style uses your brand colour as the background. These settings apply when you switch to another style.', { style: t(spec.name) })}
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
            <span className="block px-2 py-1 text-xs font-medium">{t(b.label)}</span>
          </button>
        ))}
      </div>
      <Slider label={t('Intensity')} min={0} max={1} step={0.05} value={bg.intensity} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.background.intensity = v), 'bg-intensity')} />
      {bg.type === 'gradient' && (
        <Slider label={t('Angle')} min={0} max={360} step={5} value={bg.angle} format={(v) => `${v}°`} onChange={(v) => update((d) => void (d.background.angle = v), 'bg-angle')} />
      )}
    </Section>
  );
}
