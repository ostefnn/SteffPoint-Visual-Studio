/**
 * The visual renderer. Pure function of (project, size, asset URLs) → DOM.
 * Everything uses inline styles in pixels derived from the canvas size so the
 * exact same tree can be previewed (scaled with CSS) and exported (modern-screenshot).
 */
import { Children, cloneElement, Fragment, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import {
  BOLD_INK,
  BUNDLED_FONTS,
  getStyle,
  inkOn,
  type StyleSpec,
  backgroundPeak,
  CODE_LINE_HEIGHT,
  fitCodeFontSize,
  BODY_STACK,
  derivePalette,
  FONT_STACKS,
  getOrientation,
  getTemplate,
  DEFAULT_LAYOUT,
  MIRROR_TEMPLATES,
  TILT_TEMPLATES,
  kickerSize,
  logoHeight,
  mix,
  NO_CROP,
  normalizeDevices,
  shiftHue,
  subtitleSize,
  titleSize,
  withAlpha,
  type Orientation,
  type DeviceKind,
  type Palette,
  type LegendItem,
  compareMark,
  type Step,
  type Area,
  type LayoutSettings,
  type TemplateId,
  type Project,
  type ScreenshotSlot,
} from '@svs/visual-core';
import qrcode from 'qrcode-generator';
// The words drawn in a visual ("Swipe") follow the interface language, like the placeholder content.
import { t } from '../i18n';

/** Colours of the drawn device hardware: the token block for everything that is not brand-derived. */
const HW = {
  bezel: '#0d0f14',
  screenOff: '#2a2e38',
  lid: '#d9dce1',
  hinge: '#a3a8b0',
  onDark: '#ffffff',
  codeTab: '#c9cdd8',
  lidGradient: 'linear-gradient(#d9dce1, #b4b8bf 60%, #8e939b)',
  /** Bars that hide sensitive areas of a screenshot: opaque, so nothing can be recovered. */
  redact: '#2a2e38',
  /** Cover's veil over the photo. */
  veil: '8, 10, 14',
} as const;

interface Ctx {
  p: Project;
  w: number;
  h: number;
  /** 1% of the shortest side. */
  u: number;
  o: Orientation;
  /** Very wide formats such as banners. */
  wide: boolean;
  pal: Palette;
  urls: Record<string, string>;
  heading: string;
  /** Style preset in use (typefaces, kicker, frames, shadows). */
  style: StyleSpec;
  /** Outline of screenshots, cards and frames for the style. */
  edge: string;
  radius: number;
  shadow: string;
  /** Builds a box-shadow from soft layers. */
  softShadow: (layers: ShadowLayer[]) => string;
  shots: (ScreenshotSlot | undefined)[];
  /** Layout options in effect: mirror and tilt are off for templates that do not offer them. */
  layout: LayoutSettings;
  /** The text sits above (or below) the screens rather than beside them. */
  stacked: boolean;
  /** Stacked layout drawn upside down: the text goes to the other end. */
  flipY: boolean;
  /** The brand footer is drawn: the logo moves there from the text block. */
  footer: boolean;
}

interface ShadowLayer {
  y: number;
  blur: number;
  alpha: number;
}

/** Shadow of the small cards (figures, feature rows): a light lift, or Tint's mat at half width. */
function smallCardShadow(ctx: Ctx): string | undefined {
  if (ctx.shadow === 'none') return undefined;
  if (ctx.style.shadow === 'mat') return `0 0 0 ${ctx.u * 0.55}px ${ctx.pal.primarySoft}`;
  return boxShadow([{ y: ctx.u * 0.3, blur: ctx.u * 1.4, alpha: 0.04 + 0.08 * ctx.p.brand.shadow }]);
}

/** CSS box-shadow for soft layers. (WebKit exports replace it, see lib/flattenShadows.) */
function boxShadow(layers: ShadowLayer[]): string {
  return layers.map((l) => `0 ${l.y}px ${l.blur}px rgba(0,0,0,${l.alpha})`).join(', ');
}

export interface CompositionProps {
  project: Project;
  width: number;
  height: number;
  urls: Record<string, string>;
  /** Draw the template inside these insets only (see FormatPreset.content); the background fills everything. */
  content?: { top: number; right: number; bottom: number; left: number };
}

export function Composition({ project, width: canvasW, height: canvasH, urls, content }: CompositionProps) {
  const box = content
    ? {
        left: canvasW * content.left,
        top: canvasH * content.top,
        width: canvasW * (1 - content.left - content.right),
        height: canvasH * (1 - content.top - content.bottom),
      }
    : { left: 0, top: 0, width: canvasW, height: canvasH };
  const width = box.width;
  const fullHeight = box.height;
  const spec = getStyle(project.brand.style);
  const pal = derivePalette(project.brand.primary, project.brand.theme, spec.id);
  const footer = footerContent(project, urls);
  // The footer gets its own band, so templates (and frames that bleed off the bottom) stop above it.
  const footerH = footer ? Math.round((Math.min(width, fullHeight) / 100) * (width / fullHeight > 2.2 ? 9 : 7)) : 0;
  const height = fullHeight - footerH;
  const u = Math.min(width, height) / 100;
  const s = project.brand.shadow;
  const dark = project.brand.theme === 'dark';
  const ctx: Ctx = {
    p: project,
    w: width,
    h: height,
    u,
    o: getOrientation(width, height),
    wide: width / height > 2.2,
    pal,
    urls,
    heading: spec.heading ?? FONT_STACKS[project.brand.headingFont],
    style: spec,
    edge:
      spec.edge === 'none'
        ? 'none'
        : spec.edge === 'thick'
          ? `${Math.max(2, u * 0.45)}px solid ${BOLD_INK}`
          : `${Math.max(1, u * 0.12)}px solid ${pal.border}`,
    radius: u * (0.4 + project.brand.radius * 3.6) * spec.radiusScale,
    shadow:
      spec.shadow === 'none'
        ? 'none'
        : spec.shadow === 'mat'
          ? // A flat passe-partout: a solid spread ring, no blur, no offset.
            `0 0 0 ${u * 1.1}px ${pal.primarySoft}`
          : spec.shadow === 'hard'
          ? `${u * 1.1}px ${u * 1.1}px 0 ${BOLD_INK}`
          : s <= 0.01
        ? 'none'
        : boxShadow([
            { y: u * 0.4, blur: u * 1.2, alpha: (dark ? 0.25 : 0.06) + 0.1 * s },
            { y: u * 2, blur: u * 6, alpha: (dark ? 0.3 : 0.08) + 0.28 * s },
          ]),
    softShadow: boxShadow,
    shots: project.screenshots.slice(0, 4),
    layout: DEFAULT_LAYOUT,
    stacked: false,
    flipY: false,
    footer: !!footer,
  };
  const id = getTemplate(project.template).id;
  const layout = project.layout ?? DEFAULT_LAYOUT;
  ctx.layout = {
    ...layout,
    mirror: layout.mirror && MIRROR_TEMPLATES.includes(id),
    tilt: TILT_TEMPLATES.includes(id) ? layout.tilt : 'none',
  };
  ctx.stacked = isStacked(id, ctx.o, ctx.wide);
  ctx.flipY = ctx.stacked && layout.textPosition !== 'auto' && layout.textPosition !== NATURAL_TEXT_POSITION(id);
  const Template = TEMPLATE_COMPONENTS[id];
  return (
    <div
      style={{
        width: canvasW,
        height: canvasH,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: spec.body ?? BODY_STACK,
        color: pal.text,
        ...backgroundStyle({ ...ctx, w: canvasW, h: canvasH, u: Math.min(canvasW, canvasH) / 100 }),
      }}
    >
      <div data-content="" style={{ position: 'absolute', left: box.left, top: box.top, width, height: fullHeight }}>
        {footer ? (
          <>
            <div style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}>{arrange(Template(ctx), ctx)}</div>
            <Footer ctx={ctx} band={footerH} {...footer} />
          </>
        ) : (
          arrange(Template(ctx), ctx)
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

function backgroundStyle({ p, pal, u, style, urls }: Ctx): CSSProperties {
  if (style.brandBackground) return { background: pal.bg };
  const { type, intensity: i, angle, secondary, imageAssetId } = p.background;
  const peak = backgroundPeak(pal, type, i, secondary);
  // The second colour, when chosen, replaces the derived accent.
  const second = secondary ?? pal.accent;
  switch (type) {
    case 'solid':
      return { background: pal.bg };
    case 'image': {
      const url = imageAssetId ? urls[imageAssetId] : undefined;
      if (!url) return { background: pal.bg };
      // A veil of the ground colour keeps text readable; Intensity sets how much of the photo shows.
      const veil = withAlpha(pal.bg, 0.9 - 0.75 * i);
      return {
        backgroundColor: pal.bg,
        backgroundImage: `linear-gradient(${veil}, ${veil}), url("${url}")`,
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center',
      };
    }
    case 'gradient':
      return {
        background: secondary
          ? `linear-gradient(${angle}deg, ${mix(pal.bg, pal.primary, 0.08 + 0.3 * i)} 0%, ${peak} 100%)`
          : `linear-gradient(${angle}deg, ${pal.bg} 0%, ${pal.bg} 25%, ${peak} 100%)`,
      };
    case 'glow':
      return {
        background: [
          `radial-gradient(ellipse 55% 65% at 88% 12%, ${withAlpha(pal.primary, 0.1 + 0.32 * i)}, transparent 70%)`,
          `radial-gradient(ellipse 45% 55% at 8% 100%, ${withAlpha(second, (secondary ? 0.1 : 0.06) + 0.24 * i)}, transparent 70%)`,
          pal.bg,
        ].join(', '),
      };
    case 'grid': {
      if (style.crispGrid) {
        // Technical: a drafting grid, lines you can see, and no halo.
        const line = withAlpha(pal.text, 0.07 + 0.08 * i);
        const g = u * 5;
        return {
          backgroundColor: pal.bg,
          backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
          backgroundSize: `${g}px ${g}px, ${g}px ${g}px`,
        };
      }
      const line = withAlpha(pal.text, 0.03 + 0.06 * i);
      const g = u * 6;
      return {
        backgroundColor: pal.bg,
        backgroundImage: `radial-gradient(ellipse 70% 60% at 50% 0%, ${withAlpha(pal.primary, 0.08 + 0.15 * i)}, transparent 70%), linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `100% 100%, ${g}px ${g}px, ${g}px ${g}px`,
      };
    }
    case 'mesh':
      return {
        background: [
          `radial-gradient(ellipse 60% 70% at 0% 0%, ${withAlpha(pal.primary, 0.15 + 0.35 * i)}, transparent 65%)`,
          `radial-gradient(ellipse 60% 70% at 100% 20%, ${withAlpha(second, 0.12 + 0.3 * i)}, transparent 65%)`,
          `radial-gradient(ellipse 70% 60% at 50% 110%, ${withAlpha(secondary ? mix(pal.primary, secondary, 0.5) : shiftHue(pal.primary, -35), 0.12 + 0.3 * i)}, transparent 65%)`,
          pal.bg,
        ].join(', '),
      };
  }
}

// ---------------------------------------------------------------------------
// Brand footer
// ---------------------------------------------------------------------------

/** What the brand footer shows, or null when it is off or has nothing to show. */
function footerContent(p: Project, urls: Record<string, string>) {
  if (!p.brand.footer) return null;
  const logo = p.brand.logoAssetId && urls[p.brand.logoAssetId] ? urls[p.brand.logoAssetId] : null;
  const link = p.content.link.trim();
  const page = p.carouselPage;
  const swipe = !!page && page.index < page.total - 1;
  return logo || link || swipe ? { logo, link, swipe } : null;
}

/** A quiet line along the bottom edge: logo and link on the left, "Swipe" on carousel pages. */
function Footer({ ctx, band, logo, link, swipe }: { ctx: Ctx; band: number; logo: string | null; link: string; swipe: boolean }) {
  const { w, pal } = ctx;
  const fs = band * 0.3;
  const side = w * (ctx.wide ? 0.04 : 0.06);
  return (
    <div
      data-footer=""
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: band,
        boxSizing: 'border-box',
        padding: `0 ${side}px ${band * 0.18}px`,
        display: 'flex',
        alignItems: 'center',
        gap: fs,
        fontSize: fs,
        fontWeight: 550,
        color: pal.textMuted,
      }}
    >
      {logo && <img src={logo} alt="" draggable={false} style={{ height: band * 0.42, width: 'auto', maxWidth: band * 2.6, objectFit: 'contain', display: 'block' }} />}
      {link && <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</span>}
      {swipe && (
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: fs * 0.4, color: pal.text, whiteSpace: 'nowrap' }}>
          {t('Swipe')}
          <svg aria-hidden="true" viewBox="0 0 24 24" width={fs * 1.2} height={fs * 1.2} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout options: mirror, text position, tilt
// ---------------------------------------------------------------------------

/** Whether a template puts its text above the screens (true) or beside them, in this format. */
function isStacked(id: TemplateId, o: Orientation, wide: boolean): boolean {
  switch (id) {
    case 'app-store':
      return true;
    case 'spotlight':
    case 'before-after':
      return !wide;
    case 'minimal':
    case 'testimonial':
    case 'cta': // places its text itself
    case 'cover':
      return false; // text only: the position aligns the text block instead
    default:
      return o !== 'landscape' && !wide;
  }
}

/** Where the text sits in a template's own stacked layout. */
const NATURAL_TEXT_POSITION = (id: TemplateId) => (id === 'editorial' ? 'bottom' : 'top');

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Mirror a box left to right inside a canvas `w` wide. */
function mirrorX<T extends CSSProperties>(st: T, w: number): T {
  const { left: L, right: R, width: W } = st;
  if (isNum(L) && isNum(W)) return { ...st, left: w - L - W };
  if (isNum(L) && isNum(R)) return { ...st, left: R, right: L };
  if (isNum(L)) {
    const { left: _l, ...rest } = st;
    return { ...rest, right: L } as T;
  }
  if (isNum(R)) {
    const { right: _r, ...rest } = st;
    return { ...rest, left: R } as T;
  }
  return st;
}

/**
 * Mirror a box top to bottom. A frame that bled off the bottom edge would bleed off the top and
 * lose its title bar, so it is shortened to start inside the canvas instead; phones and tablets keep
 * their proportions and bleed (their height cannot change without distorting them).
 */
function mirrorY<T extends CSSProperties>(st: T, ctx: Ctx, keepRatio: boolean): T {
  const { h } = ctx;
  const { top: T, bottom: B, height: H } = st;
  if (isNum(T) && isNum(H)) {
    let top = h - T - H;
    let height = H;
    const margin = h * (ctx.o === 'portrait' ? 0.08 : 0.05);
    if (!keepRatio && top < margin && T + H > h) {
      height = H - (margin - top);
      top = margin;
    }
    return { ...st, top, height };
  }
  if (isNum(T) && isNum(B)) return { ...st, top: B, bottom: T };
  if (isNum(T)) {
    // Boxes centred on `top` with translateY(-50%) keep their centre mirrored.
    if (String(st.transform ?? '').includes('translateY(-50%)')) return { ...st, top: h - T };
    const { top: _t, ...rest } = st;
    return { ...rest, bottom: T } as T;
  }
  if (isNum(B)) {
    const { bottom: _b, ...rest } = st;
    return { ...rest, top: B } as T;
  }
  return st;
}

type Rect = { left: number; top: number; width: number; height: number };

/** The rectangle a positioned child occupies, when its geometry is known in pixels. */
function rectOf(st: CSSProperties | undefined): Rect | null {
  if (!st || !isNum(st.left) || !isNum(st.top) || !isNum(st.width) || !isNum(st.height)) return null;
  return { left: st.left, top: st.top, width: st.width, height: st.height };
}

/** Transform of the tilted screens. They lean toward the text, so mirroring turns them the other way. */
function tiltTransform(ctx: Ctx): string {
  const s = ctx.layout.mirror ? -1 : 1;
  if (ctx.layout.tilt === 'tilt') return `rotate(${-3.5 * s}deg)`;
  const p = Math.max(ctx.w, ctx.h) * 1.8;
  return ctx.stacked
    ? `perspective(${p}px) rotateX(${ctx.flipY ? -14 : 14}deg) rotateY(${-6 * s}deg) scale(0.96)`
    : // The near edge grows in perspective: scale down a little so it stays on the canvas.
      `perspective(${p}px) rotateY(${-20 * s}deg) rotateX(6deg) scale(0.94)`;
}

/** Vertical extent of a positioned box, when known in pixels. */
function extentY(st: CSSProperties, h: number): { top: number; bottom: number } | null {
  if (!isNum(st.top) || String(st.transform ?? '').includes('translate')) return null;
  if (isNum(st.height)) return { top: st.top, bottom: st.top + st.height };
  if (isNum(st.bottom)) return { top: st.top, bottom: h - st.bottom };
  return null;
}

/**
 * Apply the layout options to a template's output, without touching the template:
 * - Mirror: every top-level box is mirrored left to right. Content inside a box is never mirrored.
 * - Text at the other end of a stacked layout: the text boxes are mirrored top to bottom, and the
 *   screens move as one block into the space the text left, so overlapping devices keep their order.
 * - Tilt: the screens turn as one group, toward the text.
 */
function arrange(node: ReactNode, ctx: Ctx): ReactNode {
  const { mirror, tilt } = ctx.layout;
  if (!mirror && !ctx.flipY && tilt === 'none') return node;
  const { h } = ctx;
  const list = isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment ? Children.toArray(node.props.children) : Children.toArray(node);

  type Item = { el: ReactElement<Record<string, unknown>>; key: 'style' | 'box'; geo: CSSProperties; text: boolean; keepRatio: boolean };
  const items: (Item | ReactNode)[] = list.map((child) => {
    if (!isValidElement<{ style?: CSSProperties; box?: Rect }>(child)) return child;
    const key = child.type === CodeWindow ? 'box' : 'style';
    let geo = { ...((child.props[key] ?? {}) as CSSProperties) };
    if (mirror) geo = mirrorX(geo, ctx.w);
    return {
      el: child as ReactElement<Record<string, unknown>>,
      key,
      geo,
      text: child.type === TextBlock,
      keepRatio: child.type === PhoneFrame || child.type === TabletFrame,
    } satisfies Item;
  });
  const isItem = (v: Item | ReactNode): v is Item => !!v && typeof v === 'object' && 'el' in (v as object) && 'geo' in (v as object);

  if (ctx.flipY) {
    // Screens that can move as a block: known extent, and not a phone bleeding off the edge
    // (those are mirrored on their own and bleed off the top, as on a store page).
    const movable = (it: Item) => {
      const e = extentY(it.geo, h);
      return e && !(it.keepRatio && e.bottom > h + 1) ? e : null;
    };
    // Decorative layers (Spotlight's glow) move with the screens but do not size the block.
    const decorative = (it: Item) => it.el.type === 'div' && it.el.props.children === undefined;
    const block = items.filter(isItem).filter((it) => !it.text && !decorative(it)).map(movable).filter((e) => !!e);
    const T = Math.min(...block.map((e) => e.top));
    const B = Math.max(...block.map((e) => e.bottom));
    // The block goes where the text was. A block that bled off the bottom starts just inside the top.
    const margin = h * (ctx.o === 'portrait' ? 0.08 : 0.05);
    const newTop = B > h ? margin : h - B;
    const dy = newTop - T;
    const limit = h - T; // the block must end where the text now starts
    for (const it of items.filter(isItem)) {
      const e = it.text ? null : movable(it);
      if (!e || !block.length) {
        it.geo = mirrorY(it.geo, ctx, it.keepRatio);
        continue;
      }
      const g = { ...it.geo, top: e.top + dy };
      if (isNum(it.geo.bottom) && !isNum(it.geo.height)) g.bottom = it.geo.bottom - dy;
      // Frames that bled past the block's end are shortened (their screenshot is cropped, not squashed).
      const over = e.bottom + dy - limit;
      if (over > 0 && !it.keepRatio && isNum(it.geo.height)) g.height = it.geo.height - over;
      it.geo = g;
    }
  }

  const out: ReactNode[] = [];
  const visuals: ReactNode[] = [];
  const boxes: Rect[] = [];
  let firstVisual = -1;
  for (const it of items) {
    if (!isItem(it)) {
      out.push(it);
      continue;
    }
    const next = cloneElement(it.el, { [it.key]: it.geo });
    if (tilt === 'none' || it.text) {
      out.push(next);
      continue;
    }
    if (firstVisual < 0) firstVisual = out.length;
    visuals.push(next);
    const r = rectOf(it.geo);
    if (r) boxes.push(r);
  }
  if (!visuals.length) return out;
  // Turn around the centre of the visible part of the screens.
  const l = Math.max(0, Math.min(...boxes.map((b) => b.left)));
  const t = Math.max(0, Math.min(...boxes.map((b) => b.top)));
  const r = Math.min(ctx.w, Math.max(...boxes.map((b) => b.left + b.width)));
  const b = Math.min(h, Math.max(...boxes.map((b) => b.top + b.height)));
  const origin = boxes.length ? `${(l + r) / 2}px ${(t + b) / 2}px` : '50% 50%';
  out.splice(
    firstVisual,
    0,
    <div key="tilt" data-tilt={tilt} style={{ position: 'absolute', inset: 0, transform: tiltTransform(ctx), transformOrigin: origin }}>
      {visuals}
    </div>,
  );
  return out;
}

/** Mirror a CSS grid line span ("1 / 3", "2") across `tracks` tracks. */
function flipGridLines(spec: string, tracks: number): string {
  const [a, b] = spec.split('/').map((v) => parseInt(v, 10));
  const end = Number.isFinite(b) ? b : a + 1;
  return `${tracks + 2 - end} / ${tracks + 2 - a}`;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const abs = (left: number, top: number, width: number, height: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left,
  top,
  width,
  height,
  ...extra,
});

function ImageBox({ ctx, slot, index }: { ctx: Ctx; slot?: ScreenshotSlot; index: number }) {
  const url = slot ? ctx.urls[slot.assetId] : undefined;
  if (!slot || !url) {
    const { pal, u } = ctx;
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `repeating-linear-gradient(135deg, ${pal.primarySoft} 0 ${u * 1.2}px, ${mix(pal.primarySoft, pal.surface, 0.5)} ${u * 1.2}px ${u * 2.4}px)`,
          color: pal.textMuted,
          fontSize: u * 2.2,
          fontWeight: 600,
        }}
      >
        Screenshot {index + 1}
      </div>
    );
  }
  const asset = ctx.p.assets.find((a) => a.id === slot.assetId);
  const crop = slot.crop ?? NO_CROP;
  const background = slot.fit === 'contain' || slot.zoom < 1 ? ctx.pal.surface : undefined;
  if (!asset || asset.width <= 0 || asset.height <= 0) {
    // Unknown dimensions (should not happen for imported files): plain object-fit, no crop.
    const pos = `${slot.focalX * 100}% ${slot.focalY * 100}%`;
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background }}>
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: slot.fit,
            objectPosition: pos,
            transform: slot.zoom !== 1 ? `scale(${slot.zoom})` : undefined,
            transformOrigin: pos,
          }}
        />
      </div>
    );
  }
  // Crop, fit, zoom and focal point in one placement, with container query units so it works at any
  // frame size without measuring: S is the on-screen size of one source pixel.
  //   cover: the cropped area fills the frame; contain: it fits inside. Zoom scales S.
  //   The focal point (within the cropped area) stays at the same relative spot of the frame.
  const n = (v: number) => +v.toFixed(6);
  const W = asset.width;
  const H = asset.height;
  const cw = W * (1 - crop.left - crop.right);
  const ch = H * (1 - crop.top - crop.bottom);
  const S = `${slot.fit === 'cover' ? 'max' : 'min'}(100cqw / ${n(cw)}, 100cqh / ${n(ch)}) * ${n(slot.zoom)}`;
  const place: CSSProperties = {
    position: 'absolute',
    width: `calc(${S} * ${W})`,
    height: `calc(${S} * ${H})`,
    left: `calc((100cqw - ${S} * ${n(cw)}) * ${n(slot.focalX)} - ${S} * ${n(W * crop.left)})`,
    top: `calc((100cqh - ${S} * ${n(ch)}) * ${n(slot.focalY)} - ${S} * ${n(H * crop.top)})`,
  };
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background, containerType: 'size' }}>
      <img src={url} alt="" draggable={false} style={{ ...place, display: 'block', maxWidth: 'none' }} />
      <Redactions areas={slot.redact} place={place} />
    </div>
  );
}

/** Opaque bars over the hidden areas, laid over an image placed by `place`. */
function Redactions({ areas, place }: { areas?: Area[]; place: CSSProperties }) {
  if (!areas?.length) return null;
  return (
    <div data-redactions="" style={{ ...place, pointerEvents: 'none' }}>
      {areas.map((a, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${a.x * 100}%`,
            top: `${a.y * 100}%`,
            width: `${a.w * 100}%`,
            height: `${a.h * 100}%`,
            background: HW.redact,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

/**
 * A round lens showing the screenshot's focal point enlarged: `scale` on-screen pixels per source
 * pixel, focal point in the centre. Hidden areas stay hidden in the lens.
 */
function Lens({ ctx, slot, size, scale, style }: { ctx: Ctx; slot: ScreenshotSlot; size: number; scale: number; style: CSSProperties }) {
  const asset = ctx.p.assets.find((a) => a.id === slot.assetId);
  const url = ctx.urls[slot.assetId];
  const { pal, u } = ctx;
  if (!asset || !url) return null;
  const crop = slot.crop ?? NO_CROP;
  const px = asset.width * (crop.left + slot.focalX * (1 - crop.left - crop.right));
  const py = asset.height * (crop.top + slot.focalY * (1 - crop.top - crop.bottom));
  const place: CSSProperties = {
    position: 'absolute',
    left: size / 2 - scale * px,
    top: size / 2 - scale * py,
    width: scale * asset.width,
    height: scale * asset.height,
  };
  return (
    <div
      data-lens=""
      style={{
        ...style,
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: pal.surface,
        boxShadow: `0 0 0 ${u * 0.6}px ${pal.surface}, 0 0 0 ${u * 1.05}px ${pal.primary}${ctx.shadow === 'none' ? '' : `, ${ctx.shadow}`}`,
      }}
    >
      <img src={url} alt="" draggable={false} style={{ ...place, display: 'block', maxWidth: 'none' }} />
      <Redactions areas={slot.redact} place={place} />
    </div>
  );
}

/** Frame for desktop screenshots; its look follows `project.desktopFrame`. */
function BrowserFrame({ ctx, index, style }: { ctx: Ctx; index: number; style: CSSProperties }) {
  const { pal, u, radius, shadow } = ctx;
  const kind = ctx.p.desktopFrame ?? 'browser';
  if (kind === 'laptop') return <LaptopFrame ctx={ctx} index={index} style={style} />;
  const bar = u * (kind === 'window' ? 2.8 : 3.6);
  const dot = u * 1.05;
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: radius,
        overflow: 'hidden',
        background: pal.surface,
        boxShadow: shadow,
        border: ctx.edge,
      }}
    >
      {kind !== 'plain' && (
        <div
          style={{
            height: bar,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: dot * 0.7,
            padding: `0 ${u * 1.6}px`,
            background: mix(pal.surface, pal.text, 0.04),
            borderBottom: `${Math.max(1, u * 0.1)}px solid ${pal.border}`,
          }}
        >
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} style={{ width: dot, height: dot, borderRadius: '50%', background: c, flex: 'none' }} />
          ))}
          {kind === 'browser' && (
            <span
              style={{
                marginLeft: u * 2,
                height: bar * 0.52,
                width: '38%',
                borderRadius: bar,
                background: mix(pal.surface, pal.text, 0.08),
              }}
            />
          )}
        </div>
      )}
      <div style={{ position: 'relative', flex: 1 }}>
        <ImageBox ctx={ctx} slot={ctx.shots[index]} index={index} />
      </div>
    </div>
  );
}

/** Laptop: dark screen bezel with a camera, on a wider aluminium base, fitted inside `style`'s box. */
/** Laptop screens are 16:10 (MacBook Air and Pro are about 1.54, most Windows laptops 1.6). */
export const LAPTOP_SCREEN_RATIO = 1.6;
const LAPTOP = { lid: 0.88, bezel: 0.016, base: 0.032 } as const;
/** Height of the whole laptop (lid with bezels + base) for a given total width. */
export const laptopHeight = (w: number) =>
  ((LAPTOP.lid - 2 * LAPTOP.bezel) * w) / LAPTOP_SCREEN_RATIO + LAPTOP.bezel * 2.4 * w + LAPTOP.base * w;

/**
 * A laptop that keeps a real 16:10 screen whatever box the template gives it:
 * as wide as the box when that fits (top-aligned, so bleeding layouts keep their top edge),
 * otherwise as tall as the box, centred horizontally.
 */
function LaptopFrame({ ctx, index, style }: { ctx: Ctx; index: number; style: CSSProperties }) {
  const boxW = Number(style.width);
  const top = Number(style.top ?? 0);
  // Templates let frames bleed past the bottom edge; a laptop must keep its base in view.
  const boxH = Math.min(Number(style.height), ctx.h - top - ctx.u * 2);
  const W = laptopHeight(boxW) <= boxH ? boxW : boxH / laptopHeight(1);
  // In tall formats, centre the laptop in its box instead of leaving the space below empty.
  const offsetY = ctx.o === 'portrait' ? Math.max(0, (boxH - laptopHeight(W)) / 2) : 0;
  const base = W * LAPTOP.base;
  const lid = W * LAPTOP.lid;
  const bezel = W * LAPTOP.bezel;
  const screenH = (lid - 2 * bezel) / LAPTOP_SCREEN_RATIO;
  return (
    <div style={{ ...style, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: W, marginTop: offsetY, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
      <div
        data-laptop-screen-ratio={LAPTOP_SCREEN_RATIO}
        style={{
          position: 'relative',
          width: lid,
          height: screenH + bezel * 2.4,
          boxSizing: 'border-box',
          flex: 'none',
          padding: `${bezel * 1.4}px ${bezel}px ${bezel}px`,
          borderRadius: `${W * 0.022}px ${W * 0.022}px 0 0`,
          background: HW.bezel,
          boxShadow: ctx.shadow === 'none' ? undefined : ctx.shadow,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: W * 0.004 }}>
          <ImageBox ctx={ctx} slot={ctx.shots[index]} index={index} />
        </div>
        <span
          style={{
            position: 'absolute',
            top: bezel * 0.7,
            left: '50%',
            width: bezel * 0.32,
            height: bezel * 0.32,
            marginLeft: -bezel * 0.16,
            marginTop: -bezel * 0.16,
            borderRadius: '50%',
            background: HW.screenOff,
          }}
        />
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: base,
          flex: 'none',
          borderRadius: `${base * 0.15}px ${base * 0.15}px ${base * 0.9}px ${base * 0.9}px / ${base * 0.15}px ${base * 0.15}px ${base * 0.6}px ${base * 0.6}px`,
          background: HW.lidGradient,
          boxShadow: ctx.shadow === 'none' ? undefined : ctx.softShadow([{ y: base * 0.4, blur: base * 1.2, alpha: 0.25 }]),
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            width: W * 0.14,
            height: base * 0.35,
            marginLeft: -W * 0.07,
            borderRadius: `0 0 ${base * 0.3}px ${base * 0.3}px`,
            background: HW.hinge,
          }}
        />
      </div>
      </div>
    </div>
  );
}

/** `width` is the short side of the phone; `landscape` turns it sideways with the camera on the left. */
function PhoneFrame({
  ctx,
  index,
  style,
  width,
  landscape = false,
}: {
  ctx: Ctx;
  index: number;
  style: CSSProperties;
  width: number;
  landscape?: boolean;
}) {
  const bezel = width * 0.035;
  const island: CSSProperties = landscape
    ? { left: width * 0.035, top: '50%', width: width * 0.075, height: width * 0.3, marginTop: -width * 0.15 }
    : { top: width * 0.035, left: '50%', width: width * 0.3, height: width * 0.075, marginLeft: -width * 0.15 };
  return (
    <div
      style={{
        ...style,
        borderRadius: width * 0.16,
        padding: bezel,
        background: HW.bezel,
        boxShadow: ctx.shadow === 'none' ? `0 0 0 ${Math.max(1, ctx.u * 0.15)}px rgba(255,255,255,0.08)` : ctx.shadow,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: width * 0.13, overflow: 'hidden' }}>
        <ImageBox ctx={ctx} slot={ctx.shots[index]} index={index} />
        <div style={{ position: 'absolute', ...island, borderRadius: width, background: HW.bezel }} />
      </div>
    </div>
  );
}

/** Tablet with a thin, even bezel; `width` is the short side. The camera sits on the top edge, or the left one in landscape. */
function TabletFrame({
  ctx,
  index,
  style,
  width,
  landscape = false,
}: {
  ctx: Ctx;
  index: number;
  style: CSSProperties;
  width: number;
  landscape?: boolean;
}) {
  const bezel = width * 0.04;
  const camera: CSSProperties = landscape ? { left: bezel / 2, top: '50%' } : { top: bezel / 2, left: '50%' };
  return (
    <div
      style={{
        ...style,
        borderRadius: width * 0.07,
        padding: bezel,
        background: HW.bezel,
        boxShadow: ctx.shadow === 'none' ? `0 0 0 ${Math.max(1, ctx.u * 0.15)}px rgba(255,255,255,0.08)` : ctx.shadow,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: width * 0.035, overflow: 'hidden' }}>
        <ImageBox ctx={ctx} slot={ctx.shots[index]} index={index} />
      </div>
      <span
        style={{
          position: 'absolute',
          ...camera,
          width: bezel * 0.36,
          height: bezel * 0.36,
          marginLeft: -bezel * 0.18,
          marginTop: -bezel * 0.18,
          borderRadius: '50%',
          background: HW.screenOff,
        }}
      />
    </div>
  );
}

function Card({ ctx, index, style }: { ctx: Ctx; index: number; style: CSSProperties }) {
  return (
    <div
      style={{
        ...style,
        position: style.position ?? 'relative',
        borderRadius: ctx.radius,
        overflow: 'hidden',
        background: ctx.pal.surface,
        boxShadow: ctx.shadow,
        border: ctx.edge,
      }}
    >
      <ImageBox ctx={ctx} slot={ctx.shots[index]} index={index} />
    </div>
  );
}

function Logo({ ctx, height }: { ctx: Ctx; height: number }) {
  const id = ctx.p.brand.logoAssetId;
  const url = id ? ctx.urls[id] : undefined;
  if (!url) return null;
  return <img src={url} alt="" draggable={false} style={{ height, width: 'auto', maxWidth: `min(${height * 5}px, 100%)`, objectFit: 'contain', display: 'block' }} />;
}

interface TextColors {
  text: string;
  muted: string;
  kickerBg: string;
  kickerText: string;
}

/**
 * The short line above the title. Minimal, Editorial and Bold never use tracked capitals:
 * plain text a step smaller (Minimal), over a hairline (Editorial), or a black label (Bold).
 * Soft keeps its original pill (or the capitals some templates asked for).
 */
function Kicker({ ctx, text, legacy, scale, colors }: { ctx: Ctx; text: string; legacy: 'pill' | 'caps'; scale: number; colors: TextColors }) {
  const { u, pal, style } = ctx;
  const size = kickerSize(u, scale) * (style.kicker === 'pill' ? 1 : 1.15);
  if (style.kicker === 'plain') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.6, fontSize: size, fontWeight: 500, color: colors.muted }}>
        <span aria-hidden="true" style={{ width: size * 0.62, height: size * 0.62, background: pal.primary, flex: 'none' }} />
        {text}
      </span>
    );
  }
  if (style.kicker === 'rule') {
    return (
      <span style={{ alignSelf: 'stretch', fontSize: size, fontWeight: 500, color: colors.muted, paddingBottom: size * 0.7, borderBottom: `${Math.max(1, u * 0.1)}px solid ${colors.text}` }}>
        {text}
      </span>
    );
  }
  if (style.kicker === 'code') {
    // The slashes are the brand mark; the text stays in the muted ink so it reads on any ground.
    return (
      <span style={{ fontFamily: BUNDLED_FONTS.mono, fontSize: size * 0.92, fontWeight: 500, color: colors.muted, whiteSpace: 'nowrap', letterSpacing: 0 }}>
        <span aria-hidden="true" style={{ color: inkOn(pal.primary, pal.bg, 3) }}>
          {'// '}
        </span>
        {text}
      </span>
    );
  }
  if (style.kicker === 'label') {
    return (
      <span style={{ fontSize: size, fontWeight: 600, padding: `${size * 0.4}px ${size * 0.6}px`, background: BOLD_INK, color: HW.onDark, whiteSpace: 'nowrap' }}>
        {text}
      </span>
    );
  }
  return legacy === 'pill' ? (
    <span
      style={{
        fontSize: kickerSize(u, scale),
        fontWeight: 650,
        padding: `${u * 0.7 * scale}px ${u * 1.6 * scale}px`,
        borderRadius: u * 10,
        background: colors.kickerBg,
        color: colors.kickerText,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  ) : (
    <span style={{ fontSize: kickerSize(u, scale), fontWeight: 700, color: pal.primary, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{text}</span>
  );
}

function TextBlock({
  ctx,
  align = 'left',
  scale = 1,
  style,
  colors,
  font,
  kickerStyle = 'pill',
  subtitle = true,
  showTitle = true,
  children,
  after,
}: {
  ctx: Ctx;
  align?: 'left' | 'center';
  scale?: number;
  style?: CSSProperties;
  colors?: Partial<TextColors>;
  font?: string;
  kickerStyle?: 'pill' | 'caps';
  subtitle?: boolean;
  /** Templates whose main text is not the title (Testimonial) turn it off. */
  showTitle?: boolean;
  children?: ReactNode;
  /** Drawn after the subtitle (the Call to Action button). */
  after?: ReactNode;
}) {
  const { u, o, pal, p } = ctx;
  const c: TextColors = { text: pal.text, muted: pal.textMuted, kickerBg: pal.primarySoft, kickerText: pal.primaryStrong, ...colors };
  const { kicker, title, subtitle: sub } = p.content;
  const spec = ctx.style;
  const headingFont = font ?? ctx.heading;
  // Instrument Serif has a single (regular) weight: never synthesise a faux bold.
  const serifHeading = headingFont === FONT_STACKS.serif;
  const tSize = titleSize(u, o, title.length, scale) * spec.titleScale;
  const a = ctx.layout.textAlign === 'auto' ? align : ctx.layout.textAlign;
  const center = a === 'center';
  // Beside the screens (or alone), Top and Bottom move the vertically centred column to an edge.
  const pos = ctx.layout.textPosition;
  const column = !ctx.stacked && pos !== 'auto' && style?.justifyContent === 'center';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: center ? 'center' : a === 'right' ? 'flex-end' : 'flex-start',
        textAlign: a,
        gap: u * 1.8 * scale,
        ...style,
        ...(column && {
          justifyContent: pos === 'top' ? 'flex-start' : 'flex-end',
          paddingTop: pos === 'top' ? ctx.h * 0.09 : undefined,
          paddingBottom: pos === 'bottom' ? ctx.h * 0.09 : undefined,
        }),
      }}
    >
      {!ctx.footer && <Logo ctx={ctx} height={logoHeight(u, p.brand.logoSize ?? 'medium', scale)} />}
      {kicker.trim() && <Kicker ctx={ctx} text={kicker} legacy={kickerStyle} scale={scale} colors={c} />}
      {showTitle && title.trim() && (
        <h1
          style={{
            margin: 0,
            fontFamily: headingFont,
            fontSize: tSize,
            lineHeight: spec.heading || font ? spec.titleLeading : 1.06,
            fontWeight: serifHeading ? 400 : spec.heading ? spec.titleWeight : 760,
            fontStretch: !font ? spec.titleStretch : undefined,
            letterSpacing: !spec.heading && ctx.p.brand.headingFont === 'mono' ? '-0.03em' : serifHeading ? '-0.015em' : spec.titleTracking,
            color: c.text,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          {title}
        </h1>
      )}
      {children}
      {subtitle && sub.trim() && (
        <p
          style={{
            margin: 0,
            fontSize: subtitleSize(u, o, scale) * (spec.italicSubtitle ? 1.2 : 1),
            fontFamily: spec.italicSubtitle ? spec.heading ?? undefined : undefined,
            fontStyle: spec.italicSubtitle ? 'italic' : undefined,
            lineHeight: spec.italicSubtitle ? 1.25 : 1.38,
            color: c.muted,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            maxWidth: a === 'left' ? '100%' : '92%',
          }}
        >
          {sub}
        </p>
      )}
      {after}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Text column on the left for landscape layouts, vertically centred. */
const leftColumn = (ctx: Ctx, widthFraction: number): CSSProperties => ({
  position: 'absolute',
  left: ctx.w * (ctx.wide ? 0.04 : 0.06),
  top: 0,
  bottom: 0,
  width: ctx.w * widthFraction,
  justifyContent: 'center',
});

/** Text block at the top for square / portrait layouts. */
const topBlock = (ctx: Ctx): CSSProperties => ({
  position: 'absolute',
  left: ctx.w * 0.08,
  right: ctx.w * 0.08,
  top: ctx.h * (ctx.o === 'portrait' ? 0.14 : 0.08),
});

/**
 * Rough height of a text block, used only to balance a stacked layout on the canvas. Text is never
 * placed against a screen with it: there the text is anchored to the screen's edge.
 */
function estimateTextHeight(ctx: Ctx, width: number, scale = 1, withSubtitle = true): number {
  const { u, o, p, style: spec } = ctx;
  const parts: number[] = [];
  if (!ctx.footer && p.brand.logoAssetId) parts.push(logoHeight(u, p.brand.logoSize ?? 'medium', scale));
  if (p.content.kicker.trim()) parts.push(kickerSize(u, scale) * 2);
  const lines = (text: string, perLine: number) => text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
  const title = p.content.title;
  if (title.trim()) {
    const size = titleSize(u, o, title.length, scale) * spec.titleScale;
    parts.push(lines(title, Math.max(4, width / (size * 0.5))) * size * (spec.heading ? spec.titleLeading : 1.06));
  }
  const sub = p.content.subtitle;
  if (withSubtitle && sub.trim()) {
    const size = subtitleSize(u, o, scale) * (spec.italicSubtitle ? 1.2 : 1);
    parts.push(lines(sub, Math.max(8, (width * 0.92) / (size * 0.48))) * size * 1.38);
  }
  return parts.reduce((a, b) => a + b, 0) + Math.max(0, parts.length - 1) * u * 1.8 * scale;
}

/**
 * Portrait stack: the text directly above a screen of height `frameH`, the pair centred on the canvas.
 * The text is anchored to the top edge of the screen (its `bottom`), so a short or long title never
 * leaves a gap or overlaps it. A screen taller than the room left bleeds off the bottom: the bottom of
 * the screenshot is cropped, never its sides. Returns the text box and the top of the screen.
 */
function portraitStack(ctx: Ctx, frameH: number, scale = 1, extraGap = 0): { text: CSSProperties; top: number } {
  const { w, h, u } = ctx;
  const gap = u * 5 + extraGap;
  const textH = estimateTextHeight(ctx, w * 0.84, scale);
  const groupTop = Math.max(h * 0.08, (h - (textH + gap + frameH)) / 2);
  const top = groupTop + textH + gap;
  return { top, text: { position: 'absolute', left: w * 0.08, right: w * 0.08, bottom: h - top + gap } };
}

/** Height of a desktop frame `width` wide that shows screenshot `index` whole: title bar included. */
function desktopFrameHeight(ctx: Ctx, index: number, width: number): number {
  const kind = ctx.p.desktopFrame ?? 'browser';
  if (kind === 'laptop') return laptopHeight(width);
  const bar = kind === 'plain' ? 0 : ctx.u * (kind === 'window' ? 2.8 : 3.6);
  return width / shotRatio(ctx, ctx.shots[index], 1.6) + bar;
}

function BrowserHero(ctx: Ctx) {
  const { w, h, o } = ctx;
  if (o === 'landscape') {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, ctx.wide ? 0.36 : 0.4)} />
        <BrowserFrame ctx={ctx} index={0} style={abs(w * (ctx.wide ? 0.44 : 0.5), h * 0.14, w * 0.58, h * 0.95)} />
      </>
    );
  }
  if (o === 'portrait') {
    // The whole screenshot, at its own proportions, right under the text (a very tall one is capped).
    const fw = w * 0.86;
    const fh = Math.min(desktopFrameHeight(ctx, 0, fw), h * 0.62);
    const { text, top } = portraitStack(ctx, fh);
    return (
      <>
        <TextBlock ctx={ctx} align="center" style={text} />
        <BrowserFrame ctx={ctx} index={0} style={abs(w * 0.07, top, fw, fh)} />
      </>
    );
  }
  return (
    <>
      <TextBlock ctx={ctx} align="center" style={topBlock(ctx)} />
      <BrowserFrame ctx={ctx} index={0} style={abs(w * 0.07, h * 0.47, w * 0.86, h * 0.62)} />
    </>
  );
}

function BrowserDuo(ctx: Ctx) {
  const { w, h, o } = ctx;
  if (o === 'landscape') {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, ctx.wide ? 0.32 : 0.34)} scale={0.9} />
        <BrowserFrame ctx={ctx} index={0} style={abs(w * 0.42, h * 0.08, w * 0.44, h * 0.62)} />
        <BrowserFrame ctx={ctx} index={1} style={abs(w * 0.54, h * 0.36, w * 0.44, h * 0.7)} />
      </>
    );
  }
  const portrait = o === 'portrait';
  return (
    <>
      <TextBlock ctx={ctx} align="center" style={topBlock(ctx)} scale={0.92} />
      <BrowserFrame ctx={ctx} index={0} style={abs(w * 0.05, h * (portrait ? 0.43 : 0.44), w * 0.68, h * (portrait ? 0.27 : 0.36))} />
      <BrowserFrame ctx={ctx} index={1} style={abs(w * 0.27, h * (portrait ? 0.58 : 0.6), w * 0.68, h * (portrait ? 0.27 : 0.42))} />
    </>
  );
}

