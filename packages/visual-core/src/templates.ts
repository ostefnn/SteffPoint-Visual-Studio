/** Declarative template descriptions. The rendering lives in the web app. */

export type TemplateId =
  | 'browser-hero'
  | 'browser-duo'
  | 'mobile-trio'
  | 'bento'
  | 'spotlight'
  | 'before-after'
  | 'editorial'
  | 'minimal';

export type TemplateCategory =
  | 'app-showcase'
  | 'browser'
  | 'mobile'
  | 'product'
  | 'before-after'
  | 'editorial'
  | 'minimal';

/** The kind of screenshot a template is designed for. */
export type ShotKind = 'desktop' | 'mobile' | 'any';

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  category: TemplateCategory;
  description: string;
  shotKind: ShotKind;
  slots: {
    title: boolean;
    subtitle: boolean;
    kicker: boolean;
    logo: boolean;
    screenshots: { min: number; max: number };
  };
}

const text = { title: true, subtitle: true, kicker: true, logo: true };

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'browser-hero',
    name: 'Browser Hero',
    category: 'browser',
    description: 'One screenshot in a browser window next to your headline.',
    shotKind: 'desktop',
    slots: { ...text, screenshots: { min: 1, max: 1 } },
  },
  {
    id: 'browser-duo',
    name: 'Browser Duo',
    category: 'browser',
    description: 'Two overlapping browser windows for a richer product view.',
    shotKind: 'desktop',
    slots: { ...text, screenshots: { min: 2, max: 2 } },
  },
  {
    id: 'mobile-trio',
    name: 'Mobile Trio',
    category: 'mobile',
    description: 'Up to three phone screens fanned out.',
    shotKind: 'mobile',
    slots: { ...text, screenshots: { min: 1, max: 3 } },
  },
  {
    id: 'bento',
    name: 'Bento',
    category: 'app-showcase',
    description: 'A grid of cards: your headline plus three screenshots.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 1, max: 3 } },
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    category: 'product',
    description: 'A single centred screenshot with a soft brand glow.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 1, max: 1 } },
  },
  {
    id: 'before-after',
    name: 'Before / After',
    category: 'before-after',
    description: 'Two screenshots side by side to show a transformation.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 2, max: 2 } },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    category: 'editorial',
    description: 'Large serif headline with a full-bleed image.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 0, max: 1 } },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    category: 'minimal',
    description: 'Typography and logo only. Ideal for announcements.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 0, max: 0 } },
  },
];

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'app-showcase', label: 'App Showcase' },
  { id: 'browser', label: 'Browser' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'product', label: 'Product' },
  { id: 'before-after', label: 'Before / After' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'minimal', label: 'Minimal' },
];

export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function isTemplateId(id: unknown): id is TemplateId {
  return typeof id === 'string' && TEMPLATES.some((t) => t.id === id);
}
