# Changelog

## 1.0.0 (2026-11-13)

First major version. Projects, brand kits and `project.json` files from 0.x open unchanged: the project file format is still schema 1.0, and every saved project keeps its style, layout and export formats.

### Results you can publish
- **Example text is flagged.** New projects start with texts that ask for real content. Each one still drawn in the image is listed in the suggestions and in the Export dialog (images and carousel pages), with an *Edit Text* button. Export is never blocked. Recognised in English, French and Dutch.
- **The automatic LinkedIn carousel skips example features**: the Features page is added once a feature is real.
- **Tint is the default style** for new projects. Saved projects keep theirs.
- **Portrait formats show the whole screenshot** (Story, LinkedIn 4:5, carousel pages) in Browser Hero, Spotlight and Detail Zoom: no more cropping at the sides, no gap under the text.
- **Features, Steps, Key Figures and Comparison** keep their title and subtitle right above their content in square and portrait formats; squares now show the subtitle.
- **App Store keeps a phone screenshot in a phone**, whatever the format.

### First run
- A project without screenshots opens on **Images**, and the empty preview adds one when clicked. The title is then selected.
- An untitled project takes its **name from the title** until it is renamed.
- The dashboard shows **three finished examples** (fictional products), each opening its template.
- The template gallery opens on **six recommended templates** for LinkedIn and Microsoft 365; *All* lists the 21.
- New projects tick **two or three formats that suit their template** instead of the same five. In the Export dialog, Microsoft 365 formats come right after Social.

### Trust and storage
- The dashboard warns about storage **only once the browser has refused** to keep the data; the app also asks after each export.
- After three exports without `project.json`, the editor offers **once** to save a copy as JSON.
- The site has **link previews** (Open Graph and Twitter card, with an image made with the app).

### Interface
- **Import Legend** moved to the dashboard's *More* menu, and is offered under the Annotated Panel template.
- **Phones**: one-row editor bar, and a preview shaped like the format.
- **Faster first load**: the editor and the export engine load on demand (first-load JavaScript 691 kB → 481 kB, 218 kB → 157 kB gzipped).

### For developers
- `npm run showcase` regenerates the dashboard examples and `og-image.png`.
- Set `SITE_URL` at build time for absolute link-preview URLs (the GitHub Pages workflow does).
