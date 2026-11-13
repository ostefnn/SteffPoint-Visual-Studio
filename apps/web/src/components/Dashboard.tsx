import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createProject,
  createScreenshotSlot,
  FORMAT_ORDER,
  FORMAT_PRESETS,
  LIMITS,
  STYLE_IDS,
  STYLES,
  TEMPLATES,
  uid,
  withStyle,
  type Project,
  applyBrandKit,
  type BrandKit,
  type StyleId,
  type TemplateCategory,
  type TemplateId,
} from '@svs/visual-core';
import { copyBlobs, createProjectRecord, deleteProject, getThumbnail, listBrandKits, listProjects, patchProject } from '../lib/db';
import { getDefaultKitId, setDefaultKitId, withBrandKit } from '../lib/brandKits';
import { buildProjectFile, importProjectFile } from '../lib/projectFile';
import { importLegendBundle } from '../lib/legendImport';
import { notify } from '../store/toasts';
import { downloadBlob, slugify } from '../lib/download';
import { Button, cx, Icon, inputCls, useObjectUrl } from './ui';
import { Stage } from './Stage';
import { PrivacyBadge } from './PrivacyBadge';
import { StorageStatus } from './StorageStatus';

import { getLang, LANGS, localizeContent, setLang, t, type Lang } from '../i18n';
import { openHelp } from '../store/help';

/**
 * Gallery previews show real material, never invented proof: screenshots of SteffPoint Visual
 * Studio itself (public/samples). Desktop frames get desktop screenshots; iPhones and iPads get
 * real phone and tablet screens, captured on a mobile viewport by scripts/capture-samples.mjs.
 */
const sample = (file: string) => `${import.meta.env.BASE_URL}samples/${file}`;
const SAMPLE_ASSETS = [
  { id: 'sample-editor', name: 'editor.jpg', width: 1600, height: 1000 },
  { id: 'sample-dashboard', name: 'dashboard.jpg', width: 1600, height: 1000 },
  { id: 'sample-phone-1', name: 'phone-1.jpg', width: 780, height: 1624 },
  { id: 'sample-phone-2', name: 'phone-2.jpg', width: 780, height: 1624 },
  { id: 'sample-phone-3', name: 'phone-3.jpg', width: 780, height: 1624 },
  { id: 'sample-tablet', name: 'tablet.jpg', width: 1536, height: 2048 },
] as const;
type SampleId = (typeof SAMPLE_ASSETS)[number]['id'];
const SAMPLE_URLS: Record<string, string> = Object.fromEntries(SAMPLE_ASSETS.map((a) => [a.id, sample(a.name)]));
const SAMPLE: Project = (() => {
  const p = createProject();
  p.content = { ...p.content, title: 'SteffPoint Visual Studio', subtitle: 'Screenshots in, launch visuals for every format out.' };
  p.assets = SAMPLE_ASSETS.map((a) => ({ ...a, mime: 'image/jpeg', size: 0 }));
  return p;
})();
const shot = (id: SampleId) => ({ ...createScreenshotSlot(id), id: `shot-${id}` });
/** Which screenshot goes in which slot: each template's slots in order, matched to the device it draws. */
const SHOTS_FOR: Partial<Record<TemplateId, SampleId[]>> = {
  // Device Mix draws desktop, tablet, phone, in that order.
  'device-mix': ['sample-editor', 'sample-tablet', 'sample-phone-1'],
  'mobile-trio': ['sample-phone-1', 'sample-phone-2', 'sample-phone-3'],
  'app-store': ['sample-phone-1', 'sample-phone-2', 'sample-phone-3'],
};
const DESKTOP_SHOTS: SampleId[] = ['sample-editor', 'sample-dashboard', 'sample-phone-1'];
/** The editor's own panels, as they appear in the editor screenshot. */
const SAMPLE_LEGEND = [
  { label: 'Images', prop: '', off: false },
  { label: 'Template and style', prop: '', off: false },
  { label: 'Preview', prop: '', off: false },
  { label: 'Content', prop: '', off: false },
];
/**
 * Gallery-only content for the templates that take no screenshot: real facts about this app,
 * counted from the code so they never go stale, and real code from its core package.
 * Projects created from a card keep the neutral placeholders.
 */