function MobileTrio(ctx: Ctx) {
  const { w, h, o } = ctx;
  const count = Math.min(3, ctx.p.screenshots.length) || 3;
  const phoneH = o === 'landscape' ? h * 0.84 : o === 'square' ? h * 0.56 : h * 0.44;
  const phoneW = phoneH * 0.48;
  const cx = o === 'landscape' ? w * (ctx.wide ? 0.78 : 0.73) : w / 2;
  const top = o === 'landscape' ? (h - phoneH) / 2 + h * 0.08 : h * (o === 'square' ? 0.42 : 0.45);

  const phone = (index: number, x: number, scale: number, z: number) => {
    const pw = phoneW * scale;
    const ph = phoneH * scale;
    return (
      <PhoneFrame
        key={index}
        ctx={ctx}
        index={index}
        width={pw}
        style={abs(x - pw / 2, top + (phoneH - ph) / 2, pw, ph, { zIndex: z })}
      />
    );
  };

  let phones: ReactNode[];
  if (count === 1) phones = [phone(0, cx, 1, 2)];
  else if (count === 2) phones = [phone(0, cx - phoneW * 0.56, 1, 1), phone(1, cx + phoneW * 0.56, 1, 2)];
  else phones = [phone(1, cx - phoneW * 0.8, 0.84, 1), phone(2, cx + phoneW * 0.8, 0.84, 1), phone(0, cx, 1, 2)];

  return (
    <>
      {o === 'landscape' ? (
        <TextBlock ctx={ctx} style={leftColumn(ctx, ctx.wide ? 0.5 : 0.4)} />
      ) : (
        <TextBlock ctx={ctx} align="center" style={topBlock(ctx)} />
      )}
      {phones}
    </>
  );
}

