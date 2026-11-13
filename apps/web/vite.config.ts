import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Production CSP. Not applied in dev because the React refresh preamble is an inline script.
 * Everything is local: images are blob:/data: URLs, no remote origin is allowed.
 */
const CSP = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'svs-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

/**
 * Public base path. `/` locally; set BASE_PATH=/<repo-name>/ for GitHub Pages project sites.
 */
const base = process.env.BASE_PATH || '/';

/**
 * Link previews (LinkedIn, Teams, Slack…). Crawlers need an absolute image URL, so the tags that
 * point to the site are added only when SITE_URL (the public address, ending with /) is known.
 */
const SITE_URL = process.env.SITE_URL;
const ogPlugin = (): Plugin => ({
  name: 'svs-og',
  apply: 'build',
  transformIndexHtml: (html) =>
    SITE_URL
      ? html.replace(
          '  </head>',
          `    <meta property="og:url" content="${SITE_URL}" />\n` +
            `    <meta property="og:image" content="${SITE_URL}og-image.png" />\n` +
            `    <meta property="og:image:width" content="1200" />\n` +
            `    <meta property="og:image:height" content="630" />\n` +
            `    <meta name="twitter:image" content="${SITE_URL}og-image.png" />\n  </head>`,
        )
      : html,
});

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), cspPlugin(), ogPlugin()],
});
