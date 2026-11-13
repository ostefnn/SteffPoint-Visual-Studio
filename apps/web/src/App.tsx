import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Editor } from './components/Editor';
import { useLang } from './i18n';

/** Minimal hash router: `#/` dashboard, `#/p/<id>` editor. Survives reloads. */
function parseHash(): string | null {
  const m = location.hash.match(/^#\/p\/([\w-]+)$/);
  return m ? m[1] : null;
}

export function App() {
  const [projectId, setProjectId] = useState<string | null>(parseHash);
  // Every component below re-renders in the new language (nothing is remounted).
  useLang();

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

  return projectId ? <Editor key={projectId} projectId={projectId} onExit={goHome} /> : <Dashboard onOpen={openProject} />;
}
