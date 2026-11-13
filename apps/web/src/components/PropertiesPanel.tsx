import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCarouselSlides,
  analyzeProject,
  clampCode,
  CROP_MAX,
  DESKTOP_FRAME_TEMPLATES,
  DEFAULT_LAYOUT,
  MIRROR_TEMPLATES,
  TILT_TEMPLATES,
  DEVICE_KINDS,
  DEVICE_LABELS,
  getTemplate,
  LEGEND_LIMITS,
  legendToText,
  LIMITS,
  MIN_DEVICES,
  parseLegendText,
  NO_CROP,
  normalizeDevices,
  resolveFormat,
  screenshotRange,
  ZOOM_RANGE,
  type Crop,
  type DesktopFrame,
  type DeviceKind,
  type DeviceOrientation,
  type LegendItem,
  CONTENT_KEYS,
  type Content,
  clampArea,
  MAGNIFY_RANGE,
  MAX_REDACTIONS,
  type Area,
  type TextAlign,
  type TextPosition,
  type Tilt,
  type RotatableDevice,
  type ScreenshotSlot,
} from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { duplicateScreenshot, removeScreenshot } from '../lib/actions';
import { Button, cx, Field, Icon, inputCls, Section, Segmented, Slider } from './ui';

import { t, tMessage } from '../i18n';

export function PropertiesPanel({ className }: { className?: string }) {
  return (
    <aside className={className}>
      <ContentSection />
      <LayoutSection />
      <ImageSection />
      <Suggestions />
    </aside>
  );
}

