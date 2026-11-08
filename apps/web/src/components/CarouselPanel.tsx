/**
 * Carousel tab: the pages of the LinkedIn carousel PDF.
 * Automatic mode derives pages from the project; "Customize" turns them into editable
 * variants (own template, optional own text, own screenshot selection), which can be
 * added, duplicated, reordered (buttons, drag & drop, Alt+↑/↓) and removed.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  analyzeCarousel,
  autoCarouselVariants,
  buildCarouselSlides,
  CAROUSEL_FORMAT,
  CAROUSEL_MAX_SLIDES,
  createVariant,
  LIMITS,
  OVERRIDABLE_CONTENT,
  resolveFormat,
  TEMPLATES,
  uid,
  type TemplateId,
  type Variant,
} from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { Button, cx, Field, Icon, inputCls, Section } from './ui';
import { Stage } from './Stage';

const FORMAT = resolveFormat(CAROUSEL_FORMAT);
const TEXT_LABEL = { kicker: 'Kicker', title: 'Title', subtitle: 'Subtitle' } as const;
const TEXT_LIMIT = { kicker: LIMITS.kicker, title: LIMITS.title, subtitle: LIMITS.subtitle } as const;

export function CarouselPanel() {
  const project = useEditor((s) => s.project)!;
  const urls = useEditor((s) => s.urls);
  const page = useEditor((s) => s.carouselPage);
  const { update, setCarouselPage } = useEditor.getState();
  const slides = useMemo(() => buildCarouselSlides(project), [project]);
  const advice = useMemo(() => analyzeCarousel(project), [project]);
  const custom = project.carousel.slides.length > 0;
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  // Opening the tab shows the carousel on the canvas; leaving it shows the project again.
  useEffect(() => {
    setCarouselPage(0);
    return () => setCarouselPage(null);
  }, [setCarouselPage]);
  // Keep the selection valid when pages are removed.
  useEffect(() => {
    if (page !== null && page >= slides.length) setCarouselPage(Math.max(0, slides.length - 1));
  }, [page, slides.length, setCarouselPage]);

  const active = page ?? 0;
  const editSlides = (fn: (list: Variant[]) => Variant[], key?: string) =>
    update((d) => void (d.carousel.slides = fn(d.carousel.slides).slice(0, CAROUSEL_MAX_SLIDES)), key);

  const move = (from: number, to: number) => {
    if (!custom || to < 0 || to >= slides.length || from === to) return;
    editSlides((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setCarouselPage(to);
  };

  const customize = () => update((d) => void (d.carousel.slides = autoCarouselVariants(d)));
  const resetToAuto = () => {
    if (!confirm('Replace your custom pages with the automatic ones? You can undo this.')) return;
    update((d) => void (d.carousel.slides = []));
    setCarouselPage(0);
  };
  const addPage = () => {
    // A closing page by default: the most common missing piece of a carousel.
    editSlides((list) => [...list, createVariant({ template: 'minimal', screenshotIds: [] })]);
    setCarouselPage(slides.length);
  };
  const duplicate = (i: number) => {
    editSlides((list) => [...list.slice(0, i + 1), { ...structuredClone(list[i]), id: uid('var') }, ...list.slice(i + 1)]);
    setCarouselPage(i + 1);
  };
  const remove = (i: number) => {
    editSlides((list) => list.filter((_, j) => j !== i));
    setCarouselPage(Math.max(0, Math.min(i, slides.length - 2)));
  };

  return (
    <>
      <Section title={`Pages ${slides.length}/${CAROUSEL_MAX_SLIDES}`}>
        <p className="text-xs text-zinc-600">
          {custom
            ? 'Custom pages. Brand, background and images stay shared with the project.'
            : 'Automatic pages: cover, one page per screenshot (titled with its caption), then your features.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {custom ? (
            <>
              <Button size="sm" onClick={addPage} disabled={slides.length >= CAROUSEL_MAX_SLIDES}>
                <Icon name="plus" className="size-3.5" /> Add Page
              </Button>
              <Button size="sm" variant="ghost" onClick={resetToAuto}>
                Reset to Automatic
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" onClick={customize}>
              Customize Pages
            </Button>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={project.carousel.pageNumbers}
            onChange={(e) => update((d) => void (d.carousel.pageNumbers = e.target.checked))}
          />
          Page numbers (“2 / 5”) in the kicker
        </label>
        <ol className="space-y-2" aria-label="Carousel pages">
          {slides.map((s, i) => (
            <li
              key={s.variant.id}
              draggable={custom}
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (dragFrom !== null) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, i);
                setDragFrom(null);
              }}
              onDragEnd={() => setDragFrom(null)}
              className={cx(
                'flex items-center gap-2 rounded-lg bg-white p-1.5 ring-1',
                active === i ? 'ring-2 ring-blue-600' : 'ring-zinc-200',
                dragFrom === i && 'opacity-50',
              )}
            >
              <button
                type="button"
                aria-current={active === i ? 'true' : undefined}
                aria-label={`Page ${i + 1}: ${s.label}`}
                title={custom ? 'Alt+↑ / Alt+↓ to reorder' : undefined}
                onClick={() => setCarouselPage(i)}
                onKeyDown={(e) => {
                  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                  e.preventDefault();
                  move(i, i + (e.key === 'ArrowUp' ? -1 : 1));
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Stage project={s.project} format={FORMAT} urls={urls} maxWidth={44} maxHeight={55} className="flex-none rounded-sm ring-1 ring-black/5" />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-xs font-medium break-words">
                    {i + 1}. {s.label}
                  </span>
                  {TEMPLATES.find((t) => t.id === s.variant.template)?.name !== s.label && (
                    <span className="block text-[11px] text-zinc-500">{TEMPLATES.find((t) => t.id === s.variant.template)?.name}</span>
                  )}
                </span>
              </button>
              {custom && (
                <div className="flex flex-none flex-col">
                  <Button size="sm" variant="ghost" className="h-6 px-1" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move page ${i + 1} up`}>
                    <Icon name="left" className="size-3.5 rotate-90" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1"
                    disabled={i === slides.length - 1}
                    onClick={() => move(i, i + 1)}
                    aria-label={`Move page ${i + 1} down`}
                  >
                    <Icon name="right" className="size-3.5 rotate-90" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      </Section>

      {custom && slides[active] ? (
        <PageEditor
          index={active}
          variant={slides[active].variant}
          canAdd={slides.length < CAROUSEL_MAX_SLIDES}
          canRemove={slides.length > 1}
          onDuplicate={() => duplicate(active)}
          onRemove={() => remove(active)}
        />
      ) : null}
      {!custom && (
        <Section title="Edit a page">
          <p className="text-xs text-zinc-500">Click “Customize Pages” to choose each page’s template, text and screenshots.</p>
        </Section>
      )}

      <Section title={`Carousel advice (${advice.length})`}>
        {advice.length === 0 ? (
          <p className="text-xs text-emerald-700">Looks good.</p>
        ) : (
          <ul className="space-y-2">
            {advice.map((a) => (
              <li
                key={a.id}
                className={cx('rounded-md px-2.5 py-2 text-xs', a.level === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-white text-zinc-700 ring-1 ring-zinc-200')}
              >
                {a.message}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function PageEditor({
  index,
  variant,
  canAdd,
  canRemove,
  onDuplicate,
  onRemove,
}: {
  index: number;
  variant: Variant;
  canAdd: boolean;
  canRemove: boolean;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const project = useEditor((s) => s.project)!;
  const urls = useEditor((s) => s.urls);
  const { update } = useEditor.getState();

  const edit = (fn: (v: Variant) => void, key?: string) =>
    update((d) => {
      const v = d.carousel.slides.find((x) => x.id === variant.id);
      if (v) fn(v);
    }, key);

  const allShots = variant.screenshotIds === null;
  const chosen = new Set(variant.screenshotIds ?? project.screenshots.map((s) => s.id));

  return (
    <Section
      title={`Page ${index + 1}`}
      action={
        <div className="flex">
          <Button size="sm" variant="ghost" className="px-1.5" disabled={!canAdd} onClick={onDuplicate} aria-label={`Duplicate page ${index + 1}`}>
            <Icon name="copy" className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="px-1.5 text-red-600" disabled={!canRemove} onClick={onRemove} aria-label={`Delete page ${index + 1}`}>
            <Icon name="trash" className="size-3.5" />
          </Button>
        </div>
      }
    >
      <Field label="Template">
        <select
          value={variant.template}
          onChange={(e) => edit((v) => void (v.template = e.target.value as TemplateId))}
          className={cx(inputCls, 'bg-white text-zinc-900')}
        >
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      {OVERRIDABLE_CONTENT.map((k) => {
        const own = typeof variant.content[k] === 'string';
        const value = own ? variant.content[k]! : project.content[k];
        return (
          <fieldset key={k} className="space-y-1">
            <legend className="flex w-full items-center justify-between text-xs font-medium text-zinc-600">
              {TEXT_LABEL[k]}
              <label className="flex items-center gap-1.5 font-normal text-zinc-500">
                <input
                  type="checkbox"
                  aria-label={`Page ${index + 1} ${TEXT_LABEL[k].toLowerCase()}: same as project`}
                  checked={!own}
                  onChange={(e) =>
                    edit((v) => {
                      if (e.target.checked) delete v.content[k];
                      else v.content[k] = project.content[k];
                    })
                  }
                />
                Same as project
              </label>
            </legend>
            {k === 'kicker' ? (
              <input
                aria-label={`Page ${index + 1} ${k}`}
                value={value}
                disabled={!own}
                maxLength={TEXT_LIMIT[k]}
                onChange={(e) => edit((v) => void (v.content[k] = e.target.value), `page-${variant.id}-${k}`)}
                className={cx(inputCls, !own && 'bg-zinc-100 text-zinc-500')}
              />
            ) : (
              <textarea
                aria-label={`Page ${index + 1} ${k}`}
                value={value}
                disabled={!own}
                rows={k === 'title' ? 2 : 3}
                maxLength={TEXT_LIMIT[k]}
                onChange={(e) => edit((v) => void (v.content[k] = e.target.value), `page-${variant.id}-${k}`)}
                className={cx(inputCls, 'resize-y', !own && 'bg-zinc-100 text-zinc-500')}
              />
            )}
          </fieldset>
        );
      })}

      {project.screenshots.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="flex w-full items-center justify-between text-xs font-medium text-zinc-600">
            Screenshots
            <label className="flex items-center gap-1.5 font-normal text-zinc-500">
              <input
                type="checkbox"
                aria-label={`Page ${index + 1} screenshots: same as project`}
                checked={allShots}
                onChange={(e) => edit((v) => void (v.screenshotIds = e.target.checked ? null : project.screenshots.map((s) => s.id)))}
              />
              Same as project
            </label>
          </legend>
          {!allShots && (
            <ul className="grid grid-cols-4 gap-1.5">
              {project.screenshots.map((s, i) => (
                <li key={s.id}>
                  <label className={cx('block cursor-pointer rounded-md p-0.5 ring-1', chosen.has(s.id) ? 'ring-2 ring-blue-600' : 'ring-zinc-200 opacity-60')}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={chosen.has(s.id)}
                      aria-label={`Show screenshot ${i + 1} on page ${index + 1}`}
                      onChange={(e) =>
                        edit((v) => {
                          const set = new Set(v.screenshotIds ?? []);
                          if (e.target.checked) set.add(s.id);
                          else set.delete(s.id);
                          // Keep the project's screenshot order.
                          v.screenshotIds = project.screenshots.map((x) => x.id).filter((id) => set.has(id));
                        })
                      }
                    />
                    <span className="checker block aspect-[4/3] overflow-hidden rounded">
                      {urls[s.assetId] && <img src={urls[s.assetId]} alt="" className="size-full object-cover" />}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}
      <p className="text-[11px] text-zinc-500">
        Template content such as features, code, figures or quotes is shared with the project and edited in the Content panel.
      </p>
    </Section>
  );
}
