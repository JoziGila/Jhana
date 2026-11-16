// Bundle the app into self-contained HTML.
//   dist/ember.html           a complete document: open it directly, or host it anywhere
//   dist/ember.artifact.html  the same page as a fragment, for publishing as a Claude artifact
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  entryPoints: [resolve(root, 'app/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020', 'safari14'],
  minify: process.argv.includes('--minify'),
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(resolve(root, 'app/styles.css'), 'utf8');

const TITLE = 'Ember Jhana Trainer';
const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=Figtree:wght@400;500;600&display=swap';
const fragment = `<title>${TITLE}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${FONTS}">
<style>
${css}
</style>
<div id="app"></div>
<script>
${js}
</script>
`;

// The standalone wrapper mirrors the skeleton an artifact is given at publish time.
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#15141d">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head>
<body>
${fragment}</body>
</html>
`;

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/ember.html'), standalone);
writeFileSync(resolve(root, 'dist/ember.artifact.html'), fragment);
console.log(`built dist/ember.html (${(standalone.length / 1024).toFixed(0)} KB) and dist/ember.artifact.html`);