function ContentSection() {
  const projectContent = useEditor((s) => s.project?.content);
  const projectTemplate = useEditor((s) => s.project?.template);
  // When a carousel page is on the canvas, show the fields of that page's template.
  const project = useEditor((s) => s.project);
  const carouselPage = useEditor((s) => s.carouselPage);
  const slide = useMemo(
    () => (project && carouselPage !== null ? buildCarouselSlides(project)[carouselPage] : undefined),
    [project, carouselPage],
  );
  const pageTemplate = slide?.variant.template;
  const template = pageTemplate ?? projectTemplate;
  // A custom page can have its own content (This page) or edit the project's (All pages).
  const [scope, setScope] = useState<'page' | 'project'>('page');
  const pageId = slide && !slide.auto ? slide.variant.id : null;
  const pageScope = !!pageId && scope === 'page';
  const ownKeys = pageId ? Object.keys(slide!.variant.content) : [];
  const content = pageScope && projectContent ? { ...projectContent, ...slide!.variant.content } : projectContent;
  const devices = useEditor((s) => s.project?.devices);
  const orientation = useEditor((s) => s.project?.deviceOrientation);
  const desktopFrame = useEditor((s) => s.project?.desktopFrame);
  const brandFooter = useEditor((s) => s.project?.brand.footer);
  const { update } = useEditor.getState();
  /**
   * Apply a change to the content being edited. On a page, the page keeps the keys it already
   * overrides and gains those that now differ from the project; the project is left untouched.
   */
  const write = (fn: (c: Content) => void, key?: string) =>
    update((d) => {
      if (!pageScope) return fn(d.content);
      const v = d.carousel.slides.find((x) => x.id === pageId);
      if (!v) return;
      const c = structuredClone({ ...d.content, ...v.content });
      fn(c);
      const next: Partial<Content> = {};
      for (const k of CONTENT_KEYS) {
        if (k in v.content || JSON.stringify(c[k]) !== JSON.stringify(d.content[k])) (next as Record<string, unknown>)[k] = c[k];
      }
      v.content = next;
    }, key && (pageScope ? `${pageId}-${key}` : key));
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
    | 'cta'
    | 'link';
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
    link: LIMITS.link,
  };
  // Single-line fields drop newlines; the quote keeps them.
  const set = (key: TextKey) => (e: { target: { value: string } }) =>
    write((d) => {
      const v = key === 'quote' || key === 'title' || key === 'subtitle' ? e.target.value : e.target.value.replace(/\n/g, ' ');
      d[key] = v.slice(0, maxLen[key]);
    }, `content-${key}`);
  const slots = getTemplate(template).slots;
  const stats = Array.from({ length: LIMITS.statItems }, (_, i) => content.stats[i] ?? { value: '', label: '' });
  const setStat = (i: number, key: 'value' | 'label', value: string) =>
    write((d) => {
      const list = Array.from({ length: LIMITS.statItems }, (_, j) => (d.stats[j] ? { ...d.stats[j] } : { value: '', label: '' }));
      list[i] = { ...list[i], [key]: value.replace(/\n/g, ' ').slice(0, key === 'value' ? LIMITS.statValue : LIMITS.statLabel) };
      // Keep trailing empty rows out of the project.
      while (list.length && !list[list.length - 1].value && !list[list.length - 1].label) list.pop();
      d.stats = list;
    }, `stat-${i}-${key}`);
  const setFeature = (i: number, value: string) =>
    write((d) => {
      const list = [...d.features];
      while (list.length <= i) list.push('');
      list[i] = value.replace(/\n/g, ' ').slice(0, LIMITS.feature);
      d.features = list.slice(0, LIMITS.featureItems);
    }, `feature-${i}`);
  const features = Array.from({ length: LIMITS.featureItems }, (_, i) => content.features[i] ?? '');
  const steps = Array.from({ length: LIMITS.stepItems }, (_, i) => content.steps[i] ?? { title: '', text: '' });
  const setStep = (i: number, key: 'title' | 'text', value: string) =>
    write((d) => {
      const list = Array.from({ length: LIMITS.stepItems }, (_, j) => ({ ...(d.steps[j] ?? { title: '', text: '' }) }));
      list[i][key] = value.replace(/\n/g, ' ').slice(0, key === 'title' ? LIMITS.stepTitle : LIMITS.stepText);
      while (list.length && !list[list.length - 1].title && !list[list.length - 1].text) list.pop();
      d.steps = list;
    }, `step-${i}-${key}`);
  const compare = content.compare;
  const editCompare = (fn: (c: Content['compare']) => void, key?: string) => write((d) => fn(d.compare), key);
  // The last column is the highlighted one (yours): add or remove columns just before it.
  const resize = <T,>(list: T[], n: number, blank: T): T[] => {
    const next = [...list];
    while (next.length < n) next.splice(Math.max(0, next.length - 1), 0, blank);
    while (next.length > n) next.splice(next.length - 2, 1);
    return next;
  };
  const setColumns = (n: number) =>
    editCompare((c) => {
      c.columns = resize(c.columns, n, '');
      c.rows = c.rows.map((r) => ({ ...r, cells: resize(r.cells, n, '') }));
    });
  const codeLines = content.code.split('\n').length;
  const count = (v: string, max: number) => (
    <span className={cx(v.length > max * 0.8 && 'text-warn')}>
      {v.length}/{max}
    </span>
  );

  return (
    <Section title={t('Content')}>
      {pageId ? (
        <div className="space-y-1.5 rounded-md bg-accent-soft px-2 py-2 text-xs text-accent-deep">
          <Segmented<'page' | 'project'>
            label={t('Edit content of')}
            value={scope}
            options={[
              { value: 'page', label: 'This page' },
              { value: 'project', label: 'All pages' },
            ]}
            onChange={setScope}
          />
          <p>
            {scope === 'page'
              ? ownKeys.length
                ? t('Changes apply to this carousel page only. Fields you have not changed follow the project.')
                : t('Changes apply to this carousel page only. It follows the project until you change something.')
              : t('Changes apply to the project and to every page that has not changed that field.')}
          </p>
          {scope === 'page' && ownKeys.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[11px]"
              onClick={() => update((d) => void (d.carousel.slides.find((x) => x.id === pageId)!.content = {}))}
            >
              {t('Use the project’s content again')}
            </Button>
          )}
        </div>
      ) : (
        pageTemplate && (
          <p className="rounded-md bg-accent-soft px-2 py-1.5 text-xs text-accent-deep">
            {t('Automatic carousel pages use the project’s content. Click “Customize Pages” in the Carousel tab to give a page its own.')}
          </p>
        )
      )}
      <Field label={t('Kicker')} hint={count(content.kicker, LIMITS.kicker)}>
        <input value={content.kicker} onChange={set('kicker')} className={inputCls} placeholder={t('e.g. Version 2.4…')} />
      </Field>
      {slots.title && (
        <Field label={t('Title')} hint={count(content.title, LIMITS.title)}>
          <textarea value={content.title} onChange={set('title')} rows={2} className={cx(inputCls, 'resize-y')} />
        </Field>
      )}
      {slots.subtitle && (
        <Field label={t('Subtitle')} hint={count(content.subtitle, LIMITS.subtitle)}>
          <textarea value={content.subtitle} onChange={set('subtitle')} rows={3} className={cx(inputCls, 'resize-y')} />
        </Field>
      )}
      {template === 'testimonial' && (
        <>
          <Field label={t('Quote')} hint={count(content.quote, LIMITS.quote)}>
            <textarea value={content.quote} onChange={set('quote')} rows={4} className={cx(inputCls, 'resize-y')} />
          </Field>
          <Field label={t('Name')}>
            <input value={content.author} onChange={set('author')} className={inputCls} placeholder={t('Their full name…')} />
          </Field>
          <Field label={t('Role')}>
            <input value={content.authorRole} onChange={set('authorRole')} className={inputCls} placeholder={t('Their role and company…')} />
          </Field>
          <p className="text-[11px] text-muted">{t('The first screenshot is used as the photo; without one, the initials are shown.')}</p>
        </>
      )}
      {template === 'stats' && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-medium text-muted">{t('Figures (up to {n})', { n: LIMITS.statItems })}</legend>
          {stats.map((st, i) => (
            <div key={i} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
              <input
                value={st.value}
                aria-label={t('Figure {n} value', { n: i + 1 })}
                placeholder={i === 0 ? 'e.g. 12…' : 'Value…'}
                onChange={(e) => setStat(i, 'value', e.target.value)}
                className={cx(inputCls, 'font-semibold tabular-nums')}
              />
              <input
                value={st.label}
                aria-label={t('Figure {n} label', { n: i + 1 })}
                placeholder={i === 0 ? t('e.g. Visuals exported…') : 'Label…'}
                onChange={(e) => setStat(i, 'label', e.target.value)}
                className={inputCls}
              />
            </div>
          ))}
        </fieldset>
      )}
      {template === 'cta' && (
        <>
          <Field label={t('Button')}>
            <input value={content.cta} onChange={set('cta')} className={inputCls} placeholder={t('e.g. Try it free…')} />
          </Field>
          <Field label={t('Link')} hint={count(content.link, LIMITS.link)}>
            <input value={content.link} onChange={set('link')} className={inputCls} placeholder={t('e.g. steffpoint.com/visual-studio…')} />
          </Field>
          <label className="flex items-center gap-2 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={content.qr}
              onChange={(e) => write((d) => void (d.qr = e.target.checked))}
              className="size-4 accent-accent"
            />
            {t('QR code of the link')}
          </label>
          <p className="text-[11px] text-muted">{t('Use the full address (https://…) so a phone opens it when scanning.')}</p>
        </>
      )}
      {template !== 'cta' && brandFooter && (
        <Field label={t('Link (footer)')} hint={count(content.link, LIMITS.link)}>
          <input value={content.link} onChange={set('link')} className={inputCls} placeholder={t('e.g. steffpoint.com, @steffpoint…')} />
        </Field>
      )}
      {template === 'event' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('Date')}>
              <input value={content.eventDate} onChange={set('eventDate')} className={inputCls} placeholder={t('e.g. Thu 12 Dec…')} />
            </Field>
            <Field label={t('Time')}>
              <input value={content.eventTime} onChange={set('eventTime')} className={inputCls} placeholder={t('e.g. 14:00 CET…')} />
            </Field>
          </div>
          <Field label={t('Place')}>
            <input value={content.eventPlace} onChange={set('eventPlace')} className={inputCls} placeholder={t('e.g. Online, Microsoft Teams…')} />
          </Field>
          <Field label={t('Call to action')}>
            <input value={content.cta} onChange={set('cta')} className={inputCls} placeholder={t('e.g. Register…')} />
          </Field>
          <p className="text-[11px] text-muted">{t('Screenshots 1 to 3 are shown as speaker photos.')}</p>
        </>
      )}
      {showsDesktop && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">{t('Desktop frame')}</p>
          <Segmented<DesktopFrame>
            label={t('Desktop frame')}
            value={desktopFrame ?? 'browser'}
            options={[
              { value: 'browser', label: 'Browser' },
              { value: 'window', label: 'Window' },
              { value: 'plain', label: 'Plain' },
              { value: 'laptop', label: 'Laptop' },
            ]}
            onChange={(v) => update((d) => void (d.desktopFrame = v))}
          />
          <p className="mt-1 text-[11px] text-muted">
            {t('Use Plain for app screenshots that already include their own title bar.')}
          </p>
        </div>
      )}
      {template === 'device-mix' && (
        <DevicePicker devices={normalizeDevices(devices)} orientation={orientation ?? { tablet: 'portrait', mobile: 'portrait' }} />
      )}
      {template === 'before-after' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('Before label')}>
            <input value={content.beforeLabel} onChange={set('beforeLabel')} className={inputCls} />
          </Field>
          <Field label={t('After label')}>
            <input value={content.afterLabel} onChange={set('afterLabel')} className={inputCls} />
          </Field>
        </div>
      )}
      {template === 'features' && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-medium text-muted">{t('Features (up to {n})', { n: LIMITS.featureItems })}</legend>
          {features.map((f, i) => (
            <input
              key={i}
              value={f}
              aria-label={t('Feature {n}', { n: i + 1 })}
              placeholder={i === 0 ? t('e.g. Works offline…') : 'Optional…'}
              onChange={(e) => setFeature(i, e.target.value)}
              className={inputCls}
            />
          ))}
        </fieldset>
      )}
      {template === 'detail-zoom' && (
        <>
          <Slider
            label={t('Magnification')}
            min={MAGNIFY_RANGE.min}
            max={MAGNIFY_RANGE.max}
            step={0.1}
            value={content.magnify}
            format={(v) => `${v.toFixed(1)}×`}
            onChange={(v) => write((d) => void (d.magnify = v), 'magnify')}
          />
          <p className="text-[11px] text-muted">{t('The lens shows the screenshot’s focal point: click the detail in the Image panel.')}</p>
        </>
      )}
      {template === 'steps' && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-xs font-medium text-muted">{t('Steps (up to {n}, in order)', { n: LIMITS.stepItems })}</legend>
          {steps.map((st, i) => (
            <div key={i} className="space-y-1">
              <input
                value={st.title}
                aria-label={t('Step {n} title', { n: i + 1 })}
                placeholder={i < 2 ? t('Step {n}, e.g. Import your screenshots…', { n: i + 1 }) : t('Optional…')}
                maxLength={LIMITS.stepTitle}
                onChange={(e) => setStep(i, 'title', e.target.value)}
                className={inputCls}
              />
              {(st.title || st.text) && (
                <input
                  value={st.text}
                  aria-label={t('Step {n} text', { n: i + 1 })}
                  placeholder={t('One short sentence…')}
                  maxLength={LIMITS.stepText}
                  onChange={(e) => setStep(i, 'text', e.target.value)}
                  className={cx(inputCls, 'text-xs')}
                />
              )}
            </div>
          ))}
        </fieldset>
      )}
      {template === 'comparison' && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-medium text-muted">{t('Comparison')}</legend>
          <Segmented<'2' | '3'>
            label={t('Columns compared')}
            value={String(compare.columns.length) as '2' | '3'}
            options={[
              { value: '2', label: '2 columns' },
              { value: '3', label: '3 columns' },
            ]}
            onChange={(v) => setColumns(Number(v))}
          />
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${compare.columns.length}, minmax(0, 1fr))` }}>
            {compare.columns.map((c, j) => (
              <input
                key={j}
                value={c}
                aria-label={t('Column {n} name', { n: j + 1 })}
                placeholder={j === compare.columns.length - 1 ? 'Yours…' : 'Other…'}
                maxLength={LIMITS.compareHeader}
                onChange={(e) => editCompare((cmp) => void (cmp.columns[j] = e.target.value.replace(/\n/g, ' ')), `compare-col-${j}`)}
                className={cx(inputCls, 'text-xs', j === compare.columns.length - 1 && 'font-semibold')}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted">{t('The last column is highlighted. Write yes or no in a cell for a tick or a cross.')}</p>
          <ol className="space-y-2">
            {compare.rows.map((r, i) => (
              <li key={i} className="space-y-1 rounded-md bg-surface p-1.5 ring-1 ring-line">
                <div className="flex gap-1">
                  <input
                    value={r.label}
                    aria-label={t('Criterion {n}', { n: i + 1 })}
                    placeholder={t('Criterion…')}
                    maxLength={LIMITS.compareLabel}
                    onChange={(e) => editCompare((cmp) => void (cmp.rows[i].label = e.target.value.replace(/\n/g, ' ')), `compare-row-${i}`)}
                    className={cx(inputCls, 'text-xs')}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-1.5 text-danger"
                    aria-label={t('Remove criterion {n}', { n: i + 1 })}
                    onClick={() => editCompare((cmp) => void cmp.rows.splice(i, 1))}
                  >
                    <Icon name="trash" className="size-3.5" />
                  </Button>
                </div>
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${compare.columns.length}, minmax(0, 1fr))` }}>
                  {r.cells.map((cell, j) => (
                    <input
                      key={j}
                      value={cell}
                      aria-label={t('Criterion {n}, {column}', { n: i + 1, column: compare.columns[j] || t('column {n}', { n: j + 1 }) })}
                      placeholder={t('yes / no / text')}
                      maxLength={LIMITS.compareCell}
                      onChange={(e) => editCompare((cmp) => void (cmp.rows[i].cells[j] = e.target.value.replace(/\n/g, ' ')), `compare-${i}-${j}`)}
                      className={cx(inputCls, 'px-1.5 text-xs')}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <Button
            size="sm"
            disabled={compare.rows.length >= LIMITS.compareRows}
            onClick={() => editCompare((cmp) => void cmp.rows.push({ label: '', cells: cmp.columns.map(() => '') }))}
          >
            <Icon name="plus" className="size-3.5" />{' '}{t('Add Criterion')}
          </Button>
        </fieldset>
      )}
      {template === 'code' && (
        <>
          <Field label={t('File name')}>
            <input value={content.codeFile} onChange={set('codeFile')} className={cx(inputCls, 'font-mono')} placeholder={t('e.g. index.ts')} />
          </Field>
          <Field label={t('Code')} hint={
              <span className={cx(codeLines >= LIMITS.codeLines && 'text-warn')}>
                {t('{n}/{max} lines', { n: codeLines, max: LIMITS.codeLines })}
              </span>
            }>
            <textarea
              value={content.code}
              spellCheck={false}
              rows={10}
              onChange={(e) => write((d) => void (d.code = clampCode(e.target.value)), 'content-code')}
              onKeyDown={(e) => {
                // Tab inserts two spaces instead of leaving the field.
                if (e.key !== 'Tab' || e.shiftKey) return;
                e.preventDefault();
                const el = e.currentTarget;
                const { selectionStart: a, selectionEnd: b, value } = el;
                write((d) => void (d.code = clampCode(value.slice(0, a) + '  ' + value.slice(b))), 'content-code');
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

/**
 * Legend of the numbered fields in the screenshot, one per line: `Label | property | off`.
 * The draft is kept as typed (a trailing "|" would not survive a round trip) and only
 * replaced when the legend changes from elsewhere, such as undo.
 */
function LegendField({ legend, onChange }: { legend: LegendItem[]; onChange: (legend: LegendItem[]) => void }) {
  const [draft, setDraft] = useState(() => legendToText(legend));
  useEffect(() => {
    if (JSON.stringify(parseLegendText(draft)) !== JSON.stringify(legend)) setDraft(legendToText(legend));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legend]);
  return (
    <Field label={t('Legend')} hint={`${legend.length}/${LEGEND_LIMITS.items}`}>
      <textarea
        value={draft}
        rows={Math.min(10, Math.max(4, legend.length + 1))}
        name="legend"
        spellCheck={false}
        placeholder={t('One numbered field per line:\nTitle | title\nButton link | ctaUrl | off')}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseLegendText(e.target.value));
        }}
        className={cx(inputCls, 'resize-y text-xs leading-relaxed')}
      />
      <span className="mt-1 block text-xs text-muted">{t('Line 1 names badge 1 in the image. Add “| off” for a field that is greyed out.')}</span>
    </Field>
  );
}

/**
 * Layout options shared by every template: mirror, text position and alignment, tilt.
 * Auto keeps the template's own layout; options a template cannot use are not shown.
 */
function LayoutSection() {
  const layout = useEditor((s) => s.project?.layout) ?? DEFAULT_LAYOUT;
  const template = useEditor((s) =>
    s.project ? (s.carouselPage !== null ? buildCarouselSlides(s.project)[s.carouselPage]?.variant.template : undefined) ?? s.project.template : undefined,
  );
  const { update } = useEditor.getState();
  if (!template) return null;
  const canMirror = MIRROR_TEMPLATES.includes(template);
  const canTilt = TILT_TEMPLATES.includes(template);
  const custom = layout.mirror || layout.textPosition !== 'auto' || layout.textAlign !== 'auto' || layout.tilt !== 'none';
  return (
    <Section
      title={t('Layout')}
      action={
        custom ? (
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => update((d) => void (d.layout = { ...DEFAULT_LAYOUT }))}>
            {t('Reset')}
          </Button>
        ) : undefined
      }
    >
      {canMirror && (
        <label className="flex items-center gap-2 text-xs font-medium text-ink">
          <input
            type="checkbox"
            checked={layout.mirror}
            onChange={(e) => update((d) => void (d.layout.mirror = e.target.checked))}
            className="size-4 accent-accent"
          />
          {t('Mirror: text on the other side')}
        </label>
      )}
      <div>
          <p className="mb-1 text-xs font-medium text-muted">{t('Text position')}</p>
        <Segmented<TextPosition>
          label={t('Text position')}
          value={layout.textPosition}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
          ]}
          onChange={(v) => update((d) => void (d.layout.textPosition = v))}
        />
      </div>
      <div>
          <p className="mb-1 text-xs font-medium text-muted">{t('Text alignment')}</p>
        <Segmented<TextAlign>
          label={t('Text alignment')}
          value={layout.textAlign}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(v) => update((d) => void (d.layout.textAlign = v))}
        />
      </div>
      {canTilt && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">{t('Screens')}</p>
          <Segmented<Tilt>
            label={t('Screens')}
            value={layout.tilt}
            options={[
              { value: 'none', label: 'Straight' },
              { value: 'tilt', label: 'Tilted' },
              { value: 'perspective', label: '3D' },
            ]}
            onChange={(v) => update((d) => void (d.layout.tilt = v))}
          />
        </div>
      )}
      <p className="text-[11px] text-muted">
        {t('Auto keeps the template’s own layout. Bottom puts the text under the screens; beside them, Top and Bottom align it to that edge. Shared by every format and carousel page.')}
      </p>
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
      <Section title={t('Image')}>
        <p className="text-xs text-muted">{t('Select a screenshot in the Images tab to adjust its crop and focal point.')}</p>
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
      title={t('Image {n}', { n: index + 1 })}
      action={
        <div className="flex">
          <Button size="sm" variant="ghost" className="px-1.5" onClick={() => duplicateScreenshot(shot.id)} aria-label={t('Duplicate screenshot')} title={t('Duplicate (Ctrl/Cmd+D)')}>
            <Icon name="copy" className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="px-1.5 text-danger" onClick={() => removeScreenshot(shot.id)} aria-label={t('Remove screenshot')} title={t('Remove (Delete)')}>
            <Icon name="trash" className="size-3.5" />
          </Button>
        </div>
      }
    >
      {index >= max && <p className="rounded-md bg-warn-soft px-2 py-1.5 text-xs text-warn-ink">{t('This template shows {max} screenshot(s); this one is hidden.', { max })}</p>}
      <Field label={t('Carousel caption')} hint={`${(shot.caption ?? '').length}/${LIMITS.caption}`}>
        <input
          value={shot.caption ?? ''}
          maxLength={LIMITS.caption}
          name="caption"
          autoComplete="off"
          placeholder={t('e.g. Every environment at a glance…')}
          onChange={(e) => set('caption', e.target.value.replace(/\n/g, ' ').slice(0, LIMITS.caption), `caption-${shot.id}`)}
          className={inputCls}
        />
      </Field>
      {(template === 'annotated' || (shot.legend?.length ?? 0) > 0) && (
        <LegendField key={shot.id} legend={shot.legend ?? []} onChange={(legend) => set('legend', legend, `legend-${shot.id}`)} />
      )}
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
      <RedactPicker
        key={`redact-${shot.id}`}
        url={urls[shot.assetId]}
        asset={assets?.find((a) => a.id === shot.assetId)}
        areas={shot.redact ?? []}
        onChange={(areas) => set('redact', areas)}
      />
      <Segmented
        label={t('Fit')}
        value={shot.fit}
        options={[
          { value: 'cover', label: 'Cover' },
          { value: 'contain', label: 'Contain' },
        ]}
        onChange={(v) => set('fit', v)}
      />
      <Slider
        label={t('Zoom')}
        min={ZOOM_RANGE.min}
        max={ZOOM_RANGE.max}
        step={0.05}
        value={shot.zoom}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(v) => set('zoom', v, `zoom-${shot.id}`)}
      />
      <fieldset className="space-y-2">
        <legend className="flex w-full items-center justify-between text-xs font-medium text-muted">
          {t('Crop')}
          {cropped && (
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => set('crop', { ...NO_CROP })}>
              {t('Reset Crop')}
            </Button>
          )}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
            <Slider
              key={edge}
              label={t(`Crop ${edge}`)}
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
        <Slider label={t('Focal X')} min={0} max={1} step={0.01} value={shot.focalX} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('focalX', v, `focal-${shot.id}`)} />
        <Slider label={t('Focal Y')} min={0} max={1} step={0.01} value={shot.focalY} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('focalY', v, `focal-${shot.id}`)} />
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
      <legend className="mb-1 text-xs font-medium text-muted">{t('Devices')}</legend>
      <div className="flex gap-1.5">
        {DEVICE_KINDS.map((d) => {
          const on = devices.includes(d);
          return (
            <label
              key={d}
              className={cx(
                'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium ring-1 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
                on ? 'bg-accent-soft text-accent-deep ring-accent-line' : 'bg-surface text-ink-soft ring-line hover:bg-panel',
              )}
            >
              <input type="checkbox" className="sr-only" checked={on} disabled={on && atMin} onChange={() => toggle(d)} />
              {t(DEVICE_LABELS[d])}
            </label>
          );
        })}
      </div>
      {(['tablet', 'mobile'] as const)
        .filter((d) => devices.includes(d))
        .map((d) => (
          <div key={d} className="mt-2 flex items-center gap-2">
            <span className="w-14 flex-none text-xs text-muted">{t(DEVICE_LABELS[d])}</span>
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
      <p className="mt-1 text-[11px] text-muted">
        {t('Pick {min} or 3. Screenshots fill the devices in order: {list}.', {
          min: MIN_DEVICES,
          list: devices.map((d) => t(DEVICE_LABELS[d]).toLowerCase()).join(', '),
        })}
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
      <p className="mb-1 text-xs font-medium text-muted">{t('Focal point')}</p>
      <div className="checker flex justify-center rounded-lg p-1">
        <div
          ref={ref}
          role="slider"
          tabIndex={0}
          aria-label={t('Focal point')}
          aria-valuetext={t('{x}% horizontal, {y}% vertical', { x: Math.round(x * 100), y: Math.round(y * 100) })}
          onKeyDown={nudge}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove={(e) => e.buttons === 1 && pick(e)}
          className="relative cursor-crosshair touch-none select-none overflow-hidden focus-visible:outline-2 focus-visible:outline-accent"
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
              className="pointer-events-none absolute border border-surface/80"
              style={{
                left: `${crop.left * 100}%`,
                top: `${crop.top * 100}%`,
                width: `${cw * 100}%`,
                height: `${ch * 100}%`,
                boxShadow: '0 0 0 9999px var(--color-crop-dim)',
              }}
            />
          )}
          <span
            className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent/60 shadow-[0_0_0_1px_var(--color-handle-edge)]"
            style={{ left: `${(crop.left + x * cw) * 100}%`, top: `${(crop.top + y * ch) * 100}%` }}
          />
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted">{t('This area stays visible when the layout changes between formats.')}</p>
    </div>
  );
}

