import type { ReactNode } from 'react';
import type { FormatPreset, Project } from '@svs/visual-core';
import { Composition } from '../render/Composition';

/** Renders a composition at native size, scaled down with a CSS transform to fit a box. */
export function Stage({
  project,
  format,
  urls,
  maxWidth,
  maxHeight,
  showSafeZones,
  className,
  children,
}: {
  project: Project;
  format: Pick<FormatPreset, 'width' | 'height' | 'safe'>;
  urls: Record<string, string>;
  maxWidth: number;
  maxHeight: number;
  showSafeZones?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const scale = Math.max(0.01, Math.min(maxWidth / format.width, maxHeight / format.height));
  return (
    <div className={className} style={{ width: format.width * scale, height: format.height * scale, position: 'relative', overflow: 'hidden' }}>
      <div style={{ width: format.width, height: format.height, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }}>
        <Composition project={project} width={format.width} height={format.height} urls={urls} />
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
        className="absolute border border-dashed border-rose-500"
        style={{
          top: `${safe.top * 100}%`,
          right: `${safe.right * 100}%`,
          bottom: `${safe.bottom * 100}%`,
          left: `${safe.left * 100}%`,
          boxShadow: '0 0 0 9999px rgba(244, 63, 94, 0.16)',
        }}
      >
        <span className="absolute left-1 top-1 rounded bg-rose-500 px-1 text-[10px] font-semibold text-white">Safe zone</span>
      </div>
    </div>
  );
}