function Bento(ctx: Ctx) {
  const { u, o, pal, wide } = ctx;
  const area = (col: string, row: string): CSSProperties => ({ gridColumn: col, gridRow: row, position: 'relative' });
  let cols: string, rows: string, areas: [CSSProperties, CSSProperties, CSSProperties, CSSProperties];
  if (wide) {
    cols = '1.5fr 1fr 1fr 1fr';
    rows = '1fr';
    areas = [area('1', '1'), area('2', '1'), area('3', '1'), area('4', '1')];
  } else if (o === 'landscape') {
    cols = '1fr 1fr 1.25fr 1.25fr';
    rows = '1fr 1fr';
    areas = [area('1 / 3', '1'), area('3 / 5', '1 / 3'), area('1', '2'), area('2', '2')];
  } else if (o === 'square') {
    cols = '1fr 1fr';
    rows = '0.95fr 1fr 1fr';
    areas = [area('1 / 3', '1'), area('1', '2 / 4'), area('2', '2'), area('2', '3')];
  } else {
    cols = '1fr 1fr';
    rows = '1.05fr 1.4fr 1fr';
    areas = [area('1 / 3', '1'), area('1 / 3', '2'), area('1', '3'), area('2', '3')];
  }
  // Bento is one grid: mirror its columns, and its rows to put the text card at the bottom.
  const nCols = cols.split(' ').length;
  const nRows = rows.split(' ').length;
  const bottom = ctx.layout.textPosition === 'bottom';
  if (ctx.layout.mirror || bottom) {
    areas = areas.map((ar) => ({
      ...ar,
      gridColumn: ctx.layout.mirror ? flipGridLines(String(ar.gridColumn), nCols) : ar.gridColumn,
      gridRow: bottom ? flipGridLines(String(ar.gridRow), nRows) : ar.gridRow,
    })) as typeof areas;
    if (ctx.layout.mirror) cols = cols.split(' ').reverse().join(' ');
    if (bottom) rows = rows.split(' ').reverse().join(' ');
  }
  const pad = o === 'portrait' ? { top: ctx.h * 0.12, bottom: ctx.h * 0.16, x: u * 5 } : { top: u * 4.5, bottom: u * 4.5, x: u * 4.5 };
  const onPrimary = pal.onPrimary;
  return (
    <div
      style={{
        position: 'absolute',
        inset: `${pad.top}px ${pad.x}px ${pad.bottom}px`,
        display: 'grid',
        gridTemplateColumns: cols,
        gridTemplateRows: rows,
        gap: u * 2,
      }}
    >
      <div
        style={{
          ...areas[0],
          borderRadius: ctx.radius,
          background: ctx.style.glow ? `linear-gradient(140deg, ${pal.primary}, ${mix(pal.primary, pal.accent, 0.45)})` : ctx.style.brandBackground ? BOLD_INK : pal.primary,
          boxShadow: ctx.shadow,
          padding: u * 3.6,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <TextBlock
          ctx={ctx}
          scale={wide ? 0.62 : 0.74}
          subtitle={!wide}
          colors={{ text: onPrimary, muted: withAlpha(onPrimary, 0.82), kickerBg: withAlpha(onPrimary, 0.18), kickerText: onPrimary }}
        />
      </div>
      <Card ctx={ctx} index={0} style={areas[1]} />
      <Card ctx={ctx} index={1} style={areas[2]} />
      <Card ctx={ctx} index={2} style={areas[3]} />
    </div>
  );
}

function Spotlight(ctx: Ctx) {
  const { w, h, o, pal, wide } = ctx;
  let text: CSSProperties, frame: CSSProperties, align: 'left' | 'center' = 'center';
  if (wide) {
    text = leftColumn(ctx, 0.38);
    frame = abs(w * 0.47, h * 0.12, w * 0.48, h * 0.98);
    align = 'left';
  } else if (o === 'landscape') {
    text = { position: 'absolute', left: w * 0.1, right: w * 0.1, top: h * 0.08 };
    frame = abs(w * 0.15, h * 0.44, w * 0.7, h * 0.8);
  } else if (o === 'square') {
    text = topBlock(ctx);
    frame = abs(w * 0.1, h * 0.44, w * 0.8, h * 0.66);
  } else {
    // Portrait: the whole screenshot at its own proportions, right under the text.
    const fw = w * 0.86;
    const fh = Math.min(fw / shotRatio(ctx, ctx.shots[0], 1.6), h * 0.5);
    const stack = portraitStack(ctx, fh);
    text = stack.text;
    frame = abs(w * 0.07, stack.top, fw, fh);
  }
  const fx = Number(frame.left) + Number(frame.width) / 2;
  const fy = Number(frame.top) + Number(frame.height) / 2;
  const gw = Number(frame.width) * 1.3;
  const gh = Number(frame.height) * 1.2;
  return (
    <>
      <div
        style={abs(fx - gw / 2, fy - gh / 2, gw, gh, {
          background: ctx.style.glow
            ? `radial-gradient(closest-side, ${withAlpha(pal.primary, 0.5)}, ${withAlpha(pal.accent, 0.18)} 55%, transparent)`
            : undefined,
        })}
      />
      <TextBlock ctx={ctx} align={align} style={text} scale={o === 'landscape' && !wide ? 0.82 : 1} />
      <Card ctx={ctx} index={0} style={frame} />
    </>
  );
}

function BeforeAfter(ctx: Ctx) {
  const { w, h, o, u, pal, p, wide } = ctx;
  let text: CSSProperties, a: CSSProperties, b: CSSProperties, arrow: { x: number; y: number; rotate: number };
  let align: 'left' | 'center' = 'center';
  if (wide) {
    align = 'left';
    text = leftColumn(ctx, 0.26);
    a = abs(w * 0.33, h * 0.12, w * 0.31, h * 0.76);
    b = abs(w * 0.66, h * 0.12, w * 0.31, h * 0.76);
    arrow = { x: w * 0.65, y: h * 0.5, rotate: 0 };
  } else if (o === 'portrait') {
    text = { position: 'absolute', left: w * 0.08, right: w * 0.08, top: h * 0.13 };
    a = abs(w * 0.07, h * 0.36, w * 0.86, h * 0.215);
    b = abs(w * 0.07, h * 0.6, w * 0.86, h * 0.215);
    arrow = { x: w / 2, y: h * 0.5875, rotate: 90 };
  } else {
    const top = 0.4;
    text = { position: 'absolute', left: w * 0.1, right: w * 0.1, top: h * 0.07 };
    a = abs(w * 0.05, h * top, w * 0.43, h * (0.93 - top));
    b = abs(w * 0.52, h * top, w * 0.43, h * (0.93 - top));
    arrow = { x: w / 2, y: h * (top + (0.93 - top) / 2), rotate: 0 };
  }
  // Mirroring moves every box; swap the two side-by-side shots first so Before still comes first.
  if (ctx.layout.mirror && (wide || o !== 'portrait')) [a, b] = [b, a];
  const label = (txt: string, after: boolean) => (
    <span
      style={{
        position: 'absolute',
        left: u * 1.6,
        top: u * 1.6,
        zIndex: 2,
        padding: `${u * 0.6}px ${u * 1.5}px`,
        borderRadius: u * 10,
        fontSize: u * 2,
        fontWeight: 700,
        background: after ? pal.primary : 'rgba(17,19,26,0.78)',
        color: after ? pal.onPrimary : HW.onDark,
      }}
    >
      {txt}
    </span>
  );
  const d = u * 6;
  return (
    <>
      <TextBlock ctx={ctx} align={align} style={text} scale={0.78} subtitle={o !== 'square' && !wide} />
      <div style={{ ...a, position: 'absolute' }}>
        <Card ctx={ctx} index={0} style={{ position: 'absolute', inset: 0 }} />
        {p.content.beforeLabel.trim() && label(p.content.beforeLabel, false)}
      </div>
      <div style={{ ...b, position: 'absolute' }}>
        <Card ctx={ctx} index={1} style={{ position: 'absolute', inset: 0 }} />
        {p.content.afterLabel.trim() && label(p.content.afterLabel, true)}
      </div>
      <div
        style={abs(arrow.x - d / 2, arrow.y - d / 2, d, d, {
          zIndex: 3,
          borderRadius: '50%',
          background: pal.surface,
          boxShadow: ctx.shadow,
          border: ctx.edge,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: pal.primary,
          fontSize: u * 3.2,
          fontWeight: 800,
          transform: `rotate(${arrow.rotate}deg)`,
        })}
      >
        →
      </div>
    </>
  );
}

function Editorial(ctx: Ctx) {
  const { w, h, o, u, pal } = ctx;
  const hasShot = !!ctx.shots[0];
  const imageBox = (style: CSSProperties) => (
    <div style={{ ...style, overflow: 'hidden', background: ctx.style.glow ? `linear-gradient(135deg, ${pal.primary}, ${pal.accent})` : pal.bgAlt }}>
      {hasShot && <ImageBox ctx={ctx} slot={ctx.shots[0]} index={0} />}
    </div>
  );
  const rule = <span style={{ width: u * 10, height: Math.max(2, u * 0.45), background: pal.primary, display: 'block' }} />;
  if (o === 'landscape') {
    return (
      <>
        <TextBlock ctx={ctx} font={FONT_STACKS.serif} kickerStyle="caps" style={leftColumn(ctx, ctx.wide ? 0.5 : 0.44)}>
          {rule}
        </TextBlock>
        {imageBox(abs(w * (ctx.wide ? 0.6 : 0.55), 0, w * (ctx.wide ? 0.4 : 0.45), h))}
      </>
    );
  }
  const imgH = h * (o === 'portrait' ? 0.46 : 0.44);
  return (
    <>
      {imageBox(abs(0, 0, w, imgH))}
      <TextBlock
        ctx={ctx}
        font={FONT_STACKS.serif}
        kickerStyle="caps"
        scale={0.95}
        style={{ position: 'absolute', left: w * 0.08, right: w * 0.08, top: imgH + h * 0.05 }}
      >
        {rule}
      </TextBlock>
    </>
  );
}

function Minimal(ctx: Ctx) {
  const { w, h, u, pal, o } = ctx;
  return (
    <>
      <TextBlock
        ctx={ctx}
        align="center"
        kickerStyle="caps"
        scale={ctx.wide ? 0.9 : 1.15}
        style={{
          position: 'absolute',
          left: w * 0.1,
          right: w * 0.1,
          top: o === 'portrait' ? h * 0.13 : 0,
          bottom: o === 'portrait' ? h * 0.18 : 0,
          justifyContent: 'center',
        }}
      >
        <span style={{ width: u * 8, height: Math.max(2, u * 0.5), borderRadius: u, background: pal.primary, display: 'block' }} />
      </TextBlock>
    </>
  );
}


/** Width / height of the device frames, used to keep their proportions whatever the format. */
const DEVICE_RATIO = { tablet: 0.75, mobile: 0.48 } as const;
/** Sideways devices are wider, so they may use more of the area's width than their upright slot allows. */
const LANDSCAPE_WIDTH_BOOST = { tablet: 1.5, mobile: 1.4 } as const;

/**
 * Layout of each device inside the device area, as fractions of that area.
 * Desktop is a rectangle; tablet and mobile are placed by horizontal centre and bottom edge, with a
 * target height and a maximum width so their aspect ratio holds in every format.
 */
type DeviceSlot = { l: number; t: number; w: number; h: number } | { cx: number; b: number; hf: number; wf: number };
const DEVICE_LAYOUTS: Record<string, Partial<Record<DeviceKind, DeviceSlot>>> = {
  'desktop+tablet+mobile': {
    desktop: { l: 0, t: 0, w: 0.78, h: 0.74 },
    tablet: { cx: 0.78, b: 0.98, hf: 0.8, wf: 0.4 },
    mobile: { cx: 0.5, b: 1, hf: 0.58, wf: 0.2 },
  },
  'desktop+tablet': {
    desktop: { l: 0, t: 0.02, w: 0.8, h: 0.78 },
    tablet: { cx: 0.78, b: 0.98, hf: 0.82, wf: 0.42 },
  },
  'desktop+mobile': {
    desktop: { l: 0, t: 0.04, w: 0.84, h: 0.8 },
    mobile: { cx: 0.84, b: 0.98, hf: 0.7, wf: 0.26 },
  },
  'tablet+mobile': {
    tablet: { cx: 0.4, b: 0.96, hf: 0.94, wf: 0.62 },
    mobile: { cx: 0.78, b: 1, hf: 0.7, wf: 0.3 },
  },
};

function DeviceMix(ctx: Ctx) {
  const { w, h, o, wide } = ctx;
  const devices = normalizeDevices(ctx.p.devices);
  const layout = DEVICE_LAYOUTS[devices.join('+')] ?? DEVICE_LAYOUTS['desktop+tablet+mobile'];

  // The area the devices share: right of the text in landscape, below it otherwise.
  let text: ReactNode;
  let area: { x: number; y: number; w: number; h: number };
  if (o === 'landscape') {
    text = <TextBlock ctx={ctx} style={leftColumn(ctx, wide ? 0.32 : 0.34)} scale={0.9} />;
    const x = w * (wide ? 0.38 : 0.41);
    area = { x, y: h * 0.08, w: w * 0.97 - x, h: h * 0.86 };
  } else {
    text = <TextBlock ctx={ctx} align="center" style={topBlock(ctx)} scale={0.92} />;
    const y = h * (o === 'portrait' ? 0.44 : 0.46);
    area = { x: w * 0.05, y, w: w * 0.9, h: h * 0.96 - y };
  }

  // Tablet + mobile without a desktop: keep the phone overlapping the tablet's right edge and centre the
  // pair, so they read as one group even when the area is much wider than tall (banners, squares).
  const turned = (device: 'tablet' | 'mobile') => ctx.p.deviceOrientation?.[device] === 'landscape';
  const size = (device: 'tablet' | 'mobile', slot: { hf: number; wf: number }) => {
    const ratio = turned(device) ? 1 / DEVICE_RATIO[device] : DEVICE_RATIO[device];
    const wf = turned(device) ? Math.min(0.62, slot.wf * LANDSCAPE_WIDTH_BOOST[device]) : slot.wf;
    const dh = Math.min(slot.hf * area.h, (wf * area.w) / ratio);
    return { dw: dh * ratio, dh };
  };
  const pairLeft: Partial<Record<DeviceKind, number>> = {};
  const ts = layout.tablet;
  const ms = layout.mobile;
  if (!layout.desktop && ts && ms && !('l' in ts) && !('l' in ms)) {
    const t = size('tablet', ts);
    const m = size('mobile', ms);
    const overlap = m.dw * 0.35;
    const left = area.x + (area.w - (t.dw + m.dw - overlap)) / 2;
    pairLeft.tablet = left;
    pairLeft.mobile = left + t.dw - overlap;
  }

  // Place every device first, then centre the group vertically in the area: sideways devices are
  // shorter, and bottom-anchored slots would otherwise leave a gap above them in tall formats.
  type Placed = { device: DeviceKind; index: number; rect: { left: number; top: number; width: number; height: number } };
  const placed: Placed[] = [];
  devices.forEach((device, index) => {
    const slot = layout[device];
    if (!slot) return;
    if ('l' in slot) {
      placed.push({ device, index, rect: { left: area.x + slot.l * area.w, top: area.y + slot.t * area.h, width: slot.w * area.w, height: slot.h * area.h } });
      return;
    }
    const { dw, dh } = size(device as 'tablet' | 'mobile', slot);
    // Keep the device inside the area even when a wide landscape frame is centred near an edge.
    const ideal = pairLeft[device] ?? area.x + slot.cx * area.w - dw / 2;
    const left = Math.max(area.x, Math.min(ideal, area.x + area.w - dw));
    placed.push({ device, index, rect: { left, top: area.y + slot.b * area.h - dh, width: dw, height: dh } });
  });
  const groupTop = Math.min(...placed.map((d) => d.rect.top));
  const groupBottom = Math.max(...placed.map((d) => d.rect.top + d.rect.height));
  const shift = groupBottom - groupTop < area.h ? (area.y + area.y + area.h - groupTop - groupBottom) / 2 : 0;

  return (
    <>
      {text}
      {placed.map(({ device, index, rect }) => {
        const z = index + 1; // desktop at the back, mobile in front
        const style = abs(rect.left, rect.top + shift, rect.width, rect.height, { zIndex: z });
        if (device === 'desktop') return <BrowserFrame key={device} ctx={ctx} index={index} style={style} />;
        const landscape = turned(device);
        const short = Math.min(rect.width, rect.height);
        return device === 'tablet' ? (
          <TabletFrame key={device} ctx={ctx} index={index} width={short} landscape={landscape} style={style} />
        ) : (
          <PhoneFrame key={device} ctx={ctx} index={index} width={short} landscape={landscape} style={style} />
        );
      })}
    </>
  );
}

/**
 * Store screenshot: a large centred caption, then one device that bleeds off the bottom edge.
 * The device follows the canvas shape: phone for tall formats, tablet for 3:4-ish, desktop otherwise.
 */
function AppStore(ctx: Ctx) {
  const { w, h } = ctx;
  const r = w / h;
  const text = (
    <TextBlock
      ctx={ctx}
      align="center"
      scale={1.08}
      style={{ position: 'absolute', left: w * 0.08, right: w * 0.08, top: h * (r < 0.95 ? 0.06 : 0.07) }}
    />
  );
  let device: ReactNode;
  if (r < 0.6) {
    const pw = w * 0.74;
    device = <PhoneFrame ctx={ctx} index={0} width={pw} style={abs((w - pw) / 2, h * 0.33, pw, pw / DEVICE_RATIO.mobile)} />;
  } else if (r < 0.95) {
    const tw = w * 0.84;
    device = <TabletFrame ctx={ctx} index={0} width={tw} style={abs((w - tw) / 2, h * 0.41, tw, tw / DEVICE_RATIO.tablet)} />;
  } else {
    // The caption takes more of the height on square canvases, so the window starts lower there.
    const dw = w * (r > 1.15 ? 0.8 : 0.86);
    const top = h * (r > 1.15 ? 0.47 : 0.53);
    device = <BrowserFrame ctx={ctx} index={0} style={abs((w - dw) / 2, top, dw, dw * 0.625)} />;
  }
  return (
    <>
      {text}
      {device}
    </>
  );
}

// ---------------------------------------------------------------------------
// Testimonial, Key Figures, Event
// ---------------------------------------------------------------------------

/** Round photo from a screenshot slot, or the person's initials on the brand colour. */
function Avatar({ ctx, index, size, name }: { ctx: Ctx; index: number; size: number; name?: string }) {
  const slot = ctx.shots[index];
  const url = slot ? ctx.urls[slot.assetId] : undefined;
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <div
      style={{
        position: 'relative',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: ctx.pal.primary,
        color: ctx.pal.onPrimary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        boxShadow: `0 0 0 ${Math.max(2, size * 0.05)}px ${ctx.pal.surface}`,
      }}
    >
      {url ? <ImageBox ctx={ctx} slot={slot} index={index} /> : initials}
    </div>
  );
}

function Testimonial(ctx: Ctx) {
  const { w, h, u, o, pal, wide, p } = ctx;
  const { quote, author, authorRole } = p.content;
  const len = Math.max(1, quote.length);
  const base = o === 'portrait' ? 7.2 : o === 'square' ? 6.6 : wide ? 7 : 6.4;
  const qSize = u * base * Math.min(1, Math.max(0.55, Math.sqrt(90 / len)));
  const avatar = u * (wide ? 12 : 11);
  const center = o !== 'landscape' || wide ? false : true;
  const block: CSSProperties = wide
    ? leftColumn(ctx, 0.88)
    : o === 'landscape'
      ? { position: 'absolute', left: w * 0.1, right: w * 0.1, top: 0, bottom: 0, justifyContent: 'center' }
      : { position: 'absolute', left: w * 0.09, right: w * 0.09, top: 0, bottom: 0, justifyContent: 'center' };
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: center ? w / 2 - u * 9 : w * 0.06,
          top: h * (o === 'portrait' ? 0.12 : 0.02),
          fontFamily: FONT_STACKS.serif,
          fontSize: u * (wide ? 30 : 40),
          lineHeight: 1,
          color: withAlpha(pal.primary, 0.14),
          fontWeight: 400,
          // The oversized pale quote mark is part of the Soft look only.
          display: ctx.style.glow ? undefined : 'none',
        }}
      >
        “
      </span>
      <TextBlock ctx={ctx} align={center ? 'center' : 'left'} style={block} showTitle={false} subtitle={false}>
        <blockquote
          style={{
            margin: 0,
            fontFamily: ctx.heading,
            fontSize: qSize,
            lineHeight: 1.22,
            fontWeight: ctx.heading === FONT_STACKS.serif ? 400 : ctx.style.heading ? Math.min(ctx.style.titleWeight, 650) : 650,
            fontStretch: ctx.style.titleStretch,
            letterSpacing: '-0.015em',
            color: pal.text,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
          }}
        >
          “{quote}”
        </blockquote>
        {(author.trim() || authorRole.trim()) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: u * 2, marginTop: u * 1.5, textAlign: 'left' }}>
            <Avatar ctx={ctx} index={0} size={avatar} name={author} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: u * 0.4, minWidth: 0 }}>
              <span style={{ fontSize: u * (wide ? 4.4 : 3.4), fontWeight: 700, color: pal.text }}>{author}</span>
              {authorRole.trim() && <span style={{ fontSize: u * (wide ? 3.6 : 2.8), color: pal.textMuted }}>{authorRole}</span>}
            </div>
          </div>
        )}
      </TextBlock>
    </>
  );
}

