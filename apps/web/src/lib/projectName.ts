/**
 * A new project is called "Untitled <date>" until its owner names it. Until then, its name
 * follows the title typed in the Content panel, so the project list reads like the visuals.
 */
import { isPlaceholder, LIMITS } from '@svs/visual-core';
import { fr } from '../i18n/fr';
import { nl } from '../i18n/nl';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "Untitled {date}" and "Untitled project", in every interface language. */
const UNTITLED: RegExp[] = ['Untitled {date}', 'Untitled project']
  .flatMap((k) => [k, fr[k], nl[k]])
  .filter((s): s is string => !!s)
  .map((s) => new RegExp(`^${escape(s).replace(escape('{date}'), '.+')}$`));

/** The project name a title gives: its first line, without extra spaces. */
export function nameFromTitle(title: string): string {
  return (title.split('\n')[0] ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);
}

/** True while the name was never chosen by the user: still untitled, or still copied from the title. */
export function nameFollowsTitle(name: string, previousTitle: string): boolean {
  const n = name.trim();
  return UNTITLED.some((re) => re.test(n)) || n === nameFromTitle(previousTitle);
}

/** The name to keep after the title changes from `previousTitle` to `title`. */
export function nameAfterTitleChange(name: string, previousTitle: string, title: string): string {
  if (!nameFollowsTitle(name, previousTitle)) return name;
  const next = nameFromTitle(title);
  return next && !isPlaceholder(title) ? next : name;
}
