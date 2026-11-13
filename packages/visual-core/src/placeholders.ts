/**
 * Example texts that new projects start with. They ask for real content and must never be
 * published as is: the rules flag them and the automatic carousel skips pages made only of them.
 *
 * The list is in English. The app adds the French and Dutch translations at start-up with
 * `addPlaceholderTexts`, so a project created in any interface language is recognised.
 */
import type { Content, Project } from './project';
import { getTemplate } from './templates';

/** Every example text of `createProject`, in English. */
export const PLACEHOLDER_TEXTS: readonly string[] = [
  'Name of your product',
  'One sentence on what it does for the people who use it.',
  'First thing people can do',
  'Second thing people can do',
  'Third thing people can do',
  'Replace with a short snippet from your product.',
  'Paste a real quote from someone who uses your product.',
  'Their name',
  'Their role, their company',
  'Replace with a real figure',
  'Date',
  'Start to end time',
  'Place or link',
  'First step',
  'What people do first, in one short sentence.',
  'Second step',
  'What happens next.',
  'Third step',
  'The result they get.',
  'Replace with a real criterion',
  'Your product',
];

/** The example value of a key figure. */
const PLACEHOLDER_FIGURE = '00';

const known = new Set(PLACEHOLDER_TEXTS);

/** Recognise more example texts, e.g. their translations. */
export function addPlaceholderTexts(texts: Iterable<string>): void {
  for (const s of texts) if (s.trim()) known.add(s.trim());
}

/** True when the text is one of the example texts (in any registered language). */
export function isPlaceholder(text: string): boolean {
  return known.has(text.trim());
}

/** A field of the content, named as in the Content panel. */
export type PlaceholderField =
  | 'Title'
  | 'Subtitle'
  | 'Features'
  | 'Quote'
  | 'Name'
  | 'Role'
  | 'Key Figures'
  | 'Event'
  | 'Steps'
  | 'Comparison'
  | 'Code';

/** True when the code still holds the example comment line. */
function codeIsPlaceholder(code: string): boolean {
  return code.split('\n').some((line) => {
    const m = /^\s*\/\/\s*(.+)$/.exec(line);
    return !!m && isPlaceholder(m[1]);
  });
}

/**
 * Fields drawn by the project's template that still contain an example text.
 * Fields the template does not draw are ignored: they never reach an image.
 */
export function placeholderFields(project: Pick<Project, 'template' | 'content'>): PlaceholderField[] {
  const c: Content = project.content;
  const tpl = getTemplate(project.template);
  const out: PlaceholderField[] = [];
  if (tpl.slots.title && isPlaceholder(c.title)) out.push('Title');
  if (tpl.slots.subtitle && isPlaceholder(c.subtitle)) out.push('Subtitle');
  switch (tpl.id) {
    case 'features':
      if (c.features.some((f) => isPlaceholder(f))) out.push('Features');
      break;
    case 'testimonial':
      if (isPlaceholder(c.quote)) out.push('Quote');
      if (isPlaceholder(c.author)) out.push('Name');
      if (isPlaceholder(c.authorRole)) out.push('Role');
      break;
    case 'stats':
      if (c.stats.some((s) => s.value.trim() === PLACEHOLDER_FIGURE || isPlaceholder(s.label))) out.push('Key Figures');
      break;
    case 'event':
      if ([c.eventDate, c.eventTime, c.eventPlace].some((s) => isPlaceholder(s))) out.push('Event');
      break;
    case 'steps':
      if (c.steps.some((s) => isPlaceholder(s.title) || isPlaceholder(s.text))) out.push('Steps');
      break;
    case 'comparison':
      if (c.compare.rows.some((r) => isPlaceholder(r.label)) || c.compare.columns.some((x) => isPlaceholder(x))) out.push('Comparison');
      break;
    case 'code':
      if (codeIsPlaceholder(c.code)) out.push('Code');
      break;
  }
  return out;
}

/** True when the feature list holds at least one real (non-example) item. */
export function hasRealFeatures(c: Pick<Content, 'features'>): boolean {
  return c.features.some((f) => f.trim() && !isPlaceholder(f));
}