function Stats(ctx: Ctx) {
  const { w, h, u, o, pal, wide, p } = ctx;
  const items = p.content.stats.filter((s) => s.value.trim()).slice(0, 4);
  const portrait = o === 'portrait';
  const columns = wide ? Math.max(1, items.length) : items.length <= 2 && o === 'landscape' ? 1 : 2;
  const vSize = u * (portrait ? 11 : o === 'square' ? 9 : wide ? 10 : 8.4);
  const card = (s: { value: string; label: string }, i: number) => (
    <div
      key={i}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: u * 0.6,
        padding: `${u * 2}px ${u * 2.4}px`,
        borderRadius: ctx.radius,
        background: pal.surface,
        border: ctx.edge,
        boxShadow: smallCardShadow(ctx),
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: ctx.heading,
          fontSize: vSize,
          lineHeight: 1,
          fontWeight: ctx.heading === FONT_STACKS.serif ? 400 : 800,
          fontStretch: ctx.style.titleStretch,
          letterSpacing: '-0.03em',
          color: ctx.style.brandBackground ? pal.text : pal.primary,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {s.value}
      </span>
      {s.label.trim() && <span style={{ fontSize: vSize * 0.3, lineHeight: 1.3, color: pal.textMuted, fontWeight: 550 }}>{s.label}</span>}
    </div>
  );
  const grid = (style: CSSProperties) => (
    <div
      style={{
        position: 'absolute',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        alignContent: 'center',
        gap: u * 1.8,
        ...style,
      }}
    >
      {items.map(card)}
    </div>
  );
  if (wide) {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, 0.3)} scale={0.85} subtitle={false} />
        {grid({ left: w * 0.38, right: w * 0.04, top: h * 0.12, bottom: h * 0.12 })}
      </>
    );
  }
  if (o === 'landscape') {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, 0.38)} />
        {grid({ left: w * 0.5, right: w * 0.06, top: h * 0.08, bottom: h * 0.08 })}
      </>
    );
  }
  return stackText(ctx, grid({ position: 'relative' }));
}

