# SteffPoint Visual Studio

> **Create once. Publish everywhere.**

Turn screenshots, a logo and a headline into a consistent pack of visuals (LinkedIn, Open Graph, Square, Story, GitHub, Product Hunt, banner, thumbnail, custom) in a couple of minutes. Local-first: images never leave the browser.

Product vision and roadmap: [`docs/vision.md`](docs/vision.md).

## Status: MVP V1 foundation

| Feature | State |
|---|---|
| Project manager (new, rename, duplicate, delete, favourites, search, thumbnails) | ✅ |
| IndexedDB storage (projects, image blobs, thumbnails) + autosave | ✅ |
| Project JSON import/export (images embedded) with `schemaVersion` migration | ✅ |
| 8 templates: Browser Hero, Browser Duo, Mobile Trio, Bento, Spotlight, Before/After, Editorial, Minimal | ✅ |
| Screenshot upload (click, drag & drop, paste), validation, up to 4 per project | ✅ |
| Image settings: cover/contain, zoom, focal point picker | ✅ |
| Brand: primary colour → derived palette, light/dark, heading font, radius, shadow, logo | ✅ |
| Backgrounds: solid, gradient, soft glow, grid, mesh | ✅ |
| Multi-format live preview + safe zones overlay | ✅ |
| Undo/redo (bounded, coalesced) + keyboard shortcuts | ✅ |
| Export PNG/JPEG/WebP at 1×/2×/3×, single file or ZIP with `project.json` | ✅ |
| Deterministic suggestions + WCAG contrast checks (never block export) | ✅ |

Not yet: Brand Kits as reusable entities, Asset Manager, variants, more mockups (V2). Accounts, cloud, URL capture, AI, render API stay out of the MVP.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (visual-core)
npm run typecheck
npm run build      # apps/web/dist, static, deployable anywhere
```

## Structure

```text
apps/web/                 React + Vite app (dashboard, editor, export)
  src/render/             Composition renderer: templates, frames, backgrounds
  src/lib/                IndexedDB, image import, exporter, project file
  src/store/              Zustand editor store with undo/redo
packages/visual-core/     Framework-free model: formats, templates, palette,
                          project schema + migration, rules engine (tested)
docs/vision.md            Product vision
```

`visual-core` has no DOM or React dependency so it can later back a render API, a batch generator or a Microsoft 365 adapter.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z, Ctrl/Cmd + Y | Redo |
| Ctrl/Cmd + S | Save now |
| Ctrl/Cmd + D | Duplicate selected screenshot |
| Delete / Backspace | Remove selected screenshot |
| Ctrl/Cmd + V | Paste an image as screenshot |
| Esc | Leave field / deselect / close dialog |

## Privacy and security

- All editing, rendering and ZIP generation happen in the browser. No network calls.
- Production build ships a strict CSP (`connect-src 'self' blob: data:`, no remote origins).
- Imported files are type/size checked (PNG, JPEG, WebP, GIF, ≤ 20 MB) and must decode as images.
- Imported project JSON is normalised by `migrateProject` (unknown fields dropped, values clamped, control chars stripped).

## Stack note

The vision suggests Next.js; this app uses **Vite** because it is a fully client-side, local-first SPA with no server rendering needed. Tailwind CSS v4, Zustand, idb, modern-screenshot, JSZip, Vitest.

## Credits

Inspired by [Cover Studio](https://github.com/roosveltkn/cover-studio) (MIT). No code from it is included at this stage. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
