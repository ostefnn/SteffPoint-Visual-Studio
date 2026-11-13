/**
 * Every English interface text must have a French and a Dutch translation.
 * Collects the keys from the sources (t(), msg(), template / style / format names and notes,
 * option labels) plus i18n/extra-keys.json (keys built at run time), and lists the missing ones.
 * Usage: node scripts/check-i18n.mjs [--list]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) && !p.includes('/i18n/') ? [p] : [];
  });
const unq = (s) => s.replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
const keys = new Set();
const add = (re, text, group = 1) => {
  for (const m of text.matchAll(re)) if (m[group] && /[A-Za-z]/.test(m[group])) keys.add(unq(m[group]));
};
const STR = "'((?:[^'\\\\]|\\\\.)*)'";
for (const file of walk(join(root, 'apps/web/src'))) {
  const src = readFileSync(file, 'utf8');
  add(new RegExp(`\\bt\\(\\s*${STR}`, 'g'), src);
  add(/\bt\(\s*`([^`$]*)`/g, src);
  add(new RegExp(`\\blabel: ${STR}`, 'g'), src);
}
for (const file of walk(join(root, 'packages/visual-core/src'))) {
  const src = readFileSync(file, 'utf8');
  add(new RegExp(`\\bmsg\\(\\s*${STR}`, 'g'), src);
  add(new RegExp(`\\bmsg\\([^'\\n]*\\? ${STR} : ${STR}`, 'g'), src);
  add(new RegExp(`\\bmsg\\([^'\\n]*\\? ${STR} : ${STR}`, 'g'), src, 2);
  if (/(templates|styles|formats)\.ts$/.test(file)) add(new RegExp(`\\b(?:name|description|label|note): ${STR}`, 'g'), src);
}
for (const k of JSON.parse(readFileSync(join(root, 'apps/web/src/i18n/extra-keys.json'), 'utf8'))) keys.add(k);

const dict = (lang) => {
  const src = readFileSync(join(root, `apps/web/src/i18n/${lang}.ts`), 'utf8');
  const out = new Set();
  for (const m of src.matchAll(new RegExp(`^\\s*${STR}:`, 'gm'))) out.add(unq(m[1]));
  for (const m of src.matchAll(/^\s*"((?:[^"\\]|\\.)*)":/gm)) out.add(JSON.parse(`"${m[1]}"`));
  return out;
};
if (process.argv.includes('--list')) {
  console.log(JSON.stringify([...keys].sort(), null, 1));
  process.exit(0);
}
let missing = 0;
for (const lang of ['fr', 'nl']) {
  const d = dict(lang);
  const gaps = [...keys].filter((k) => !d.has(k));
  missing += gaps.length;
  if (gaps.length) console.error(`${lang}: ${gaps.length} missing\n` + gaps.map((g) => `  ${JSON.stringify(g)}`).join('\n'));
}
if (missing) process.exit(1);
console.log(`i18n: ${keys.size} texts translated in French and Dutch.`);