const SAMPLE_CONTENT: Partial<Record<TemplateId, Partial<Project['content']>>> = {
  stats: {
    stats: [
      { value: String(TEMPLATES.length), label: 'templates' },
      { value: String(FORMAT_ORDER.filter((f) => f !== 'custom').length), label: 'export formats' },
      { value: String(STYLE_IDS.length), label: 'styles' },
      { value: '0', label: 'images uploaded' },
    ],
  },
  features: {
    features: ['Brand colour picked from your logo', 'Every style compared side by side', 'LinkedIn carousel as a PDF', 'Nothing leaves your device'],
  },
  steps: {
    steps: [
      { title: 'Add your screenshots', text: 'Drop, paste or pick up to 12 images.' },
      { title: 'Pick a template', text: 'Then a style and your brand colour.' },
      { title: 'Export every format', text: 'One ZIP, or a LinkedIn carousel PDF.' },
    ],
  },
  comparison: {
    compare: {
      columns: ['One by one', 'This app'],
      rows: [
        { label: 'Formats per export', cells: ['1', String(FORMAT_ORDER.filter((f) => f !== 'custom').length)] },
        { label: 'Brand colour from your logo', cells: ['no', 'yes'] },
        { label: 'LinkedIn carousel PDF', cells: ['no', 'yes'] },
      ],
    },
  },
  cta: {
    // The app's own public address, from the README.
    cta: 'Open the app',
    link: 'https://ostefnn.github.io/SteffPoint-Visual-Studio/',
    qr: true,
  },
  code: {
    codeFile: 'brand.ts',
    code: [
      "import { derivePalette, extractLogoColors } from '@svs/visual-core';",
      '',
      '// The brand colour, sampled from the logo.',
      'const [brand] = extractLogoColors(pixels);',
      "const palette = derivePalette(brand.hex, 'light', 'bold');",
    ].join('\n'),
  },
};

/** Real App Store listing captions: one claim per screen, taken from the app's own features. */
const STORE_CAPTIONS = ['Every format at once', 'Your brand, from your logo', 'Nothing leaves your device'];

function sampleFor(template: TemplateId, style: StyleId, kit?: BrandKit): Project {
  const content = localizeContent({ ...SAMPLE.content, ...SAMPLE_CONTENT[template] });
  const styled = withStyle({ ...SAMPLE, content }, style);
  // With a brand kit, previews wear it (without its logo, which is not loaded here).
  const base = kit ? { ...applyBrandKit(styled, kit, null), content: styled.content } : styled;
  // Magnify the style list of the editor screenshot rather than its top edge.
  if (template === 'detail-zoom') return { ...base, template, screenshots: [{ ...shot('sample-editor'), focalX: 0.17, focalY: 0.42 }] };
  if (template === 'annotated') return { ...base, template, screenshots: [{ ...shot('sample-editor'), legend: SAMPLE_LEGEND }] };
  return { ...base, template, screenshots: (SHOTS_FOR[template] ?? DESKTOP_SHOTS).map(shot) };
}

const CARD = { width: 264, height: 138 };

/**
 * A template card's picture. App Store is shown as what it makes: a row of portrait iPhone
 * screens with one caption each, as in a store listing. The others draw in LinkedIn landscape.
 */
function TemplatePreview({ template, style, kit }: { template: TemplateId; style: StyleId; kit?: BrandKit }) {
  const project = sampleFor(template, style, kit);
  if (template === 'app-store') {
    const iphone = FORMAT_PRESETS['appstore-iphone'];
    return (
      <div className="flex w-full items-center justify-center gap-2 bg-subtle" style={{ height: CARD.height }}>
        {STORE_CAPTIONS.map((title, i) => (
          <Stage
            key={title}
            project={{ ...project, content: { ...project.content, title: t(title), subtitle: '' }, screenshots: [project.screenshots[i % project.screenshots.length]] }}
            format={iphone}
            urls={SAMPLE_URLS}
            maxWidth={CARD.width}
            maxHeight={CARD.height - 12}
            className="rounded-sm shadow-sm"
          />
        ))}
      </div>
    );
  }
  return <Stage project={project} format={FORMAT_PRESETS.linkedin} urls={SAMPLE_URLS} maxWidth={CARD.width} maxHeight={CARD.height} className="w-full" />;
}

