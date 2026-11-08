/**
 * WebKit (Safari, and every iOS browser) rasterises exports through an SVG foreignObject in which
 * box-shadows are drawn wrong: blur is dropped and border-radius ignored, leaving hard-edged grey
 * rectangles around rounded frames. Before capture, this replaces every outer box-shadow in the
 * export tree with plain rounded <div>s stacked behind the element, which WebKit draws correctly.
 *
 * Each blurred shadow becomes STEPS concentric rounded rectangles, so its edge fades out over the blur
 * radius: from blur/4 inside the box edge to blur/4 outside it (plus spread).
 */
const STEPS = 12;

interface ParsedShadow {
  color: string;
  alpha: number;
  x: number;
  y: number;
  blur: number;
  spread: number;
}

/** Split on commas that are not inside parentheses. */
function splitTop(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(value.slice(start, i));
      start = i + 1;
    }
  }
  out.push(value.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Parse a computed `box-shadow` value ("rgba(0, 0, 0, 0.2) 0px 4px 12px 0px, …"); inset shadows are skipped. */
export function parseBoxShadow(value: string): ParsedShadow[] {
  if (!value || value === 'none') return [];
  return splitTop(value).flatMap((part) => {
    if (/\binset\b/.test(part)) return [];
    const colorMatch = part.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/i);
    if (!colorMatch) return [];
    const rgba = colorMatch[0].match(/[\d.]+/g)?.map(Number) ?? [];
    const alpha = colorMatch[0].startsWith('rgba') ? (rgba[3] ?? 1) : 1;
    const [x = 0, y = 0, blur = 0, spread = 0] = (part.replace(colorMatch[0], '').match(/-?[\d.]+(?=px)/g) ?? []).map(Number);
    if (alpha <= 0) return [];
    const rgb = colorMatch[0].startsWith('#') ? colorMatch[0] : `rgb(${rgba[0] ?? 0}, ${rgba[1] ?? 0}, ${rgba[2] ?? 0})`;
    return [{ color: rgb, alpha, x, y, blur, spread }];
  });
}

/** Corner radius in px from a computed value such as "24px", "24px 12px" or "50%". */
function corner(value: string, w: number, h: number): [number, number] {
  const parts = value.split(/\s+/).filter(Boolean);
  const px = (v: string | undefined, size: number) => (!v ? 0 : v.endsWith('%') ? (parseFloat(v) / 100) * size : parseFloat(v) || 0);
  const rx = px(parts[0], w);
  return [rx, parts[1] ? px(parts[1], h) : px(parts[0], h)];
}

export function flattenShadows(root: HTMLElement): void {
  const elements = [...root.querySelectorAll<HTMLElement>('*')];
  for (const el of elements) {
    const cs = getComputedStyle(el);
    const shadows = parseBoxShadow(cs.boxShadow);
    if (!shadows.length || !el.parentElement) continue;

    // An absolutely positioned probe at (0, 0) gives the origin of the containing block that the
    // shadow divs will share with the element.
    const layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;';
    if (cs.zIndex !== 'auto') layer.style.zIndex = cs.zIndex;
    el.parentElement.insertBefore(layer, el);
    // Paint the element above its shadow: positioned boxes with the same z-index paint in tree order.
    if (cs.position === 'static') el.style.position = 'relative';

    const origin = layer.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const left = box.left - origin.left;
    const top = box.top - origin.top;
    const corners = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((c) =>
      corner(c, box.width, box.height),
    );

    for (const s of shadows) {
      // Stacked translucent layers multiply: pick each layer's opacity so the area covered by all of
      // them gets the shadow's own alpha. A sharp shadow (no blur) needs a single layer.
      const steps = s.blur > 0 ? STEPS : 1;
      const opacity = 1 - Math.pow(1 - s.alpha, 1 / steps);
      for (let i = 0; i < steps; i++) {
        const grow = s.spread + (s.blur / 2) * ((i + 0.5) / steps) - s.blur / 4;
        const w = box.width + grow * 2;
        const h = box.height + grow * 2;
        if (w <= 0 || h <= 0) continue;
        const r = corners.map(([rx, ry]) => [Math.max(0, rx + grow), Math.max(0, ry + grow)]);
        const d = document.createElement('div');
        d.style.cssText = [
          'position:absolute',
          `left:${left + s.x - grow}px`,
          `top:${top + s.y - grow}px`,
          `width:${w}px`,
          `height:${h}px`,
          `border-radius:${r.map(([rx]) => `${rx}px`).join(' ')} / ${r.map(([, ry]) => `${ry}px`).join(' ')}`,
          `background:${s.color}`,
          `opacity:${opacity}`,
        ].join(';');
        layer.appendChild(d);
      }
    }
    el.style.boxShadow = 'none';
  }
}
