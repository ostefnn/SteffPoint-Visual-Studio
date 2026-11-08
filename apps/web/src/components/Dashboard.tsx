import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createProject,
  FORMAT_PRESETS,
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  uid,
  type Project,
  type TemplateCategory,
  type TemplateId,
} from '@svs/visual-core';
import { copyBlobs, deleteProject, getThumbnail, listProjects, saveProject } from '../lib/db';
import { buildProjectFile, importProjectFile } from '../lib/projectFile';
import { downloadBlob, slugify } from '../lib/download';
import { Button, cx, Icon, inputCls, useObjectUrl } from './ui';
import { Stage } from './Stage';
import { PrivacyBadge } from './PrivacyBadge';

/** Project shown in the template gallery cards. */
const SAMPLE = createProject();

export function Dashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => listProjects().then(setProjects).catch((e) => setError(String(e)));
  useEffect(() => {
    refresh();
  }, []);

  const create = async (template: TemplateId = 'browser-hero') => {
    const p = createProject({ template, name: `Untitled ${new Date().toLocaleDateString()}` });
    await saveProject(p);
    onOpen(p.id);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter(
      (p) => (!favOnly || p.favorite) && (!q || p.name.toLowerCase().includes(q) || p.content.title.toLowerCase().includes(q)),
    );
  }, [projects, query, favOnly]);

  const actions = {
    rename: async (p: Project) => {
      const name = prompt('Project name', p.name)?.trim();
      if (!name) return;
      await saveProject({ ...p, name: name.slice(0, 80), updatedAt: Date.now() });
      refresh();
    },
    duplicate: async (p: Project) => {
      const copy: Project = { ...structuredClone(p), id: uid('prj'), name: `${p.name} (copy)`, favorite: false, createdAt: Date.now(), updatedAt: Date.now() };
      await copyBlobs(p.id, copy.id);
      await saveProject(copy);
      refresh();
    },
    remove: async (p: Project) => {
      if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
      await deleteProject(p.id);
      refresh();
    },
    favorite: async (p: Project) => {
      await saveProject({ ...p, favorite: !p.favorite });
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

  const templates = TEMPLATES.filter((t) => category === 'all' || t.category === category);

  return (
    <div className="min-h-full">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <img src="/favicon.svg" alt="" className="size-8" />
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">SteffPoint Visual Studio</h1>
            <p className="text-xs text-zinc-500">Create once. Publish everywhere.</p>
          </div>
          <PrivacyBadge />
          <Button onClick={() => fileInput.current?.click()}>
            <Icon name="upload" /> Import project
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files)} />
          <Button variant="primary" onClick={() => create()}>
            <Icon name="plus" /> New project
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-base font-semibold">Projects</h2>
            <div className="relative">
              <Icon name="search" className="absolute left-2.5 top-2.5 size-4 text-zinc-400" />
              <input
                type="search"
                placeholder="Search projects"
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
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
              <p className="font-medium">{projects.length ? 'No project matches your search.' : 'No projects yet.'}</p>
              {!projects.length && (
                <>
                  <p className="mt-1 text-sm text-zinc-500">Start from a template below or create a blank project. Everything stays on this device.</p>
                  <Button variant="primary" className="mt-4" onClick={() => create()}>
                    <Icon name="plus" /> New project
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
            <h2 className="mr-3 text-base font-semibold">Start from a template</h2>
            {[{ id: 'all' as const, label: 'All' }, ...TEMPLATE_CATEGORIES].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cx(
                  'rounded-full px-3 py-1 text-xs font-medium ring-1',
                  category === c.id ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50',
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
                  className="group block w-full overflow-hidden rounded-xl bg-white text-left ring-1 ring-zinc-200 transition hover:ring-2 hover:ring-blue-600"
                >
                  <Stage project={{ ...SAMPLE, template: t.id }} format={FORMAT_PRESETS.linkedin} urls={{}} maxWidth={264} maxHeight={138} className="w-full" />
                  <div className="p-3">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{t.description}</p>
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

type Actions = Record<'rename' | 'duplicate' | 'remove' | 'favorite' | 'exportJson', (p: Project) => void>;

function ProjectCard({ project, onOpen, actions }: { project: Project; onOpen: () => void; actions: Actions }) {
  const [thumb, setThumb] = useState<Blob>();
  useEffect(() => {
    getThumbnail(project.id).then(setThumb);
  }, [project.id, project.updatedAt]);
  const url = useObjectUrl(thumb);

  return (
    <li className="group overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
      <button type="button" onClick={onOpen} className="block aspect-[1200/627] w-full overflow-hidden bg-zinc-100" aria-label={`Open ${project.name}`}>
        {url ? (
          <img src={url} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <span className="flex size-full items-center justify-center text-zinc-400">
            <Icon name="image" className="size-8" />
          </span>
        )}
      </button>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="text-xs text-zinc-500">Edited {new Date(project.updatedAt).toLocaleString()}</p>
        </div>
        <button
          type="button"
          onClick={() => actions.favorite(project)}
          className={cx('rounded p-1', project.favorite ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-700')}
          aria-label={project.favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={project.favorite}
        >
          <Icon name="star" filled={project.favorite} />
        </button>
      </div>
      <div className="flex gap-1 border-t border-zinc-100 px-2 py-1.5">
        <Button size="sm" variant="ghost" onClick={() => actions.rename(project)}>
          <Icon name="edit" className="size-3.5" /> Rename
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.duplicate(project)}>
          <Icon name="copy" className="size-3.5" /> Duplicate
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.exportJson(project)} title="Export as JSON (images included)">
          <Icon name="download" className="size-3.5" /> JSON
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:bg-red-50" onClick={() => actions.remove(project)} aria-label="Delete project">
          <Icon name="trash" className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