const EVENT_ICONS = {
  date: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  time: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 7v5l3 2',
  place: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
};

function EventTemplate(ctx: Ctx) {
  const { w, h, u, o, pal, wide, p } = ctx;
  const { eventDate, eventTime, eventPlace, cta } = p.content;
  const speakers = ctx.shots.slice(0, 3).filter(Boolean).length;
  const fs = u * (o === 'portrait' ? 3.6 : o === 'square' ? 3.1 : wide ? 4.4 : 3.5);
  const rows = (
    [
      ['date', eventDate],
      ['time', eventTime],
      ['place', eventPlace],
    ] as const
  ).filter(([, v]) => v.trim());
  // The panel is as tall as its content and centred vertically on `mid`.
  const panel = (style: CSSProperties, mid: number) => (
    <div
      style={{
        position: 'absolute',
        top: mid,
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: fs * 0.9,
        padding: fs * 1.4,
        borderRadius: ctx.radius * 1.4,
        background: pal.surface,
        border: ctx.edge,
        boxShadow: ctx.shadow,
        ...style,
      }}
    >
      {rows.map(([icon, value]) => (
        <div key={icon} style={{ display: 'flex', alignItems: 'center', gap: fs * 0.7, minWidth: 0 }}>
          <span
            style={{
              flex: 'none',
              width: fs * 1.9,
              height: fs * 1.9,
              borderRadius: fs * 0.5,
              background: pal.primarySoft,
              color: pal.primaryStrong,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width={fs * 1.1} height={fs * 1.1} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d={EVENT_ICONS[icon]} />
            </svg>
          </span>
          <span style={{ fontSize: fs, fontWeight: icon === 'date' ? 750 : 600, color: pal.text, overflowWrap: 'break-word', minWidth: 0 }}>{value}</span>
        </div>
      ))}
      {(speakers > 0 || cta.trim()) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: fs, marginTop: fs * 0.3 }}>
          <div style={{ display: 'flex' }}>
            {Array.from({ length: speakers }, (_, i) => (
              <div key={i} style={{ marginLeft: i ? -fs * 0.7 : 0 }}>
                <Avatar ctx={ctx} index={i} size={fs * 2.6} />
              </div>
            ))}
          </div>
          {cta.trim() && (
            <span
              style={{
                fontSize: fs * 0.95,
                fontWeight: 700,
                padding: `${fs * 0.55}px ${fs * 1.1}px`,
                borderRadius: fs * 3,
                background: pal.primary,
                color: pal.onPrimary,
                whiteSpace: 'nowrap',
              }}
            >
              {cta}
            </span>
          )}
        </div>
      )}
    </div>
  );
  if (wide) {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, 0.46)} scale={0.85} subtitle={false} />
        {panel({ left: w * 0.56, right: w * 0.04 }, h / 2)}
      </>
    );
  }
  if (o === 'landscape') {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, 0.46)} />
        {panel({ left: w * 0.56, right: w * 0.06 }, h / 2)}
      </>
    );
  }
  const portrait = o === 'portrait';
  return (
    <>
      <TextBlock ctx={ctx} align="center" style={topBlock(ctx)} subtitle={portrait} />
      {panel({ left: w * 0.1, right: w * 0.1 }, h * (portrait ? 0.62 : 0.7))}
    </>
  );
}

