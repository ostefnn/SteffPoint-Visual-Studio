import { FORMAT_ORDER, resolveFormat } from '@svs/visual-core';
import { useEditor } from '../store/editor';
import { cx } from './ui';
import { Stage } from './Stage';

import { t } from '../i18n';

/** Multi-format preview: the same composition in every ratio at once. */
export function FormatStrip() {
  const project = useEditor((s) => s.project);
  const urls = useEditor((s) => s.previewUrls); // small previews: reduced copies (lib/previews)
  const active = useEditor((s) => s.activeFormat);
  const { setActiveFormat, update } = useEditor.getState();
  if (!project) return null;

  return (
    <div className="border-t border-line bg-surface">
      <ul className="flex gap-3 overflow-x-auto px-4 py-3" aria-label={t('Formats')}>
        {FORMAT_ORDER.map((id) => {
          const f = resolveFormat(id, project.customFormat);
          const included = project.exportPresets.includes(id);
          return (
            <li key={id} className="flex-none">
              <button
                type="button"
                onClick={() => setActiveFormat(id)}
                aria-pressed={active === id}
                aria-label={t('Preview {format}', { format: t(f.label) })}
                className={cx(
                  'flex h-[76px] w-[124px] items-center justify-center rounded-lg bg-subtle ring-1 transition',
                  active === id ? 'ring-2 ring-accent' : 'ring-line hover:ring-field',
                )}
              >
                <Stage project={project} format={f} urls={urls} maxWidth={116} maxHeight={68} className="rounded-sm shadow-sm" />
              </button>
              <label className="mt-1.5 flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() =>
                    update((d) => {
                      d.exportPresets = included ? d.exportPresets.filter((x) => x !== id) : FORMAT_ORDER.filter((x) => x === id || d.exportPresets.includes(x));
                    })
                  }
                  aria-label={t('Include {format} in export', { format: t(f.label) })}
                />
                <span className={cx('truncate', active === id && 'font-medium')}>{t(f.label)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