/**
 * Hide sensitive areas (names, e-mails, ids): drag a box on the screenshot, or add one and drag it
 * into place. The bars are drawn in every image; the original screenshot is not changed.
 */
function RedactPicker({
  url,
  asset,
  areas,
  onChange,
}: {
  url?: string;
  asset?: { width: number; height: number };
  areas: Area[];
  onChange: (areas: Area[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const full = areas.length >= MAX_REDACTIONS;
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const toArea = (d: NonNullable<typeof draft>) =>
    clampArea({ x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) });
  const shown = draft ? toArea(draft) : null;
  if (!url) return null;
  return (
    <fieldset className="space-y-1.5">
      <legend className="flex w-full items-center justify-between text-xs font-medium text-muted">
        {t('Hide sensitive areas')}
        {areas.length > 0 && (
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => onChange([])}>
            {t('Clear')}
          </Button>
        )}
      </legend>
      <div className="checker flex justify-center rounded-lg p-1">
        <div
          ref={ref}
          data-testid="redact-area"
          aria-label={t('Drag over the screenshot to hide an area')}
          onPointerDown={(e) => {
            if (full) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = at(e);
            setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
          }}
          onPointerMove={(e) => {
            if (!draft) return;
            const p = at(e);
            setDraft({ ...draft, x1: p.x, y1: p.y });
          }}
          onPointerUp={() => {
            const a = draft && toArea(draft);
            setDraft(null);
            // Ignore clicks: an area needs a little width and height.
            if (a && a.w > 0.01 && a.h > 0.01) onChange([...areas, a]);
          }}
          className={cx('relative touch-none select-none overflow-hidden', full ? 'cursor-not-allowed' : 'cursor-crosshair')}
        >
          {asset && asset.width > 0 && asset.height > 0 ? (
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
          )}
          {[...areas, ...(shown ? [shown] : [])].map((a, i) => (
            <span
              key={i}
              className={cx('pointer-events-none absolute rounded-[2px]', i === areas.length ? 'bg-[#2a2e38]/50 ring-1 ring-surface' : 'bg-[#2a2e38]')}
              style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
            />
          ))}
        </div>
      </div>
      {areas.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {areas.map((_, i) => (
            <li key={i}>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[11px]"
                aria-label={t('Show area {n} again', { n: i + 1 })}
                onClick={() => onChange(areas.filter((_, j) => j !== i))}
              >
                {t('Area {n}', { n: i + 1 })} <Icon name="x" className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted">
        {t('Drag over names, e-mail addresses or ids to cover them in every exported image. The original screenshot is kept in the project and in its project.json backup.')}
      </p>
    </fieldset>
  );
}

function Suggestions() {
  const project = useEditor((s) => s.project);
  const active = useEditor((s) => s.activeFormat);
  const { update } = useEditor.getState();
  const list = useMemo(() => (project ? analyzeProject(project, resolveFormat(active, project.customFormat)) : []), [project, active]);
  return (
    <Section title={t('Suggestions ({n})', { n: list.length })}>
      {list.length === 0 ? (
        <p className="text-xs text-ok">{t('Looks good for this format.')}</p>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li
              key={s.id}
              className={cx('rounded-md px-2.5 py-2 text-xs', s.level === 'warning' ? 'bg-warn-soft text-warn-ink' : 'bg-surface text-ink-soft ring-1 ring-line')}
            >
              {tMessage(s)}
              {s.action?.template && (
                <button
                  type="button"
                  className="ml-1 font-medium text-accent-deep underline underline-offset-2"
                  onClick={() => update((d) => void (d.template = s.action!.template!))}
                >
                  {t('Use {name}', { name: t(getTemplate(s.action.template).name) })}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-faint">{t('Checks run locally and never block export.')}</p>
    </Section>
  );
}