function CheckBadge({ size, bg, fg }: { size: number; bg: string; fg: string }) {
  return (
    <span style={{ flex: 'none', width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke={fg} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 10 17.5 19 7" />
      </svg>
    </span>
  );
}

function Features(ctx: Ctx) {
  const { w, h, o, u, pal, wide, p } = ctx;
  const items = p.content.features.filter((f) => f.trim()).slice(0, 4);
  const size = u * (o === 'portrait' ? 4.6 : o === 'square' ? 3.8 : wide ? 2.8 : 3.3);
  const card = (txt: string, i: number) => (
    <div
      key={i}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: u * 1.6,
        padding: `${u * 1.5}px ${u * 2}px`,
        borderRadius: ctx.radius,
        background: pal.surface,
        border: ctx.edge,
        boxShadow: smallCardShadow(ctx),
        minWidth: 0,
      }}
    >
      <CheckBadge size={size * 1.45} bg={pal.primary} fg={pal.onPrimary} />
      <span style={{ fontSize: size, fontWeight: 600, lineHeight: 1.25, color: pal.text, overflowWrap: 'break-word', minWidth: 0 }}>{txt}</span>
    </div>
  );
  const list = (style: CSSProperties, columns = 1) => (
    <div
      style={{
        position: 'absolute',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        alignContent: 'center',
        gap: u * 1.6,
        ...style,
      }}
    >
      {items.map(card)}
    </div>
  );
  if (wide) {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, 0.34)} scale={0.9} />
        {list({ left: w * 0.42, right: w * 0.04, top: h * 0.1, bottom: h * 0.1 }, 2)}
      </>
    );
  }
  if (o === 'landscape') {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, 0.4)} />
        {list({ left: w * 0.52, right: w * 0.06, top: h * 0.08, bottom: h * 0.08 })}
      </>
    );
  }
  return stackText(ctx, list({ position: 'relative' }));
}

// --- Steps and Comparison --------------------------------------------------------

/** Positions a content-sized block (list, table) beside or below the text, like Features does. */
/**
 * Text above a content-sized block (list, table) in square and portrait formats. One flex column,
 * so a long title pushes the block down instead of running into it; Text position Bottom reverses it.
 */
function stackText(ctx: Ctx, body: ReactNode, textScale = 1) {
  const { w, h, u, o } = ctx;
  const portrait = o === 'portrait';
  return (
    <div
      style={{
        position: 'absolute',
        left: w * 0.07,
        right: w * 0.07,
        top: h * (portrait ? 0.11 : 0.07),
        bottom: h * (portrait ? 0.1 : 0.05),
        display: 'flex',
        flexDirection: ctx.flipY ? 'column-reverse' : 'column',
        gap: u * (portrait ? 5 : 3.5),
      }}
    >
      <TextBlock ctx={ctx} align="center" style={{ flex: 'none' }} subtitle={portrait} scale={textScale} />
      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{body}</div>
    </div>
  );
}

function placeBeside(ctx: Ctx, body: ReactNode, textScale = 1) {
  const { w, h, o, wide } = ctx;
  const box = (style: CSSProperties) => (
    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', justifyContent: 'center', ...style }}>{body}</div>
  );
  if (wide) {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, 0.3)} scale={0.85 * textScale} subtitle={false} />
        {box({ left: w * 0.38, right: w * 0.04, top: h * 0.1, bottom: h * 0.1 })}
      </>
    );
  }
  if (o === 'landscape') {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, 0.36)} scale={textScale} />
        {box({ left: w * 0.45, right: w * 0.05, top: h * 0.06, bottom: h * 0.06 })}
      </>
    );
  }
  return stackText(ctx, body, textScale);
}

/** Brand-coloured disc (black on Bold's brand ground). */
const badgeColors = (ctx: Ctx) =>
  ctx.style.brandBackground ? { bg: BOLD_INK, fg: HW.onDark } : { bg: ctx.pal.primary, fg: ctx.pal.onPrimary };

function Steps(ctx: Ctx) {
  const { u, o, pal, wide, p } = ctx;
  const items = p.content.steps.filter((st) => st.title.trim() || st.text.trim()).slice(0, 5);
  const row = wide; // banners read left to right
  const size = u * (o === 'portrait' ? 3.6 : o === 'square' ? 3.1 : wide ? 4.6 : 3.3) * (items.length > 3 ? 0.86 : 1);
  const badge = badgeColors(ctx);
  const step = (st: Step, i: number) => (
    <div key={i} style={{ display: 'flex', flexDirection: row ? 'column' : 'row', gap: size * 0.75, minWidth: 0 }}>
      <span
        style={{
          flex: 'none',
          width: size * 2,
          height: size * 2,
          borderRadius: '50%',
          background: badge.bg,
          color: badge.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 1.05,
          fontWeight: 750,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {i + 1}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: size * 0.25, minWidth: 0, paddingTop: row ? 0 : size * 0.2 }}>
        {st.title.trim() && (
          <span style={{ fontFamily: ctx.heading, fontSize: size * 1.12, fontWeight: ctx.heading === FONT_STACKS.serif ? 400 : 700, lineHeight: 1.2, color: pal.text, overflowWrap: 'break-word' }}>
            {st.title}
          </span>
        )}
        {st.text.trim() && <span style={{ fontSize: size * 0.82, lineHeight: 1.32, color: pal.textMuted, overflowWrap: 'break-word' }}>{st.text}</span>}
      </div>
    </div>
  );
  return placeBeside(
    ctx,
    <div data-steps="" style={{ display: 'grid', gridTemplateColumns: row ? `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))` : '1fr', gap: size * (row ? 1.4 : 1.15) }}>
      {items.map(step)}
    </div>,
  );
}

