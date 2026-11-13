# Third-party notices

SteffPoint Visual Studio is released under the [MIT License](LICENSE).
It includes or depends on the third-party software listed below. Each package keeps its own license; the full texts ship in each package inside `node_modules/` and are reproduced in the bundled build where required.

## Runtime dependencies (bundled in the web app)

| Package | Version | License | Source |
|---|---|---|---|
| react | 19.3.1 | MIT | https://github.com/facebook/react |
| react-dom | 19.3.1 | MIT | https://github.com/facebook/react |
| scheduler | 0.28.0 | MIT | https://github.com/facebook/react |
| zustand | 5.1.0 | MIT | https://github.com/pmndrs/zustand |
| idb | 8.0.4 | ISC | https://github.com/jakearchibald/idb |
| modern-screenshot | 4.7.0 | MIT | https://github.com/qq15725/modern-screenshot |
| jszip | 3.10.2 | MIT or GPL-3.0-or-later — **used under MIT** | https://github.com/Stuk/jszip |
| pako | 1.0.11 | MIT and Zlib | https://github.com/nodeca/pako |
| pdf-lib | 1.17.1 | MIT | https://github.com/Hopding/pdf-lib |
| qrcode-generator | 1.4.4 | MIT (“QR Code” is a registered trademark of DENSO WAVE INCORPORATED) | https://github.com/kazuhikoarase/qrcode-generator |
| @pdf-lib/standard-fonts | 1.0.0 | MIT | https://github.com/Hopding/standard-fonts |
| @pdf-lib/upng | 1.0.1 | MIT | https://github.com/Hopding/upng |
| tslib | 1.14.1 | 0BSD | https://github.com/microsoft/tslib |
| lie | 3.3.0 | MIT | https://github.com/calvinmetcalf/lie |
| immediate | 3.0.6 | MIT | https://github.com/calvinmetcalf/immediate |
| readable-stream | 2.3.8 | MIT | https://github.com/nodejs/readable-stream |
| string_decoder | 1.1.1 | MIT | https://github.com/nodejs/string_decoder |
| safe-buffer | 5.1.2 | MIT | https://github.com/feross/safe-buffer |
| core-util-is | 1.0.3 | MIT | https://github.com/isaacs/core-util-is |
| inherits | 2.0.4 | ISC | https://github.com/isaacs/inherits |
| isarray | 1.0.0 | MIT | https://github.com/juliangruber/isarray |
| process-nextick-args | 2.0.1 | MIT | https://github.com/calvinmetcalf/process-nextick-args |
| setimmediate | 1.0.5 | MIT | https://github.com/yuzujs/setImmediate |
| util-deprecate | 1.0.2 | MIT | https://github.com/TooTallNate/util-deprecate |

## Bundled fonts (SIL Open Font License 1.1)

Packaged into the build from Fontsource and served by the app itself; no request goes to a font CDN.

| Font | Package | Author | Source |
|---|---|---|---|
| Geist | @fontsource-variable/geist 5.3.0 | Vercel | https://github.com/vercel/geist-font |
| Geist Mono | @fontsource-variable/geist-mono 5.3.0 | Vercel | https://github.com/vercel/geist-font |
| Bricolage Grotesque | @fontsource-variable/bricolage-grotesque 5.3.0 | Mathieu Triay | https://github.com/ateliertriay/bricolage |
| Instrument Serif | @fontsource/instrument-serif 5.3.0 | Instrument | https://github.com/Instrument/instrument-serif |

The OFL text ships in each package (`node_modules/@fontsource*/…/LICENSE`).

## Development tooling (not shipped)

Vite, @vitejs/plugin-react, Tailwind CSS, @tailwindcss/vite, TypeScript, Vitest, Playwright (Apache-2.0) and @types packages. All MIT or Apache-2.0. Tailwind generates CSS into the build (MIT).

To regenerate the list of runtime licenses:

```bash
npx license-checker --production --summary
```

## Inspiration

**Cover Studio** — https://github.com/roosveltkn/cover-studio — MIT License.
The product concept is inspired by Cover Studio. **No source code from Cover Studio is currently included.**
If code is reused later, its copyright notice and full MIT license text must be added to this file.

## Assets

- **Fonts:** Geist, Geist Mono, Bricolage Grotesque and Instrument Serif are bundled (see above). The Soft style also uses system stacks (Inter, Segoe UI…) when installed on the device.
- **Icons:** drawn in-house as inline SVG paths.
- **Device mockups (browser, phone):** drawn in code with CSS, generic, no brand or trademarked device artwork.
- **Screenshots in `docs/images/` and `apps/web/public/samples/`:** captures of SteffPoint Visual Studio itself, used for documentation and for the template gallery previews.

Trademarks mentioned (LinkedIn, GitHub, Product Hunt, Open Graph, Microsoft 365, SharePoint) belong to their respective owners and are used only to describe output sizes. No affiliation or endorsement is implied.
