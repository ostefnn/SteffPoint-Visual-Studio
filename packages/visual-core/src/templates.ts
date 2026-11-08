/** Declarative template descriptions. The rendering lives in the web app. */

export type TemplateId =
  | 'browser-hero'
  | 'device-mix'
  | 'app-store'
  | 'testimonial'
  | 'stats'
  | 'event'
  | 'features'
  | 'code'
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
  | 'announcement'
  | 'documentation'
  | 'social-proof'
  | 'event'
  | 'minimal';

/** Devices the Device Mix template can show, always drawn in this order (back to front). */
export type DeviceKind = 'desktop' | 'tablet' | 'mobile';
export const DEVICE_KINDS: readonly DeviceKind[] = ['desktop', 'tablet', 'mobile'];
export const DEVICE_LABELS: Record<DeviceKind, string> = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
/** How desktop screenshots are framed: a browser, a bare macOS window, no chrome at all, or a laptop. */
export type DesktopFrame = 'browser' | 'window' | 'plain' | 'laptop';
export const DESKTOP_FRAMES: readonly DesktopFrame[] = ['browser', 'window', 'plain', 'laptop'];
/** Templates that draw desktop screenshots in a desktop frame. */
export const DESKTOP_FRAME_TEMPLATES: readonly TemplateId[] = ['browser-hero', 'browser-duo', 'device-mix', 'app-store'];

/** Tablet and phone frames can be held upright or turned sideways. */
export type DeviceOrientation = 'portrait' | 'landscape';
export type RotatableDevice = Exclude<DeviceKind, 'desktop'>;

/** Device Mix needs at least this many devices; with fewer, a dedicated template fits better. */
export const MIN_DEVICES = 2;

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
    id: 'device-mix',
    name: 'Device Mix',
    category: 'app-showcase',
    description: 'Pick two or three devices (desktop, tablet, mobile) to show your app on every screen.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 2, max: 3 } },
  },
  {
    id: 'app-store',
    name: 'App Store',
    category: 'mobile',
    description: 'Store screenshots: a big caption over a device that bleeds off the bottom.',
    shotKind: 'any',
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
    id: 'testimonial',
    name: 'Testimonial',
    category: 'social-proof',
    description: 'A customer quote with their photo, name and role.',
    shotKind: 'any',
    slots: { title: false, subtitle: false, kicker: true, logo: true, screenshots: { min: 0, max: 1 } },
  },
  {
    id: 'stats',
    name: 'Key Figures',
    category: 'social-proof',
    description: 'Two to four big numbers with labels: users, ratings, time saved.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 0, max: 0 } },
  },
  {
    id: 'event',
    name: 'Event',
    category: 'event',
    description: 'Webinar, meetup or launch: date, time, place, speakers and a call to action.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 0, max: 3 } },
  },
  {
    id: 'features',
    name: 'Features',
    category: 'announcement',
    description: 'Headline plus up to four highlights. Ideal for “What’s new” and release notes.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 0, max: 0 } },
  },
  {
    id: 'code',
    name: 'Code',
    category: 'documentation',
    description: 'A code snippet in an editor window next to your headline.',
    shotKind: 'any',
    slots: { ...text, screenshots: { min: 0, max: 0 } },
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
  { id: 'announcement', label: 'Announcement' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'social-proof', label: 'Social Proof' },
  { id: 'event', label: 'Event' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'minimal', label: 'Minimal' },
];

export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function isTemplateId(id: unknown): id is TemplateId {
  return typeof id === 'string' && TEMPLATES.some((t) => t.id === id);
}
