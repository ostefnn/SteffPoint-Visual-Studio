/**
 * The visual renderer. Pure function of (project, size, asset URLs) → DOM.
 * Everything uses inline styles in pixels derived from the canvas size so the
 * exact same tree can be previewed (scaled with CSS) and exported (modern-screenshot).
 */
import type { CSSProperties, ReactNode } from 'react';
import {
  backgroundPeak,
  CODE_LINE_HEIGHT,
  fitCodeFontSize,
  BODY_STACK,
  derivePalette,
  FONT_STACKS,
  getOrientation,
  getTemplate,
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
  type Project,
  type ScreenshotSlot,
} from '@svs/visual-core';

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
  radius: number;
  shadow: string;
  /** Builds a box-shadow from soft layers. */
  softShadow: (layers: ShadowLayer[]) => string;
  shots: (ScreenshotSlot | undefined)[];
}

interface ShadowLayer {
  y: number;
  blur: number;
  alpha: number;
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
}

export function Composition({ project, width, height, urls }: CompositionProps) {
  const pal = derivePalette(project.brand.primary, project.brand.theme);
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
    heading: FONT_STACKS[project.brand.headingFont],
    radius: u * (0.4 + project.brand.radius * 3.6),
    shadow:
      s <= 0.01
        ? 'none'
        : boxShadow([
            { y: u * 0.4, blur: u * 1.2, alpha: (dark ? 0.25 : 0.06) + 0.1 * s },
            { y: u * 2, blur: u * 6, alpha: (dark ? 0.3 : 0.08) + 0.28 * s },
          ]),
    softShadow: boxShadow,
    shots: project.screenshots.slice(0, 4),
  };
  const Template = TEMPLATE_COMPONENTS[getTemplate(project.template).id];
  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: BODY_STACK,
        color: pal.text,
        ...backgroundStyle(ctx),
      }}
    >
      <Template {...ctx} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

