import { lazy, Suspense, useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { t, useLang } from './i18n';
import { HelpDialog } from './components/HelpDialog';
import { openHelp, useHelp } from './store/help';
import './theme';

// The editor (and the export engine it pulls in) loads on demand: the dashboard opens faster.
const loadEditor = () => import('./components/Editor');
const Editor = lazy(() => loadEditor().then((m) => ({ default: m.Editor })));

/** Minimal hash router: `#/` dashboard, `#/p/<id>` editor. Survives reloads. */
function parseHash(): string | null {
  const m = location.hash.match(/^#\/p\/([\w-]+)$/);
  return m ? m[1] : null;
}

export function App() {
  const [projectId, setProjectId] = useState<string | null>(parseHash);
  // Every component below re-renders in the new language (nothing is remounted).
  useLang();

  const helpOpen = useHelp((s) => s.open);

  // "?" opens the help anywhere, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openHelp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onHash = () => setProjectId(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openProject = (id: string) => {
    location.hash = `#/p/${id}`;
  };
  const goHome = () => {
    location.hash = '#/';
  };

  // On the dashboard, fetch the editor once the page is idle, so opening a project stays instant.
  useEffect(() => {
    if (projectId) return;
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
    idle(() => void loadEditor());
  }, [projectId]);

  return (
    <>
      {projectId ? (
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted">{t('Loading project…')}</div>}>
          <Editor key={projectId} projectId={projectId} onExit={goHome} />
        </Suspense>
      ) : (
        <Dashboard onOpen={openProject} />
      )}
      {helpOpen && <HelpDialog />}
    </>
  );
}
