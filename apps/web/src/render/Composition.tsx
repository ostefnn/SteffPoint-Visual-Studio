/**
 * The visual renderer. Pure function of (project, size, asset URLs) → DOM.
 * Everything uses inline styles in pixels derived from the canvas size so the
 * exact same tree can be previewed (scaled with CSS) and exported (modern-screenshot).
 */
import type { CSSProperties, ReactNode } from 'react';
import {
  backgroundPeak,
  BODY_STACK,
  derivePalette,
  FONT_STACKS,
  getOrientation,
  getTemplate,
  kickerSize,
  mix,
  shiftHue,
  subtitleSize,
  titleSize,
  withAlpha,
  type Orientation,
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
  shots: (ScreenshotSlot | undefined)[];
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
        : `0 ${u * 0.4}px ${u * 1.2}px rgba(0,0,0,${(dark ? 0.25 : 0.06) + 0.1 * s}), 0 ${u * 2}px ${u * 6}px rgba(0,0,0,${(dark ? 0.3 : 0.08) + 0.28 * s})`,
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
  const pos = `${slot.focalX * 100}% ${slot.focalY * 100}%`;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: slot.fit === 'contain' ? ctx.pal.surface : undefined }}>
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

function BrowserFrame({ ctx, index, style }: { ctx: Ctx; index: number; style: CSSProperties }) {
  const { pal, u, radius, shadow } = ctx;
  const bar = u * 3.6;
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
        <span
          style={{
            marginLeft: u * 2,
            height: bar * 0.52,
            width: '38%',
            borderRadius: bar,
            background: mix(pal.surface, pal.text, 0.08),
          }}
        />
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        <ImageBox ctx={ctx} slot={ctx.shots[index]} index={index} />
      </div>
    </div>
  );
}

function PhoneFrame({ ctx, index, style, width }: { ctx: Ctx; index: number; style: CSSProperties; width: number }) {
  const bezel = width * 0.035;
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
        <div
          style={{
            position: 'absolute',
            top: width * 0.035,
            left: '50%',
            width: width * 0.3,
            height: width * 0.075,
            marginLeft: -width * 0.15,
            borderRadius: width,
            background: '#0d0f14',
          }}
        />
      </div>
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
  return <img src={url} alt="" draggable={false} style={{ height, width: 'auto', maxWidth: height * 5, objectFit: 'contain', display: 'block' }} />;
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
      <Logo ctx={ctx} height={u * 4.6 * Math.max(0.8, scale)} />
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
      {title.trim() && (
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

const TEMPLATE_COMPONENTS: Record<string, (ctx: Ctx) => ReactNode> = {
  'browser-hero': BrowserHero,
  'browser-duo': BrowserDuo,
  'mobile-trio': MobileTrio,
  bento: Bento,
  spotlight: Spotlight,
  'before-after': BeforeAfter,
  editorial: Editorial,
  minimal: Minimal,
};