function backgroundStyle({ p, pal, u }: Ctx): CSSProperties {
  const { type, intensity: i, angle } = p.background;
  const peak = backgroundPeak(pal, type, i);
  switch (type) {
    case 'solid':
      return { background: pal.bg };
    case 'gradient':
      return { background: `linear-gradient(${angle}deg, ${pal.bg} 0%, ${pal.bg} 25%, ${peak} 100%)` };
    case 'glow':
      return {
        background: [
          `radial-gradient(ellipse 55% 65% at 88% 12%, ${withAlpha(pal.primary, 0.1 + 0.32 * i)}, transparent 70%)`,
          `radial-gradient(ellipse 45% 55% at 8% 100%, ${withAlpha(pal.accent, 0.06 + 0.22 * i)}, transparent 70%)`,
          pal.bg,
        ].join(', '),
      };
    case 'grid': {
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
          `radial-gradient(ellipse 60% 70% at 100% 20%, ${withAlpha(pal.accent, 0.12 + 0.3 * i)}, transparent 65%)`,
          `radial-gradient(ellipse 70% 60% at 50% 110%, ${withAlpha(shiftHue(pal.primary, -35), 0.12 + 0.3 * i)}, transparent 65%)`,
          pal.bg,
        ].join(', '),
      };
  }
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
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background, containerType: 'size' }}>
      <img
        src={url}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          display: 'block',
          maxWidth: 'none',
          width: `calc(${S} * ${W})`,
          height: `calc(${S} * ${H})`,
          left: `calc((100cqw - ${S} * ${n(cw)}) * ${n(slot.focalX)} - ${S} * ${n(W * crop.left)})`,
          top: `calc((100cqh - ${S} * ${n(ch)}) * ${n(slot.focalY)} - ${S} * ${n(H * crop.top)})`,
        }}
      />
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
        border: `${Math.max(1, u * 0.12)}px solid ${pal.border}`,
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
function LaptopFrame({ ctx, index, style }: { ctx: Ctx; index: number; style: CSSProperties }) {
  const W = Number(style.width);
  const base = W * 0.032;
  const lid = W * 0.88;
  const bezel = W * 0.016;
  return (
    <div style={{ ...style, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: lid,
          flex: 1,
          minHeight: 0,
          padding: `${bezel * 1.4}px ${bezel}px ${bezel}px`,
          borderRadius: `${W * 0.022}px ${W * 0.022}px 0 0`,
          background: '#0d0f14',
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
            background: '#2a2e38',
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
          background: 'linear-gradient(#d9dce1, #b4b8bf 60%, #8e939b)',
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
            background: '#a3a8b0',
          }}
        />
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
        background: '#0d0f14',
        boxShadow: ctx.shadow === 'none' ? `0 0 0 ${Math.max(1, ctx.u * 0.15)}px rgba(255,255,255,0.08)` : ctx.shadow,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: width * 0.13, overflow: 'hidden' }}>
        <ImageBox ctx={ctx} slot={ctx.shots[index]} index={index} />
        <div style={{ position: 'absolute', ...island, borderRadius: width, background: '#0d0f14' }} />
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
        background: '#0d0f14',
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
          background: '#2a2e38',
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
        border: `${Math.max(1, ctx.u * 0.12)}px solid ${ctx.pal.border}`,
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
}) {
  const { u, o, pal, p } = ctx;
  const c: TextColors = { text: pal.text, muted: pal.textMuted, kickerBg: pal.primarySoft, kickerText: pal.primaryStrong, ...colors };
  const { kicker, title, subtitle: sub } = p.content;
  const tSize = titleSize(u, o, title.length, scale);
  const center = align === 'center';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: center ? 'center' : 'flex-start',
        textAlign: align,
        gap: u * 1.8 * scale,
        ...style,
      }}
    >
      <Logo ctx={ctx} height={logoHeight(u, p.brand.logoSize ?? 'medium', scale)} />
      {kicker.trim() &&
        (kickerStyle === 'pill' ? (
          <span
            style={{
              fontSize: kickerSize(u, scale),
              fontWeight: 650,
              padding: `${u * 0.7 * scale}px ${u * 1.6 * scale}px`,
              borderRadius: u * 10,
              background: c.kickerBg,
              color: c.kickerText,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            {kicker}
          </span>
        ) : (
          <span style={{ fontSize: kickerSize(u, scale), fontWeight: 700, color: pal.primary, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {kicker}
          </span>
        ))}
      {showTitle && title.trim() && (
        <h1
          style={{
            margin: 0,
            fontFamily: font ?? ctx.heading,
            fontSize: tSize,
            lineHeight: 1.06,
            fontWeight: font === FONT_STACKS.serif || ctx.p.brand.headingFont === 'serif' ? 600 : 760,
            letterSpacing: ctx.p.brand.headingFont === 'mono' ? '-0.03em' : '-0.022em',
            color: c.text,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
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
            fontSize: subtitleSize(u, o, scale),
            lineHeight: 1.38,
            color: c.muted,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            maxWidth: center ? '92%' : '100%',
          }}
        >
          {sub}
        </p>
      )}
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
  const portrait = o === 'portrait';
  return (
    <>
      <TextBlock ctx={ctx} align="center" style={topBlock(ctx)} />
      <BrowserFrame ctx={ctx} index={0} style={abs(w * 0.07, h * (portrait ? 0.46 : 0.47), w * 0.86, h * 0.62)} />
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
          background: `linear-gradient(140deg, ${pal.primary}, ${mix(pal.primary, pal.accent, 0.45)})`,
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
    text = topBlock(ctx);
    frame = abs(w * 0.07, h * 0.43, w * 0.86, h * 0.42);
  }
  const fx = Number(frame.left) + Number(frame.width) / 2;
  const fy = Number(frame.top) + Number(frame.height) / 2;
  const gw = Number(frame.width) * 1.3;
  const gh = Number(frame.height) * 1.2;
  return (
    <>
      <div
        style={abs(fx - gw / 2, fy - gh / 2, gw, gh, {
          background: `radial-gradient(closest-side, ${withAlpha(pal.primary, 0.5)}, ${withAlpha(pal.accent, 0.18)} 55%, transparent)`,
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
        color: after ? pal.onPrimary : '#fff',
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
          border: `${Math.max(1, u * 0.15)}px solid ${pal.border}`,
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
    <div style={{ ...style, overflow: 'hidden', background: `linear-gradient(135deg, ${pal.primary}, ${pal.accent})` }}>
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
          fontWeight: 700,
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
            fontWeight: p.brand.headingFont === 'serif' ? 500 : 650,
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
        border: `${Math.max(1, u * 0.12)}px solid ${pal.border}`,
        boxShadow: ctx.shadow === 'none' ? undefined : ctx.softShadow([{ y: u * 0.3, blur: u * 1.4, alpha: 0.04 + 0.08 * p.brand.shadow }]),
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: ctx.heading,
          fontSize: vSize,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: pal.primary,
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
  return (
    <>
      <TextBlock ctx={ctx} align="center" style={topBlock(ctx)} subtitle={portrait} />
      {grid({ left: w * 0.07, right: w * 0.07, top: h * (portrait ? 0.4 : 0.38), bottom: h * (portrait ? 0.16 : 0.07) })}
    </>
  );
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
        border: `${Math.max(1, u * 0.12)}px solid ${pal.border}`,
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
            <svg viewBox="0 0 24 24" width={fs * 1.1} height={fs * 1.1} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke={fg} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
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
        border: `${Math.max(1, u * 0.12)}px solid ${pal.border}`,
        boxShadow: ctx.shadow === 'none' ? undefined : ctx.softShadow([{ y: u * 0.3, blur: u * 1.4, alpha: 0.04 + 0.08 * p.brand.shadow }]),
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
  const portrait = o === 'portrait';
  return (
    <>
      <TextBlock ctx={ctx} align="center" style={topBlock(ctx)} subtitle={portrait} />
      {list({ left: w * 0.07, right: w * 0.07, top: h * (portrait ? 0.4 : 0.4), bottom: h * (portrait ? 0.2 : 0.06) })}
    </>
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
              color: '#c9cdd8',
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
  'mobile-trio': MobileTrio,
  bento: Bento,
  spotlight: Spotlight,
  'before-after': BeforeAfter,
  editorial: Editorial,
  minimal: Minimal,
};