function Mark({ kind, size, ctx }: { kind: 'yes' | 'no'; size: number; ctx: Ctx }) {
  const badge = badgeColors(ctx);
  const yes = kind === 'yes';
  return (
    <span
      role="img"
      aria-label={yes ? 'Yes' : 'No'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: yes ? badge.bg : 'transparent',
        border: yes ? undefined : `${Math.max(1, size * 0.08)}px solid ${ctx.pal.textMuted}`,
        boxSizing: 'border-box',
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none" stroke={yes ? badge.fg : ctx.pal.textMuted} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        <path d={yes ? 'M5 12.5 10 17.5 19 7' : 'M7 7l10 10M17 7 7 17'} />
      </svg>
    </span>
  );
}

function ComparisonTemplate(ctx: Ctx) {
  const { u, o, pal, wide, p } = ctx;
  const { columns } = p.content.compare;
  const rows = p.content.compare.rows.filter((r) => r.label.trim() || r.cells.some((c) => c.trim()));
  const n = columns.length;
  const fs = u * (o === 'portrait' ? 3.1 : o === 'square' ? 2.7 : wide ? 4 : 3) * (rows.length > 4 ? 0.86 : 1);
  const last = n - 1;
  const hairline = `${Math.max(1, u * 0.1)}px solid ${pal.border}`;
  const r = Math.min(ctx.radius, fs);
  // The recommended (last) column is a tinted band from header to last row.
  const cell = (row: number, col: number, total: number): CSSProperties => {
    const hl = col === last + 1;
    return {
      padding: `${fs * 0.65}px ${fs * 0.7}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: col === 0 ? 'flex-start' : 'center',
      textAlign: col === 0 ? 'left' : 'center',
      minWidth: 0,
      borderBottom: row < total - 1 ? hairline : undefined,
      background: hl ? (row === 0 ? (ctx.style.brandBackground ? BOLD_INK : pal.primary) : pal.primarySoft) : undefined,
      color: hl && row === 0 ? (ctx.style.brandBackground ? HW.onDark : pal.onPrimary) : pal.text,
      borderTopLeftRadius: hl && row === 0 ? r : undefined,
      borderTopRightRadius: hl && row === 0 ? r : undefined,
      borderBottomLeftRadius: hl && row === total - 1 ? r : undefined,
      borderBottomRightRadius: hl && row === total - 1 ? r : undefined,
    };
  };
  const total = rows.length + 1;
  return placeBeside(
    ctx,
    <div
      data-compare=""
      role="table"
      style={{
        display: 'grid',
        gridTemplateColumns: `minmax(0, 1.5fr) repeat(${n}, minmax(0, 1fr))`,
        padding: fs * 0.8,
        borderRadius: ctx.radius,
        background: pal.surface,
        border: ctx.edge,
        boxShadow: smallCardShadow(ctx),
        fontSize: fs,
        lineHeight: 1.25,
      }}
    >
      <div role="row" style={{ display: 'contents' }}>
        <span role="columnheader" style={cell(0, 0, total)} />
        {columns.map((c, j) => (
          <span key={j} role="columnheader" style={{ ...cell(0, j + 1, total), fontWeight: 700, fontSize: fs * 0.92 }}>
            {c}
          </span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} role="row" style={{ display: 'contents' }}>
          <span role="rowheader" style={{ ...cell(i + 1, 0, total), fontWeight: 600 }}>
            {row.label}
          </span>
          {row.cells.map((c, j) => {
            const mark = compareMark(c);
            return (
              <span key={j} role="cell" style={{ ...cell(i + 1, j + 1, total), fontWeight: j === last ? 700 : 500 }}>
                {mark === 'text' ? c : <Mark kind={mark} size={fs * 1.45} ctx={ctx} />}
              </span>
            );
          })}
        </div>
      ))}
    </div>,
    0.92,
  );
}

// --- Code ---------------------------------------------------------------------

const KEYWORDS = new Set(
  'const let var function return import from export default if else for while do switch case break continue class new await async type interface extends implements public private protected static readonly enum def in of as try catch finally throw yield lambda with pass elif and or not is using namespace void true false null undefined None True False this self'.split(
    ' ',
  ),
);
const TOKEN = /(\/\/.*$|#.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*)/g;

type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'fn';

/** Tiny line-based highlighter: deterministic, no dependency, good enough for a visual. */
function tokenize(line: string): { text: string; kind: TokenKind }[] {
  const out: { text: string; kind: TokenKind }[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const t = m[0];
    const i = m.index ?? 0;
    if (i > last) out.push({ text: line.slice(last, i), kind: 'plain' });
    let kind: TokenKind = 'plain';
    if (t.startsWith('//') || t.startsWith('#')) kind = 'comment';
    else if (/^["'`]/.test(t)) kind = 'string';
    else if (/^\d/.test(t)) kind = 'number';
    else if (KEYWORDS.has(t)) kind = 'keyword';
    else if (line[i + t.length] === '(') kind = 'fn';
    out.push({ text: t, kind });
    last = i + t.length;
  }
  if (last < line.length) out.push({ text: line.slice(last), kind: 'plain' });
  return out;
}

function CodeWindow({
  ctx,
  box,
  maxFont,
  valign = 'center',
}: {
  ctx: Ctx;
  box: { left: number; top: number; width: number; height: number };
  maxFont: number;
  valign?: 'center' | 'top';
}) {
  const { u, pal, p } = ctx;
  const theme: Record<TokenKind, string> & { bg: string; bar: string; gutter: string } = {
    bg: '#0f1117',
    bar: '#171a23',
    gutter: '#4b5263',
    plain: '#e6e8ef',
    comment: '#6b7280',
    string: '#a5e075',
    number: '#f7a26c',
    keyword: mix(pal.primary, '#ffffff', 0.45),
    fn: '#82aaff',
  };
  const bar = u * 3.6;
  const pad = u * 2.4;
  const code = p.content.code.replace(/\s+$/, '') || ' ';
  const lines = code.split('\n');
  const fontSize = fitCodeFontSize(code, box.width - pad * 2, box.height - bar - pad * 2, maxFont);
  // Shrink the window to its content so short snippets do not float in an empty editor.
  const height = Math.min(box.height, bar + pad * 2 + lines.length * fontSize * CODE_LINE_HEIGHT + 2);
  const top = valign === 'center' ? box.top + (box.height - height) / 2 : box.top;
  const dot = u * 1.05;
  return (
    <div
      style={{
        ...abs(box.left, top, box.width, height),
        display: 'flex',
        flexDirection: 'column',
        borderRadius: ctx.radius,
        overflow: 'hidden',
        background: theme.bg,
        boxShadow: ctx.shadow,
        border: `${Math.max(1, u * 0.12)}px solid rgba(255,255,255,0.08)`,
      }}
    >
      <div style={{ height: bar, flex: 'none', display: 'flex', alignItems: 'center', gap: dot * 0.7, padding: `0 ${u * 1.6}px`, background: theme.bar }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} style={{ width: dot, height: dot, borderRadius: '50%', background: c, flex: 'none' }} />
        ))}
        {p.content.codeFile.trim() && (
          <span
            style={{
              marginLeft: u * 1.6,
              padding: `${u * 0.5}px ${u * 1.4}px`,
              borderRadius: u * 0.8,
              background: theme.bg,
              color: HW.codeTab,
              fontFamily: FONT_STACKS.mono,
              fontSize: u * 1.6,
              whiteSpace: 'nowrap',
            }}
          >
            {p.content.codeFile}
          </span>
        )}
      </div>
      <div style={{ flex: 1, padding: pad, overflow: 'hidden', fontFamily: FONT_STACKS.mono, fontSize, lineHeight: CODE_LINE_HEIGHT, color: theme.plain }}>
        {lines.map((line, i) => (
          <div key={i} style={{ whiteSpace: 'pre', display: 'flex' }}>
            <span style={{ width: '2ch', marginRight: '1.5ch', textAlign: 'right', color: theme.gutter, flex: 'none', userSelect: 'none' }}>{i + 1}</span>
            <span>
              {tokenize(line).map((t, j) => (
                <span key={j} style={{ color: theme[t.kind], fontStyle: t.kind === 'comment' ? 'italic' : undefined }}>
                  {t.text}
                </span>
              ))}
              {line === '' ? ' ' : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Code(ctx: Ctx) {
  const { w, h, o, wide } = ctx;
  if (o === 'landscape') {
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, wide ? 0.3 : 0.34)} scale={0.9} />
        <CodeWindow ctx={ctx} maxFont={ctx.u * 3} box={{ left: w * (wide ? 0.37 : 0.42), top: h * 0.08, width: w * (wide ? 0.59 : 0.54), height: h * 0.84 }} />
      </>
    );
  }
  const portrait = o === 'portrait';
  return (
    <>
      <TextBlock ctx={ctx} align="center" style={topBlock(ctx)} scale={0.9} subtitle={portrait} />
      <CodeWindow
        ctx={ctx}
        maxFont={ctx.u * (portrait ? 4 : 3.4)}
        valign={portrait ? 'center' : 'top'}
        box={{ left: w * 0.05, top: h * (portrait ? 0.36 : 0.36), width: w * 0.9, height: h * (portrait ? 0.46 : 0.58) }}
      />
    </>
  );
}

// --- Annotated Panel ------------------------------------------------------------

/**
 * Legend of the numbered fields already drawn in the screenshot. Badge i answers the
 * image's badge i; a hollow badge marks a field that is disabled in the capture.
 */
function Legend({ ctx, items, fontSize, columns }: { ctx: Ctx; items: LegendItem[]; fontSize: number; columns: number }) {
  const { pal } = ctx;
  const fs = fontSize;
  const badge = fs * 1.5;
  return (
    <ol
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoFlow: columns > 1 ? 'row' : undefined,
        columnGap: fs * 1.6,
        rowGap: fs * 0.62,
        alignContent: 'start',
        minWidth: 0,
      }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: fs * 0.7, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              flex: 'none',
              width: badge,
              height: badge,
              borderRadius: '50%',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: fs * (i >= 9 ? 0.72 : 0.82),
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              background: item.off ? 'transparent' : pal.primary,
              color: item.off ? pal.textMuted : pal.onPrimary,
              border: item.off ? `${Math.max(1, fs * 0.11)}px solid ${pal.textMuted}` : undefined,
            }}
          >
            {i + 1}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingTop: (badge - fs * 1.25) / 2 }}>
            <span style={{ fontSize: fs, fontWeight: 600, lineHeight: 1.25, color: item.off ? pal.textMuted : pal.text, overflowWrap: 'break-word' }}>
              {item.label || item.prop}
            </span>
            {item.prop && item.label && (
              <span
                style={{
                  fontFamily: FONT_STACKS.mono,
                  fontSize: fs * 0.74,
                  lineHeight: 1.3,
                  color: pal.textMuted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.prop}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Aspect ratio of the visible (cropped) part of a screenshot. */
function shotRatio(ctx: Ctx, slot: ScreenshotSlot | undefined, fallback: number): number {
  const asset = slot && ctx.p.assets.find((a) => a.id === slot.assetId);
  if (!slot || !asset || asset.width <= 0 || asset.height <= 0) return fallback;
  const c = slot.crop ?? NO_CROP;
  return (asset.width * (1 - c.left - c.right)) / (asset.height * (1 - c.top - c.bottom));
}

/**
 * A settings panel (or any UI with numbered call-outs) next to its legend. The screenshot keeps
 * its own proportions, uncropped.
 *   Landscape: the shot runs the full height on the left; title and legend share the right.
 *   Portrait and square: title on top; tall shots sit beside the legend, wide ones above it.
 */
function Annotated(ctx: Ctx) {
  const { w, h, o, u } = ctx;
  const slot = ctx.shots[0];
  const items = slot?.legend ?? [];
  const hasLegend = items.length > 0;
  const ratio = shotRatio(ctx, slot, 0.6);
  const pad = u * (o === 'portrait' ? 6.5 : 5.5);
  const gap = u * (o === 'portrait' ? 4 : 3.5);
  const beside = o === 'landscape';
  // Rough room for each part (the text block grows with the title).
  const textH = h * (beside ? 0.3 : o === 'portrait' ? 0.2 : 0.24);
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const bodyH = beside ? innerH : innerH - textH - gap;
  // Portrait and square: beside the legend when the shot is tall, above it when wide.
  const side = beside || !hasLegend || ratio < 1.25;
  const imgW = beside
    ? clamp(innerH * ratio, w * 0.18, w * (hasLegend ? 0.5 : 0.55))
    : hasLegend && side
      ? clamp(bodyH * ratio, innerW * 0.28, innerW * 0.6)
      : innerW;
  const legendW = side ? innerW - imgW - gap : innerW;
  // Under a wide shot the legend may take up to 45% of the height, then the shot takes the rest.
  const legendH = beside ? innerH - textH - gap : side ? bodyH : bodyH * 0.45;
  const ROW = 2.85; // height of one legend row, in font sizes
  const maxFont = u * (o === 'portrait' ? 2.6 : 2.2);
  const fontFor = (cols: number) => clamp(legendH / (Math.ceil(items.length / cols) * ROW), u * 1.25, maxFont);
  // More columns only while one would shrink the text and each column stays wide enough.
  let columns = 1;
  while (columns < (beside ? 3 : 2) && items.length > 4 * columns && fontFor(columns) < maxFont * 0.95 && legendW / (columns + 1) > maxFont * 10) {
    columns++;
  }
  const fontSize = fontFor(columns);
  const legendNeed = Math.min(legendH, Math.ceil(items.length / columns) * ROW * fontSize);
  // Stacked: the shot is only as tall as it needs, so the legend follows it directly.
  const stackedImgH = Math.max(bodyH * 0.3, Math.min(bodyH - legendNeed - gap, innerW / ratio));
  const textScale = ctx.wide ? 0.62 : beside ? 0.72 : o === 'square' ? 0.74 : 0.84;
  const n = (v: number) => +v.toFixed(6);

  const image = (
    <div
      style={{
        flex: !side ? `0 0 ${n(stackedImgH)}px` : hasLegend || beside ? `0 0 ${n(imgW)}px` : '1 1 0',
        minWidth: 0,
        minHeight: 0,
        containerType: 'size',
        display: 'flex',
        alignItems: 'center',
        // Stacked shots line up with the title and the legend on the left (right when mirrored).
        justifyContent: side ? 'center' : ctx.layout.mirror ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        data-annotated-shot=""
        style={{
          position: 'relative',
          width: `min(100cqw, 100cqh * ${n(ratio)})`,
          height: `min(100cqh, 100cqw / ${n(ratio)})`,
          borderRadius: ctx.radius,
          overflow: 'hidden',
          background: ctx.pal.surface,
          border: ctx.edge,
          boxShadow: ctx.shadow,
        }}
      >
        <ImageBox ctx={ctx} slot={slot && { ...slot, fit: 'cover' }} index={0} />
      </div>
    </div>
  );

  const legend = hasLegend && (
    <div
      data-legend=""
      style={{
        flex: beside ? '0 1 auto' : '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: side && !beside ? 'center' : 'flex-start',
      }}
    >
      <Legend ctx={ctx} items={items} fontSize={fontSize} columns={columns} />
    </div>
  );

  const text = <TextBlock ctx={ctx} scale={textScale} style={{ flex: 'none' }} />;
  const root: CSSProperties = { position: 'absolute', inset: 0, padding: pad, display: 'flex', gap };

  const mirror = ctx.layout.mirror;
  const textLast = ctx.layout.textPosition === 'bottom';
  if (beside) {
    return (
      <div style={{ ...root, flexDirection: mirror ? 'row-reverse' : 'row' }}>
        {image}
        <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: textLast ? 'column-reverse' : 'column', justifyContent: 'center', gap: gap * 0.8 }}>
          {text}
          {legend}
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...root, flexDirection: textLast ? 'column-reverse' : 'column' }}>
      {text}
      <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: side ? (mirror ? 'row-reverse' : 'row') : 'column', gap }}>
        {image}
        {legend}
      </div>
    </div>
  );
}

