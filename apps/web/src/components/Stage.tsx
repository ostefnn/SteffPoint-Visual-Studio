import type { ReactNode } from 'react';
import type { FormatPreset, Project } from '@svs/visual-core';
import { Composition } from '../render/Composition';

/**
 * Renders a composition at native size, scaled down with a CSS transform to fit a box.
 * With `label` the preview is exposed as one image; without it (thumbnails inside labelled
 * buttons) it is hidden from assistive tech, so its headings don't pollute the page outline.
 */
export function Stage({
  project,
  format,
  urls,
  maxWidth,
  maxHeight,
  showSafeZones,
  className,
  children,
  label,
}: {
  project: Project;
  format: Pick<FormatPreset, 'width' | 'height' | 'safe' | 'content'>;
  urls: Record<string, string>;
  maxWidth: number;
  maxHeight: number;
  showSafeZones?: boolean;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const scale = Math.max(0.01, Math.min(maxWidth / format.width, maxHeight / format.height));
  return (
    <div
      className={className}
      {...(label && { role: 'img', 'aria-label': label })}
      style={{ width: format.width * scale, height: format.height * scale, position: 'relative', overflow: 'hidden' }}
    >
      <div
        aria-hidden="true"
        style={{ width: format.width, height: format.height, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }}
      >
        <Composition project={project} width={format.width} height={format.height} urls={urls} content={format.content} />
      </div>
      {showSafeZones && <SafeZoneOverlay safe={format.safe} />}
      {children}
    </div>
  );
}

function SafeZoneOverlay({ safe }: { safe: FormatPreset['safe'] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute border border-dashed border-zone"
        style={{
          top: `${safe.top * 100}%`,
          right: `${safe.right * 100}%`,
          bottom: `${safe.bottom * 100}%`,
          left: `${safe.left * 100}%`,
          boxShadow: '0 0 0 9999px var(--color-zone-dim)',
        }}
      >
        <span className="absolute left-1 top-1 rounded bg-zone px-1 text-[10px] font-semibold text-on-accent">Safe zone</span>
      </div>
    </div>
  );
}