/** Four filters instead of one per category: most categories hold one or two templates. */
const GALLERY_GROUPS: { id: 'all' | 'screens' | 'words' | 'proof'; label: string; categories: TemplateCategory[] }[] = [
  { id: 'all', label: 'All', categories: [] },
  { id: 'screens', label: 'Screenshots', categories: ['app-showcase', 'browser', 'mobile', 'product', 'before-after'] },
  { id: 'words', label: 'Text and announcements', categories: ['announcement', 'documentation', 'editorial', 'minimal'] },
  { id: 'proof', label: 'Quotes, figures and events', categories: ['social-proof', 'event'] },
];

export function Dashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [category, setCategory] = useState<(typeof GALLERY_GROUPS)[number]['id']>('all');
  // The gallery previews every template in one style; a card opens in that same style.
  const [galleryStyle, setGalleryStyle] = useState<StyleId>(() => createProject().brand.style);
  const [error, setError] = useState<string | null>(null);
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [kitId, setKitId] = useState<string | null>(getDefaultKitId);
  const kit = kits.find((k) => k.id === kitId);
  const fileInput = useRef<HTMLInputElement>(null);
  const legendInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const refresh = () => listProjects().then(setProjects).catch((e) => setError(String(e)));
  useEffect(() => {
    refresh();
    listBrandKits().then(setKits).catch(() => setKits([]));
  }, []);

  const create = async (template: TemplateId = 'browser-hero') => {
    const fresh = createProject({ template, name: t('Untitled {date}', { date: new Date().toLocaleDateString(getLang()) }) });
    fresh.content = localizeContent(fresh.content);
    const p = kit ? await withBrandKit(fresh, kit) : withStyle(fresh, galleryStyle);
    await createProjectRecord(p);
    onOpen(p.id);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter(
      (p) => (!favOnly || p.favorite) && (!q || p.name.toLowerCase().includes(q) || p.content.title.toLowerCase().includes(q)),
    );
  }, [projects, query, favOnly]);

  const actions = {
    rename: async (p: Project, raw: string) => {
      const name = raw.trim().slice(0, 80);
      if (!name || name === p.name) return;
      await patchProject(p.id, { name });
      refresh();
    },
    duplicate: async (p: Project) => {
      const copy: Project = { ...structuredClone(p), id: uid('prj'), name: `${p.name} (copy)`, favorite: false, createdAt: Date.now(), updatedAt: Date.now() };
      await copyBlobs(p.id, copy.id);
      await createProjectRecord(copy);
      refresh();
    },
    remove: async (p: Project) => {
      if (!confirm(t('Delete “{name}”? This cannot be undone.', { name: p.name }))) return;
      await deleteProject(p.id);
      refresh();
    },
    favorite: async (p: Project) => {
      await patchProject(p.id, { favorite: !p.favorite }, false);
      refresh();
    },
    exportJson: async (p: Project) => {
      downloadBlob(await buildProjectFile(p), `${slugify(p.name)}.svs.json`);
    },
  };

  const onImport = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    try {
      const p = await importProjectFile(file);
      onOpen(p.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onImportLegend = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setImporting(true);
    try {
      const { project, missing, skipped } = await importLegendBundle([...files]);
      const pages = project.screenshots.length;
      notify(pages > 1 ? t('{n} annotated pages created from the legend.', { n: pages }) : t('One annotated page created from the legend.'));
      if (missing.length) notify(t('Not selected, so left out: {list}.', { list: missing.join(', ') }), 'error');
      if (skipped) notify(t('{n} more section(s) left out: a project holds {max} images.', { n: skipped, max: LIMITS.screenshots }), 'error');
      onOpen(project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
      if (legendInput.current) legendInput.current.value = '';
    }
  };

  const group = GALLERY_GROUPS.find((g) => g.id === category) ?? GALLERY_GROUPS[0];
  const templates = TEMPLATES.filter((t) => group.id === 'all' || group.categories.includes(t.category));

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">{t('SteffPoint Visual Studio')}</h1>
            <p className="text-xs text-muted">{t('Create once. Publish everywhere.')}</p>
          </div>
          <PrivacyBadge />
          <Button variant="ghost" onClick={openHelp} aria-label={t('Help')} title={t('Help (?)')}>
            <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-field">?</span>
          </Button>
          <select
            value={getLang()}
            onChange={(e) => setLang(e.target.value as Lang)}
            aria-label={t('Language')}
            title={LANGS.find((l) => l.id === getLang())?.label}
            className={cx(inputCls, 'h-9 py-0 text-sm text-ink')}
            style={{ width: 'auto' }}
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id} title={l.label}>
                {l.id.toUpperCase()}
              </option>
            ))}
          </select>
          <Button onClick={() => fileInput.current?.click()}>
            <Icon name="upload" />{' '}{t('Import Project')}
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files)} />
          <MoreMenu>
            <button
              type="button"
              role="menuitem"
              onClick={() => legendInput.current?.click()}
              disabled={importing}
              className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none disabled:opacity-50"
            >
              <Icon name="image" className="mt-0.5 size-4 flex-none" />
              <span>
                <span className="block font-medium">{importing ? t('Importing…') : t('Import Legend')}</span>
                <span className="block text-xs text-muted">{t('Select a legend file (.md) and the screenshots it describes: one annotated page per section')}</span>
              </span>
            </button>
          </MoreMenu>
          <input
            ref={legendInput}
            type="file"
            multiple
            aria-label={t('Legend file and screenshots')}
            accept=".md,.markdown,text/markdown,image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => onImportLegend(e.target.files)}
          />
          <Button variant="primary" onClick={() => create()}>
            <Icon name="plus" />{' '}{t('New Project')}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        {error && (
          <div role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger ring-1 ring-danger-line">
            {error}
          </div>
        )}

        <StorageStatus projectCount={projects?.length ?? 0} />

        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-base font-semibold">{t('Projects')}</h2>
            <div className="relative">
              <Icon name="search" className="absolute left-2.5 top-2.5 size-4 text-faint" />
              <input
                type="search"
                name="q"
                autoComplete="off"
                placeholder={t('Search projects…')}
                aria-label={t('Search projects')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={cx(inputCls, 'w-56 pl-8')}
              />
            </div>
            <Button variant={favOnly ? 'primary' : 'secondary'} onClick={() => setFavOnly((v) => !v)} aria-pressed={favOnly}>
              <Icon name="star" filled={favOnly} />{' '}{t('Favorites')}
            </Button>
          </div>

          {projects === null ? (
            <p className="text-sm text-muted">{t('Loading…')}</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-field bg-surface px-6 py-12 text-center">
              <p className="font-medium">{projects.length ? t('No project matches your search.') : t('No projects yet.')}</p>
              {!projects.length && (
                <>
                  <p className="mt-1 text-sm text-muted">{t('Start from a template below or create a blank project. Everything stays on this device.')}</p>
                  <Button variant="primary" className="mt-4" onClick={() => create()}>
                    <Icon name="plus" />{' '}{t('New Project')}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} actions={actions} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-3 text-base font-semibold">{t('Start from a Template')}</h2>
            {GALLERY_GROUPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={cx(
                  'h-8 rounded-full px-3 text-xs font-medium ring-1 transition-transform duration-100 ease-out motion-safe:active:scale-[0.97]',
                  category === c.id ? 'bg-inverse text-on-inverse ring-inverse' : 'bg-surface text-ink-soft ring-line hover:bg-panel',
                )}
              >
                {t(c.label)}
              </button>
            ))}
            {kits.length > 0 && (
              <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted sm:ml-auto">
                {t('Brand kit')}
                <select
                  value={kit?.id ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setKitId(id);
                    setDefaultKitId(id);
                  }}
                  className={cx(inputCls, 'h-8 w-40 py-0 text-xs text-ink')}
                >
                  <option value="">{t('None')}</option>
                  {kits.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={cx('flex items-center gap-2 whitespace-nowrap text-xs text-muted', kits.length === 0 && 'sm:ml-auto')}>
              {t('Preview style')}
              <select
                value={kit ? kit.brand.style : galleryStyle}
                disabled={!!kit}
                title={kit ? t('The brand kit sets the style') : undefined}
                onChange={(e) => setGalleryStyle(e.target.value as StyleId)}
                className={cx(inputCls, 'h-8 w-36 py-0 text-xs text-ink')}
              >
                {STYLE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(STYLES[id].name)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((tpl) => (
              <li key={tpl.id}>
                <button
                  type="button"
                  onClick={() => create(tpl.id)}
                  className="group block w-full overflow-hidden rounded-xl bg-surface text-left ring-1 ring-line transition hover:ring-2 hover:ring-accent"
                >
                  <TemplatePreview template={tpl.id} style={galleryStyle} kit={kit} />
                  <div className="p-3">
                    <p className="text-sm font-medium">{t(tpl.name)}</p>
                    <p className="mt-0.5 text-xs text-muted">{t(tpl.description)}</p>
                  </div>
                </button>
                {tpl.id === 'annotated' && (
                  <button
                    type="button"
                    onClick={() => legendInput.current?.click()}
                    disabled={importing}
                    className="mt-1.5 px-1 text-xs font-medium text-accent-deep underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {t('Or start from a legend file (.md and its screenshots)')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

type Actions = Record<'duplicate' | 'remove' | 'favorite' | 'exportJson', (p: Project) => void> & {
  rename: (p: Project, name: string) => void;
};

function ProjectCard({ project, onOpen, actions }: { project: Project; onOpen: () => void; actions: Actions }) {
  const [thumb, setThumb] = useState<Blob>();
  useEffect(() => {
    getThumbnail(project.id).then(setThumb);
  }, [project.id, project.updatedAt]);
  const url = useObjectUrl(thumb);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const renameBtn = useRef<HTMLButtonElement>(null);
  const done = useRef(false); // guards against blur firing after Enter/Esc already finished

  const startRename = () => {
    setDraft(project.name);
    done.current = false;
    setEditing(true);
  };
  // Enter / blur commit, Esc cancels; an empty name keeps the current one.
  const finishRename = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    if (save && draft.trim()) actions.rename(project, draft);
    requestAnimationFrame(() => renameBtn.current?.focus());
  };

  return (
    <li className="group overflow-hidden rounded-xl bg-surface ring-1 ring-line">
      <button type="button" onClick={onOpen} className="block aspect-[1200/627] w-full overflow-hidden bg-subtle" aria-label={t('Open {name}', { name: project.name })}>
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-faint">
            <Icon name="image" className="size-8" />
          </span>
        )}
      </button>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              aria-label={t('Project name')}
              name="project-name"
              autoComplete="off"
              maxLength={80}
              value={draft}
              aria-invalid={!draft.trim()}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => finishRename(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (draft.trim()) finishRename(true);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  finishRename(false);
                }
              }}
              className={cx(inputCls, 'py-0.5 font-medium', !draft.trim() && 'ring-danger-line focus:ring-danger')}
            />
          ) : (
            <p className="truncate text-sm font-medium">{project.name}</p>
          )}
          <p className="text-xs text-muted">{t('Edited {date}', { date: new Date(project.updatedAt).toLocaleString(getLang()) })}</p>
        </div>
        <button
          type="button"
          onClick={() => actions.favorite(project)}
          className={cx('rounded p-1', project.favorite ? 'text-warn' : 'text-faint hover:text-ink-soft')}
          aria-label={project.favorite ? t('Remove from favorites') : t('Add to favorites')}
          aria-pressed={project.favorite}
        >
          <Icon name="star" filled={project.favorite} />
        </button>
      </div>
      <div className="flex gap-1 border-t border-line px-2 py-1.5">
        <Button ref={renameBtn} size="sm" variant="ghost" onClick={startRename} aria-label={t('Rename {name}', { name: project.name })}>
          <Icon name="edit" className="size-3.5" />{' '}{t('Rename')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.duplicate(project)}>
          <Icon name="copy" className="size-3.5" />{' '}{t('Duplicate')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.exportJson(project)} title={t('Export as JSON (images included)')}>
          <Icon name="download" className="size-3.5" />{' '}{t('JSON')}
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto text-danger hover:bg-danger-soft" onClick={() => actions.remove(project)} aria-label={t('Delete project')}>
          <Icon name="trash" className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

/** Secondary dashboard actions, kept out of the header so the main ones stand out. */
function MoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    root.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <Button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {t('More')}{' '}<span aria-hidden="true">▾</span>
      </Button>
      {open && (
        <div
          role="menu"
          aria-label={t('More')}
          onClick={() => setOpen(false)}
          className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg bg-surface p-1 shadow-xl ring-1 ring-line"
        >
          {children}
        </div>
      )}
    </div>
  );
}
