import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createProject,
  createScreenshotSlot,
  FORMAT_PRESETS,
  LIMITS,
  TEMPLATES,
  uid,
  type Project,
  type TemplateCategory,
  type TemplateId,
} from '@svs/visual-core';
import { copyBlobs, createProjectRecord, deleteProject, getThumbnail, listProjects, patchProject } from '../lib/db';
import { buildProjectFile, importProjectFile } from '../lib/projectFile';
import { importLegendBundle } from '../lib/legendImport';
import { notify } from '../store/toasts';
import { downloadBlob, slugify } from '../lib/download';
import { Button, cx, Icon, inputCls, useObjectUrl } from './ui';
import { Stage } from './Stage';
import { PrivacyBadge } from './PrivacyBadge';
import { StorageStatus } from './StorageStatus';

/** Project shown in the template gallery cards. */
/**
 * Gallery previews show real material: screenshots of SteffPoint Visual Studio itself
 * (public/samples), never invented proof. Phone-first templates get the phone shot first.
 */
const SAMPLE_URLS: Record<string, string> = {
  'sample-editor': `${import.meta.env.BASE_URL}samples/editor.jpg`,
  'sample-phone': `${import.meta.env.BASE_URL}samples/phone.jpg`,
  'sample-dashboard': `${import.meta.env.BASE_URL}samples/dashboard.jpg`,
};
const SAMPLE: Project = (() => {
  const p = createProject();
  p.content = { ...p.content, title: 'SteffPoint Visual Studio', subtitle: 'Screenshots in, launch visuals for every format out.' };
  p.assets = [
    { id: 'sample-editor', name: 'editor.jpg', mime: 'image/jpeg', width: 1600, height: 1000, size: 0 },
    { id: 'sample-phone', name: 'phone.jpg', mime: 'image/jpeg', width: 780, height: 1688, size: 0 },
    { id: 'sample-dashboard', name: 'dashboard.jpg', mime: 'image/jpeg', width: 1600, height: 1000, size: 0 },
  ];
  p.screenshots = p.assets.map((a) => ({ ...createScreenshotSlot(a.id), id: `shot-${a.id}` }));
  return p;
})();
const PHONE_FIRST: TemplateId[] = ['mobile-trio', 'app-store'];
/** The editor's own panels, as they appear in the editor screenshot. */
const SAMPLE_LEGEND = [
  { label: 'Images', prop: '', off: false },
  { label: 'Template and style', prop: '', off: false },
  { label: 'Preview', prop: '', off: false },
  { label: 'Content', prop: '', off: false },
];
function sampleFor(template: TemplateId): Project {
  if (template === 'annotated') return { ...SAMPLE, template, screenshots: [{ ...SAMPLE.screenshots[0], legend: SAMPLE_LEGEND }] };
  const shots = PHONE_FIRST.includes(template) ? [SAMPLE.screenshots[1], SAMPLE.screenshots[0], SAMPLE.screenshots[2]] : SAMPLE.screenshots;
  return { ...SAMPLE, template, screenshots: shots };
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
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const legendInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const refresh = () => listProjects().then(setProjects).catch((e) => setError(String(e)));
  useEffect(() => {
    refresh();
  }, []);

  const create = async (template: TemplateId = 'browser-hero') => {
    const p = createProject({ template, name: `Untitled ${new Date().toLocaleDateString()}` });
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
      if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
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
      notify(`${pages} annotated page${pages > 1 ? 's' : ''} created from the legend.`);
      if (missing.length) notify(`Not selected, so left out: ${missing.join(', ')}.`, 'error');
      if (skipped) notify(`${skipped} more section${skipped > 1 ? 's' : ''} left out: a project holds ${LIMITS.screenshots} images.`, 'error');
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
            <h1 className="text-lg font-semibold leading-tight">SteffPoint Visual Studio</h1>
            <p className="text-xs text-muted">Create once. Publish everywhere.</p>
          </div>
          <PrivacyBadge />
          <Button onClick={() => fileInput.current?.click()}>
            <Icon name="upload" /> Import Project
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files)} />
          <Button
            onClick={() => legendInput.current?.click()}
            disabled={importing}
            title="Select a legend file (.md) and the screenshots it describes: one annotated page per section"
          >
            <Icon name="image" /> {importing ? 'Importing…' : 'Import Legend'}
          </Button>
          <input
            ref={legendInput}
            type="file"
            multiple
            aria-label="Legend file and screenshots"
            accept=".md,.markdown,text/markdown,image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => onImportLegend(e.target.files)}
          />
          <Button variant="primary" onClick={() => create()}>
            <Icon name="plus" /> New Project
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
            <h2 className="mr-auto text-base font-semibold">Projects</h2>
            <div className="relative">
              <Icon name="search" className="absolute left-2.5 top-2.5 size-4 text-faint" />
              <input
                type="search"
                name="q"
                autoComplete="off"
                placeholder="Search projects…"
                aria-label="Search projects"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={cx(inputCls, 'w-56 pl-8')}
              />
            </div>
            <Button variant={favOnly ? 'primary' : 'secondary'} onClick={() => setFavOnly((v) => !v)} aria-pressed={favOnly}>
              <Icon name="star" filled={favOnly} /> Favorites
            </Button>
          </div>

          {projects === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-field bg-surface px-6 py-12 text-center">
              <p className="font-medium">{projects.length ? 'No project matches your search.' : 'No projects yet.'}</p>
              {!projects.length && (
                <>
                  <p className="mt-1 text-sm text-muted">Start from a template below or create a blank project. Everything stays on this device.</p>
                  <Button variant="primary" className="mt-4" onClick={() => create()}>
                    <Icon name="plus" /> New Project
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
            <h2 className="mr-3 text-base font-semibold">Start from a Template</h2>
            {GALLERY_GROUPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={cx(
                  'h-8 rounded-full px-3 text-xs font-medium ring-1 transition-transform duration-100 ease-out motion-safe:active:scale-[0.97]',
                  category === c.id ? 'bg-ink text-on-accent ring-ink' : 'bg-surface text-ink-soft ring-line hover:bg-panel',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => create(t.id)}
                  className="group block w-full overflow-hidden rounded-xl bg-surface text-left ring-1 ring-line transition hover:ring-2 hover:ring-accent"
                >
                  <Stage project={sampleFor(t.id)} format={FORMAT_PRESETS.linkedin} urls={SAMPLE_URLS} maxWidth={264} maxHeight={138} className="w-full" />
                  <div className="p-3">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{t.description}</p>
                  </div>
                </button>
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
      <button type="button" onClick={onOpen} className="block aspect-[1200/627] w-full overflow-hidden bg-subtle" aria-label={`Open ${project.name}`}>
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
              aria-label="Project name"
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
          <p className="text-xs text-muted">Edited {new Date(project.updatedAt).toLocaleString()}</p>
        </div>
        <button
          type="button"
          onClick={() => actions.favorite(project)}
          className={cx('rounded p-1', project.favorite ? 'text-warn' : 'text-faint hover:text-ink-soft')}
          aria-label={project.favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={project.favorite}
        >
          <Icon name="star" filled={project.favorite} />
        </button>
      </div>
      <div className="flex gap-1 border-t border-line px-2 py-1.5">
        <Button ref={renameBtn} size="sm" variant="ghost" onClick={startRename} aria-label={`Rename ${project.name}`}>
          <Icon name="edit" className="size-3.5" /> Rename
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.duplicate(project)}>
          <Icon name="copy" className="size-3.5" /> Duplicate
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.exportJson(project)} title="Export as JSON (images included)">
          <Icon name="download" className="size-3.5" /> JSON
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto text-danger hover:bg-danger-soft" onClick={() => actions.remove(project)} aria-label="Delete project">
          <Icon name="trash" className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
