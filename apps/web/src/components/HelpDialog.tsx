/**
 * Help: how the app works in five steps, the keyboard shortcuts, where the data lives, and the
 * display settings (language, theme). Opened with the "?" button or the ? key.
 */
import { useEffect, useRef } from 'react';
import { getLang, LANGS, setLang, t, type Lang } from '../i18n';
import { setThemePref, useThemePref, type ThemePref } from '../theme';
import { closeHelp } from '../store/help';
import { Button, cx, Icon, inputCls, Segmented } from './ui';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: [`${MOD}+Z`], action: 'Undo' },
  { keys: [`${MOD}+Shift+Z`, `${MOD}+Y`], action: 'Redo' },
  { keys: [`${MOD}+S`], action: 'Save now' },
  { keys: [`${MOD}+V`], action: 'Paste an image as a screenshot' },
  { keys: [`${MOD}+D`], action: 'Duplicate the selected screenshot' },
  { keys: ['Delete', 'Backspace'], action: 'Remove the selected screenshot' },
  { keys: ['Esc'], action: 'Leave a field, deselect, close a window' },
  { keys: ['← ↑ → ↓'], action: 'Move the focal point (Shift: larger steps)' },
  { keys: ['Alt+↑', 'Alt+↓'], action: 'Reorder carousel pages' },
  { keys: ['?'], action: 'Open this help' },
];

const STEPS = [
  'Add screenshots in the Images tab: click, drop them anywhere or paste them.',
  'Pick a template, then a style and your colour in the Brand tab.',
  'Write the title and the template’s fields in the Content panel; adjust the layout below it.',
  'Check every format in the strip under the preview and tick the ones to export.',
  'Click Export: one image, a ZIP of every format, or a LinkedIn carousel PDF.',
];

export function HelpDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const theme = useThemePref();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        closeHelp();
      }}
      className="m-auto w-[min(640px,calc(100vw-32px))] overscroll-contain rounded-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-[rgb(0_0_0/0.45)]"
      aria-labelledby="help-title"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="help-title" className="text-base font-semibold">
          {t('Help')}
        </h2>
        <Button variant="ghost" onClick={closeHelp} aria-label={t('Close')}>
          <Icon name="x" />
        </Button>
      </div>
      <div className="max-h-[75vh] space-y-6 overflow-y-auto px-5 py-4 text-sm">
        <section aria-labelledby="help-start">
          <h3 id="help-start" className="mb-2 font-semibold">
            {t('Get started')}
          </h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-ink-soft">
            {STEPS.map((s) => (
              <li key={s}>{t(s)}</li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="help-keys">
          <h3 id="help-keys" className="mb-2 font-semibold">
            {t('Keyboard shortcuts')}
          </h3>
          <table className="w-full text-left">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.action} className="border-t border-line first:border-t-0">
                  <td className="py-1.5 pr-3 align-top whitespace-nowrap">
                    {s.keys.map((k, i) => (
                      <span key={k}>
                        {i > 0 && <span className="px-1 text-faint">{t('or')}</span>}
                        <kbd className="rounded bg-subtle px-1.5 py-0.5 font-mono text-xs text-ink ring-1 ring-line">{k}</kbd>
                      </span>
                    ))}
                  </td>
                  <td className="py-1.5 text-ink-soft">{t(s.action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="help-data">
          <h3 id="help-data" className="mb-2 font-semibold">
            {t('Your data')}
          </h3>
          <p className="text-ink-soft">
            {t('Projects, images and exports stay in this browser: nothing is uploaded. Clearing the site data deletes them, so export important projects as JSON from the dashboard.')}
          </p>
        </section>

        <section aria-labelledby="help-display" className="space-y-3">
          <h3 id="help-display" className="font-semibold">
            {t('Display')}
          </h3>
          <label className="flex items-center justify-between gap-3">
            <span className="text-ink-soft">{t('Language')}</span>
            <select value={getLang()} onChange={(e) => setLang(e.target.value as Lang)} className={cx(inputCls, 'h-9 py-0 text-sm text-ink')} style={{ width: 'auto' }}>
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-soft">{t('Theme')}</span>
            <div className="w-64">
              <Segmented<ThemePref>
                label="Editor theme"
                value={theme}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                onChange={setThemePref}
              />
            </div>
          </div>
          <p className="text-xs text-muted">{t('The theme changes the editor only. Your visuals keep their own Light or Dark setting in the Brand tab.')}</p>
        </section>
      </div>
    </dialog>
  );
}