// --- Detail Zoom and Cover ------------------------------------------------------------

/**
 * The whole screenshot, and a lens that enlarges its focal point. A ring on the screenshot marks
 * the area shown in the lens. Mirror and text position are handled here: the lens must stay
 * over the right spot, so the boxes cannot be mirrored one by one.
 */
function DetailZoom(ctx: Ctx) {
  const { w, h, o, u, pal, wide } = ctx;
  const slot = ctx.shots[0];
  const ratio = shotRatio(ctx, slot, 1.6);
  const mirror = ctx.layout.mirror;
  let text: CSSProperties;
  let area: { x: number; y: number; w: number; h: number };
  let align: 'left' | 'center' = 'left';
  if (o === 'landscape') {
    text = leftColumn(ctx, wide ? 0.3 : 0.34);
    const x = w * (wide ? 0.38 : 0.42);
    area = { x, y: h * 0.08, w: w * 0.96 - x, h: h * 0.84 };
    if (mirror) {
      text = mirrorX(text, w);
      area = { ...area, x: w - area.x - area.w };
    }
  } else if (o === 'portrait') {
    // The screenshot right under the text, so no gap opens between them (the area is the card itself).
    align = 'center';
    const cw = Math.min(w * 0.76, h * 0.4 * ratio);
    // Room for the ring drawn around the focal point, which can sit on the top edge.
    const ringRoom = Math.min(Math.min(cw, cw / ratio) * 0.66, Math.min(w, h) * 0.5) / (ctx.p.content.magnify || 2.5) / 2;
    const stack = portraitStack(ctx, cw / ratio, 0.9, ringRoom);
    text = stack.text;
    area = { x: (w - cw / 0.86) / 2, y: stack.top - (cw / ratio) * (1 / 0.86 - 1) / 2, w: cw / 0.86, h: cw / ratio / 0.86 };
    if (ctx.flipY) {
      text = mirrorY(text, ctx, false);
      area = { ...area, y: h - area.y - area.h };
    }
  } else {
    align = 'center';
    text = topBlock(ctx);
    area = { x: w * 0.06, y: h * 0.42, w: w * 0.88, h: h * 0.54 };
    if (ctx.flipY) {
      text = mirrorY(text, ctx, false);
      area = { ...area, y: h - area.y - area.h };
    }
  }
  // The screenshot keeps its proportions; the lens may overhang it.
  const fw = Math.min(area.w * 0.86, area.h * 0.86 * ratio);
  const fh = fw / ratio;
  const fl = area.x + (area.w - fw) / 2;
  const ft = area.y + (area.h - fh) / 2;
  const asset = slot && ctx.p.assets.find((a) => a.id === slot.assetId);
  const crop = slot?.crop ?? NO_CROP;
  const cw = asset ? asset.width * (1 - crop.left - crop.right) : 1;
  const magnify = ctx.p.content.magnify || 2.5;
  // Source pixel → screen pixel in the card (fit cover at the card's own ratio, then zoom).
  const scale = (fw / cw) * (slot?.zoom ?? 1);
  const fx = slot?.focalX ?? 0.5;
  const fy = slot?.focalY ?? 0.5;
  const L = Math.min(Math.min(fw, fh) * 0.66, Math.min(w, h) * 0.5);
  const ring = L / magnify;
  const spotX = fl + fx * fw;
  const spotY = ft + fy * fh;
  // The lens overhangs a corner of the screenshot: on the side away from the text, and away from the
  // spot along the other axis, so it covers neither. Kept on the canvas.
  const margin = u * 2;
  const right = o === 'landscape' ? !mirror : fx < 0.5;
  const below = o === 'landscape' ? fy < 0.5 : !ctx.flipY;
  const lx = clamp(right ? fl + fw - L * 0.45 : fl - L * 0.55, margin, w - L - margin);
  const ly = clamp(below ? ft + fh - L * 0.55 : ft - L * 0.45, margin, h - L - margin);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TextBlock ctx={ctx} align={align} style={text} scale={o === 'landscape' ? 0.95 : 0.9} subtitle={o !== 'square'} />
      <Card ctx={ctx} index={0} style={abs(fl, ft, fw, fh, { position: 'absolute' })} />
      {slot && asset && (
        <>
          <span
            data-zoom-ring=""
            style={abs(spotX - ring / 2, spotY - ring / 2, ring, ring, {
              borderRadius: '50%',
              boxSizing: 'border-box',
              border: `${Math.max(2, u * 0.45)}px solid ${pal.primary}`,
              boxShadow: `0 0 0 ${Math.max(1, u * 0.25)}px ${withAlpha(pal.surface, 0.9)}`,
            })}
          />
          <Lens ctx={ctx} slot={slot} size={L} scale={scale * magnify} style={abs(lx, ly, L, L)} />
        </>
      )}
    </div>
  );
}

/** A full-bleed image under a dark veil; the headline sits on the veil (bottom, or top with Text position Top). */
function Cover(ctx: Ctx) {
  const { w, h, o, wide, pal } = ctx;
  const top = ctx.layout.textPosition === 'top';
  const hasShot = !!ctx.shots[0];
  const v = HW.veil;
  const veil = `linear-gradient(${top ? 180 : 0}deg, rgba(${v},0.86) 0%, rgba(${v},0.55) 35%, rgba(${v},0) ${o === 'portrait' ? 65 : 80}%)`;
  const on = HW.onDark;
  return (
    <>
      <div style={abs(0, 0, w, h, { background: hasShot ? HW.bezel : `linear-gradient(135deg, ${pal.primary}, ${mix(pal.primary, pal.accent, 0.6)})` })}>
        {hasShot && <ImageBox ctx={ctx} slot={ctx.shots[0]} index={0} />}
      </div>
      <div style={abs(0, 0, w, h, { background: veil })} />
      <TextBlock
        ctx={ctx}
        scale={wide ? 0.85 : 1.05}
        colors={{ text: on, muted: withAlpha(on, 0.86), kickerBg: withAlpha(on, 0.18), kickerText: on }}
        style={{
          position: 'absolute',
          left: w * (wide ? 0.04 : 0.07),
          right: w * (wide ? 0.4 : 0.12),
          [top ? 'top' : 'bottom']: h * (o === 'portrait' ? 0.16 : 0.09),
        }}
      />
    </>
  );
}

// --- Call to Action ---------------------------------------------------------------

// Links can hold any character: encode them as UTF-8 rather than the library's default Latin-1.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

/** A QR code on a white tile with its quiet zone, dark on light whatever the theme so phones read it. */
function QrCode({ ctx, text, size, style }: { ctx: Ctx; text: string; size: number; style?: CSSProperties }) {
  let d = '';
  let n = 21;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    n = qr.getModuleCount();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  } catch {
    return null; // too long to encode: the link is still written next to it
  }
  const pad = size * 0.07;
  return (
    <div
      data-qr=""
      style={{
        width: size,
        height: size,
        boxSizing: 'border-box',
        padding: pad,
        background: HW.onDark,
        borderRadius: Math.min(ctx.radius, size * 0.06),
        border: ctx.edge,
        boxShadow: smallCardShadow(ctx),
        flex: 'none',
        ...style,
      }}
    >
      <svg viewBox={`0 0 ${n} ${n}`} width="100%" height="100%" shapeRendering="crispEdges" style={{ display: 'block' }}>
        <path d={d} fill={HW.bezel} />
      </svg>
    </div>
  );
}

function Cta(ctx: Ctx) {
  const { w, h, u, o, pal, p, wide } = ctx;
  const { cta, link } = p.content;
  const url = link.trim();
  const showQr = p.content.qr && !!url;
  // With the footer on, the link is already written there.
  const showLink = !!url && !ctx.footer;
  const fs = u * (o === 'portrait' ? 3.6 : wide ? 4.6 : o === 'square' ? 3.4 : 3.2);
  const button = cta.trim() && (
    <span
      style={{
        fontSize: fs,
        fontWeight: 700,
        padding: `${fs * 0.6}px ${fs * 1.3}px`,
        borderRadius: ctx.style.kicker === 'label' ? 0 : fs * 3,
        background: ctx.style.brandBackground ? BOLD_INK : pal.primary,
        color: ctx.style.brandBackground ? HW.onDark : pal.onPrimary,
        border: ctx.style.edge === 'thick' ? ctx.edge : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {cta}
    </span>
  );
  const action = (button || showLink) && (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'inherit', gap: fs * 0.7, marginTop: fs * 0.5 }}>
      {button}
      {showLink && <span style={{ fontSize: fs * 0.82, fontWeight: 600, color: pal.text, overflowWrap: 'anywhere' }}>{url}</span>}
    </div>
  );
  if (o === 'landscape' && showQr) {
    const size = Math.min(h * (wide ? 0.74 : 0.56), w * 0.28);
    return (
      <>
        <TextBlock ctx={ctx} style={leftColumn(ctx, wide ? 0.6 : 0.5)} scale={wide ? 0.85 : 1} after={action} />
        <QrCode ctx={ctx} text={url} size={size} style={abs(w * (wide ? 0.84 : 0.77) - size / 2, (h - size) / 2, size, size)} />
      </>
    );
  }
  // One centred column: the text and its button, then the QR code.
  const pos = ctx.layout.textPosition;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: `${h * (o === 'portrait' ? 0.12 : 0.08)}px ${w * 0.1}px`,
        display: 'flex',
        flexDirection: pos === 'bottom' && showQr ? 'column-reverse' : 'column',
        alignItems: 'center',
        justifyContent: pos === 'auto' || showQr ? 'center' : pos === 'top' ? 'flex-start' : 'flex-end',
        gap: u * 5,
      }}
    >
      <TextBlock ctx={ctx} align="center" scale={wide ? 0.85 : 1.05} after={action} style={{ alignSelf: 'stretch' }} />
      {showQr && <QrCode ctx={ctx} text={url} size={Math.min(w * 0.36, h * (o === 'portrait' ? 0.24 : 0.3))} />}
    </div>
  );
}

const TEMPLATE_COMPONENTS: Record<string, (ctx: Ctx) => ReactNode> = {
  'browser-hero': BrowserHero,
  'browser-duo': BrowserDuo,
  'device-mix': DeviceMix,
  'app-store': AppStore,
  testimonial: Testimonial,
  stats: Stats,
  event: EventTemplate,
  features: Features,
  code: Code,
  annotated: Annotated,
  'mobile-trio': MobileTrio,
  bento: Bento,
  spotlight: Spotlight,
  'before-after': BeforeAfter,
  editorial: Editorial,
  cta: Cta,
  'detail-zoom': DetailZoom,
  cover: Cover,
  steps: Steps,
  comparison: ComparisonTemplate,
  minimal: Minimal,
};
