/**
 * Brand kits: a saved identity (style, colour, theme, type, radius, shadow, logo, footer and link,
 * background, desktop frame) that can be applied to any project in one step.
 * The logo image itself is stored by the app next to the kit; the kit only describes it.
 */
import { migrateProject, uid, type AssetRef, type Background, type Brand, type Project } from './project';
import type { DesktopFrame } from './templates';

export interface BrandKit {
  id: string;
  name: string;
  updatedAt: number;
  /** Everything in Brand except the project-specific logo asset id. */
  brand: Omit<Brand, 'logoAssetId'>;
  background: Background;
  desktopFrame: DesktopFrame;
  /** Website or handle for the footer and the Call to Action page. */
  link: string;
  /** Metadata of the logo saved with the kit, or null. */
  logo: Pick<AssetRef, 'name' | 'mime' | 'width' | 'height' | 'size'> | null;
}

export const KIT_NAME_MAX = 40;

/** A kit from the project's current identity. */
export function brandKitFromProject(project: Project, name: string, id = uid('kit')): BrandKit {
  const { logoAssetId, ...brand } = project.brand;
  const logo = logoAssetId ? project.assets.find((a) => a.id === logoAssetId) : undefined;
  return {
    id,
    name: name.trim().slice(0, KIT_NAME_MAX) || 'Brand kit',
    updatedAt: Date.now(),
    brand,
    // A background photo belongs to the project's files: the kit keeps the ground without it.
    background: { ...project.background, imageAssetId: null, type: project.background.type === 'image' ? 'solid' : project.background.type },
    desktopFrame: project.desktopFrame,
    link: project.content.link,
    logo: logo ? { name: logo.name, mime: logo.mime, width: logo.width, height: logo.height, size: logo.size } : null,
  };
}

/**
 * The project dressed in the kit. `logo` is the asset already stored for this project from the
 * kit's logo, or null to keep the project's logo. A kit without a link keeps the project's link.
 */
export function applyBrandKit(project: Project, kit: BrandKit, logo: AssetRef | null): Project {
  const assets = logo && !project.assets.some((a) => a.id === logo.id) ? [...project.assets, logo] : project.assets;
  return {
    ...project,
    assets,
    // A kit without a logo keeps the project's own.
    brand: { ...kit.brand, logoAssetId: logo ? logo.id : project.brand.logoAssetId },
    background: { ...kit.background },
    desktopFrame: kit.desktopFrame,
    content: { ...project.content, link: kit.link || project.content.link },
  };
}

/** Validate a stored (or imported) kit; invalid values fall back to the defaults. Null if unusable. */
export function migrateBrandKit(raw: unknown): BrandKit | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const brand = (r.brand && typeof r.brand === 'object' ? r.brand : {}) as Record<string, unknown>;
  // Reuse the project's validation for every shared field. A kit always has a style.
  const p = migrateProject({
    brand: { ...brand, style: brand.style ?? 'minimal', logoAssetId: null },
    background: r.background,
    desktopFrame: r.desktopFrame,
    content: { link: r.link },
  });
  const { logoAssetId: _drop, ...rest } = p.brand;
  const logo = r.logo && typeof r.logo === 'object' ? (r.logo as Record<string, unknown>) : null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    id: r.id,
    name: (typeof r.name === 'string' ? r.name : '').trim().slice(0, KIT_NAME_MAX) || 'Brand kit',
    updatedAt: n(r.updatedAt),
    brand: rest,
    background: p.background,
    desktopFrame: p.desktopFrame,
    link: p.content.link,
    logo: logo
      ? {
          name: typeof logo.name === 'string' ? logo.name.slice(0, 120) : 'logo',
          mime: typeof logo.mime === 'string' ? logo.mime : 'image/png',
          width: n(logo.width),
          height: n(logo.height),
          size: n(logo.size),
        }
      : null,
  };
}
