import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitComponent } from '../analyzers/component';
import { analyzeCss } from '../analyzers/css';
import { analyzeHtml } from '../analyzers/html';
import { analyzeJs } from '../analyzers/js';
import { analyzePage } from '../analyzers/page';
import { REPORT_PARTS, STRINGS } from '../i18n';
import { buildInsights } from '../insights';
import { buildInventory, categoryOf, formatBytes } from '../inventory';
import { aggregate } from '../metrics';
import { renderHtml, renderMarkdown, ReportData } from '../report';
import { CATEGORIES, cleanVersion, collectHtmlSignals, collectJsSignals, detectStack, emptySignals, packageName, StackInput, wantedFiles } from '../stack';

/** Monta la entrada de detectStack a partir de un mapa ruta → contenido, como hace la extensión. */
function project(files: Record<string, string>): StackInput {
  const paths = Object.keys(files).sort();
  const signals = emptySignals();
  for (const p of paths) {
    if (/\.html?$/.test(p)) collectHtmlSignals(p, files[p], signals);
    if (/\.[mc]?[jt]sx?$/.test(p)) collectJsSignals(p, files[p], signals);
  }
  const texts: Record<string, string> = {};
  for (const p of wantedFiles(paths)) texts[p] = files[p];
  return { files: paths.map((path) => ({ path, size: files[path].length })), texts, signals };
}

const names = (s: ReturnType<typeof detectStack>) => s.items.map((i) => i.name);

const REACT_PWA = {
  'package.json': JSON.stringify({
    name: 'tienda',
    private: true,
    type: 'module',
    packageManager: 'pnpm@9.12.0',
    scripts: { dev: 'vite', build: 'tsc -b && vite build', test: 'vitest', lint: 'eslint .' },
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'react-router-dom': '^6.26.0', zustand: '^4.5.0' },
    devDependencies: {
      vite: '^5.4.2',
      '@vitejs/plugin-react': '^4.3.1',
      typescript: '~5.5.3',
      tailwindcss: '^3.4.10',
      postcss: '^8.4.41',
      'vite-plugin-pwa': '^0.20.5',
      vitest: '^2.0.5',
      '@testing-library/react': '^16.0.0',
      eslint: '^9.9.0',
    },
  }),
  'pnpm-lock.yaml': 'lockfileVersion: 9.0',
  'tsconfig.json': '{ /* comentario */ "compilerOptions": { "strict": true, }, }',
  'vite.config.ts': "import { VitePWA } from 'vite-plugin-pwa';\nexport default {};",
  'tailwind.config.js': 'export default {}',
  'index.html': '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tienda</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
  'src/main.tsx': "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { registerSW } from 'virtual:pwa-register';\nimport App from './App';\nregisterSW();",
  'src/App.tsx': 'export default function App() { return <h1>Hola</h1>; }',
  '.github/workflows/ci.yml': 'jobs:\n  build:\n    steps:\n      - uses: actions/deploy-pages@v4',
  'README.md': '# Tienda',
  '.gitignore': 'node_modules',
};

test('stack: React + Vite + TypeScript + Tailwind + PWA generada con vite-plugin-pwa', () => {
  const s = detectStack(project(REACT_PWA));
  assert.equal(s.kind, 'spa');
  assert.deepEqual(s.highlights.slice(0, 3), ['React', 'Vite', 'TypeScript']);
  for (const n of ['React', 'Vite', 'TypeScript', 'TSX', 'Tailwind CSS', 'PostCSS', 'React Router', 'Zustand', 'Vitest', 'Testing Library', 'ESLint', 'vite-plugin-pwa', 'pnpm', 'GitHub Actions', 'GitHub Pages']) {
    assert.ok(names(s).includes(n), `falta ${n}`);
  }
  const react = s.items.find((i) => i.name === 'React')!;
  assert.equal(react.version, '18.3.1');
  assert.equal(react.category, 'framework');
  assert.equal(s.items.find((i) => i.name === 'pnpm')?.version, '9.12.0');
  assert.equal(s.items.find((i) => i.name === 'Vite')?.devOnly, true);
  assert.equal(s.typescriptStrict, true);
  assert.equal(s.esModules, true);
  assert.equal(s.pwa.status, 'yes');
  assert.equal(s.pwa.generator, 'vite-plugin-pwa');
  assert.deepEqual(s.pwa.serviceWorker, ['src/main.tsx']);
  assert.deepEqual(s.packages[0].scripts.dev, 'vite');
  // Ordenado por categoría
  const cats = s.items.map((i) => CATEGORIES.indexOf(i.category));
  assert.deepEqual(cats, [...cats].sort((a, b) => a - b));
});

test('stack: sitio estático con Bootstrap y jQuery por CDN y manifiesto incompleto', () => {
  const s = detectStack(
    project({
      'index.html': `<!doctype html><html><head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
        <link rel="manifest" href="manifest.webmanifest">
        <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
      </head><body><h1>Hola</h1></body></html>`,
      'manifest.webmanifest': JSON.stringify({ name: 'Mi web', display: 'browser', icons: [{ src: 'i.png', sizes: '192x192' }] }),
      'css/estilos.css': 'body{}',
      'js/app.js': "navigator.serviceWorker.register('/sw.js')",
      'sw.js': "self.addEventListener('fetch', () => {}); caches.open('v1');",
    }),
  );
  assert.equal(s.kind, 'static');
  assert.equal(s.items.find((i) => i.name === 'Bootstrap')?.version, '5.3.3');
  assert.equal(s.items.find((i) => i.name === 'jQuery')?.version, '3.7.1');
  assert.ok(names(s).includes('Google Fonts'));
  assert.equal(s.items.find((i) => i.name === 'Bootstrap')?.evidence[0].kind, 'cdn');
  assert.equal(s.pwa.status, 'partial');
  assert.equal(s.pwa.manifest?.path, 'manifest.webmanifest');
  const failed = s.pwa.checks.filter((c) => !c.ok).map((c) => c.id);
  assert.deepEqual(failed.filter((f) => ['display', 'icon512', 'icon192', 'serviceWorker', 'offline'].includes(f)), ['display', 'icon512']);
  assert.ok(names(s).includes('Service worker'));
  assert.ok(names(s).includes('Web App Manifest'));
});

test('stack: Next.js, Nuxt, Astro y Electron se clasifican bien', () => {
  const pkg = (deps: Record<string, string>) => ({ 'package.json': JSON.stringify({ dependencies: deps }), 'package-lock.json': '{}' });
  assert.equal(detectStack(project({ ...pkg({ next: '15.0.0', react: '19.0.0' }), 'next.config.mjs': '' })).kind, 'fullstack');
  assert.equal(detectStack(project(pkg({ nuxt: '^3.13.0' }))).kind, 'fullstack');
  assert.equal(detectStack(project({ ...pkg({ astro: '^4.15.0' }), 'src/pages/index.astro': '---\n---\n<h1/>' })).kind, 'ssg');
  assert.equal(detectStack(project(pkg({ electron: '^32.0.0', react: '^18.0.0' }))).kind, 'desktop');
  assert.equal(detectStack(project(pkg({ express: '^4.19.0' }))).kind, 'server');
  const next = detectStack(project({ ...pkg({ next: '15.0.0', react: '19.0.0' }), 'next.config.mjs': '' }));
  assert.deepEqual(next.highlights.slice(0, 2), ['Next.js', 'React']);
  assert.ok(names(next).includes('npm'));
  // Vue por CDN, sin package.json
  const vue = detectStack(project({ 'index.html': '<html><head><script src="https://unpkg.com/vue@3/dist/vue.global.js"></script></head></html>' }));
  assert.equal(vue.kind, 'spa');
  assert.ok(names(vue).includes('Vue'));
  // Nada: HTML, CSS y JS a secas
  const plain = detectStack(project({ 'index.html': '<h1>Hola</h1>', 'a.css': '', 'a.js': '' }));
  assert.equal(plain.kind, 'static');
  assert.deepEqual(plain.items.map((i) => i.category), ['language', 'language', 'language']);
  assert.equal(plain.pwa.status, 'no');
});

test('stack: utilidades', () => {
  assert.equal(cleanVersion('^18.3.1'), '18.3.1');
  assert.equal(cleanVersion('~5.5'), '5.5');
  assert.equal(cleanVersion('workspace:*'), undefined);
  assert.equal(packageName('@mui/material/Button'), '@mui/material');
  assert.equal(packageName('react-dom/client'), 'react-dom');
  assert.equal(packageName('./App'), undefined);
  assert.equal(packageName('https://esm.sh/preact@10.19.0/hooks'), 'preact');
  const sig = emptySignals();
  collectJsSignals('a.js', "// import x from 'no'\nimport a from 'gsap';\nconst t = await import('three');\nconst e = require('express');", sig);
  assert.deepEqual(sig.imports.map((i) => i.name), ['gsap', 'three', 'express']);
  // Paquetes importados sin package.json también cuentan, pero no deciden el tipo de proyecto
  const s = detectStack({ files: [{ path: 'a.js', size: 1 }], texts: {}, signals: sig });
  assert.ok(names(s).includes('GSAP'));
  assert.equal(s.items.find((i) => i.name === 'GSAP')?.evidence[0].kind, 'import');
});

test('páginas: lo básico de cada página', () => {
  const p = analyzePage(
    'index.html',
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
     <title> Mi  web </title><meta name="description" content="Una web"><link rel="icon" href="f.svg">
     <meta property="og:title" content="x"><meta property="og:image" content="y.png"><script src="a.js"></script></head>
     <body><main><h1>Uno</h1><h1>Dos</h1><label>Nombre <input></label><label for="c">Correo</label><input id="c"><input name="sin"><input type="hidden">
     <img src="a.png" width="10" height="10"><img src="b.png"></main></body></html>`,
  );
  assert.equal(p.document, true);
  assert.equal(p.doctype, true);
  assert.equal(p.lang, 'es');
  assert.equal(p.title, 'Mi web');
  assert.equal(p.viewport && p.charset && p.description && p.favicon && p.main, true);
  assert.equal(p.openGraph, 2);
  assert.equal(p.h1, 2);
  assert.equal(p.blockingScripts, 1);
  assert.equal(p.inputsWithoutLabel, 1);
  assert.equal(p.imagesWithoutSize, 1);
  const frag = analyzePage('parcial.html', '<div class="tarjeta"></div>');
  assert.equal(frag.document, false);
});

test('componentes: Vue, Svelte y Astro se separan en marcado, script y estilo', () => {
  const vue = splitComponent('App.vue', `<template><div><template v-if="a"><p>x</p></template></div></template>
<script setup lang="ts">const a = ref(1)</script>
<style scoped lang="scss">// comentario .falsa {}
.a { color: red; }</style>`);
  assert.equal(analyzeHtml(vue.markup, []).elements.value, 3);
  assert.equal(vue.scripts.length, 1);
  assert.equal(vue.styles[0].lang, 'scss');
  const css = analyzeCss(vue.styles[0].text, 'scss');
  assert.equal(css.rules.value, 1);
  assert.ok(!('falsa' in (css.classes.details ?? {})));
  const svelte = splitComponent('B.svelte', '<script>let n = 0;</script><button on:click={() => n++}>{n}</button><style>button{display:grid}</style>');
  assert.equal(analyzeJs(svelte.scripts[0]).variables.value, 1);
  assert.equal(analyzeHtml(svelte.markup, []).buttons.value, 1);
  const astro = splitComponent('p.astro', "---\nconst titulo = 'Hola';\n---\n<h1>{titulo}</h1>");
  assert.equal(analyzeJs(astro.scripts[0]).variables.value, 1);
  assert.equal(analyzeHtml(astro.markup, []).headings.value, 1);
});

test('CSS y JS: métricas nuevas', () => {
  const css = analyzeCss(`a { color: #FFF; background: #ffffff; border-color: rgb(0 0 0); font-family: "Inter", sans-serif; transition: color .2s; }
    b { color: white; font-family: Georgia, serif; animation: none; }`);
  assert.equal(css.colors.value, 3); // #fff = #ffffff, rgb(0 0 0), white
  assert.deepEqual(css.fontFamilies.details, { inter: 1, georgia: 1 });
  assert.equal(css.animations.value, 1);
  const js = analyzeJs(`const r = await fetch('/api'); localStorage.setItem('a', 1); document.querySelector('a');
    interface Gato { nombre: string }
    type Id = string;
    export enum Color { Rojo }`);
  assert.equal(js.fetchCalls.value, 1);
  assert.equal(js.storage.value, 1);
  assert.equal(js.domQueries.value, 1);
  assert.deepEqual(js.tsTypes.details, { interface: 1, type: 1, enum: 1 });
});

test('inventario: categorías, peso y ficheros pesados', () => {
  assert.equal(categoryOf('a/b.webp'), 'images');
  assert.equal(categoryOf('x.woff2'), 'fonts');
  assert.equal(categoryOf('App.vue'), 'components');
  assert.equal(categoryOf('.eslintrc.json'), 'data');
  const inv = buildInventory([
    { path: 'index.html', size: 1000 },
    { path: 'img/foto.jpg', size: 900 * 1024 },
    { path: 'img/logo.svg', size: 2000 },
    { path: 'fonts/a.ttf', size: 40000 },
  ]);
  assert.equal(inv.totalFiles, 4);
  assert.equal(inv.byCategory.find((c) => c.category === 'images')?.files, 2);
  assert.deepEqual(inv.heavyImages.map((f) => f.path), ['img/foto.jpg']);
  assert.equal(inv.largest[0].path, 'img/foto.jpg');
  assert.equal(formatBytes(1536, 'es'), '1,5 KB');
  assert.equal(formatBytes(1536, 'en'), '1.5 KB');
});

test('observaciones: avisos, sugerencias y aciertos', () => {
  const html = aggregate('html', [analyzeHtml('<img src="a"><header></header>', [])]);
  const css = aggregate('css', [analyzeCss('a{display:flex} b{display:grid} :root{--a:1} c{color:red!important}')]);
  const js = aggregate('js', [analyzeJs('var a = 1; console.log(a);')]);
  const stack = detectStack(project({ 'package.json': JSON.stringify({ dependencies: { vite: '5.0.0', react: '18.0.0', jquery: '3.0.0' } }), 'index.html': '' }));
  const pages = [analyzePage('index.html', '<html><head></head><body></body></html>')];
  const ins = buildInsights({ totals: { html, css, js }, stack, pages, inventory: buildInventory([{ path: 'a.png', size: 600 * 1024 }]) });
  const ids = ins.map((i) => i.id);
  for (const id of ['imagesWithoutAlt', 'pagesNoLang', 'pagesNoViewport', 'pagesNoTitle', 'varUsed', 'consoleLeft', 'heavyImages', 'noLockfile', 'noGitignore', 'noTests', 'noLinter', 'devToolsInDeps', 'jqueryWithFramework', 'flexGrid', 'customProperties', 'semantic', 'important'] as const) {
    assert.ok(ids.includes(id), `falta ${id}`);
  }
  // Los avisos van primero y los aciertos al final
  const levels = ins.map((i) => i.level);
  assert.equal(levels[0], 'warn');
  assert.equal(levels[levels.length - 1], 'good');
  // Todas tienen texto en los dos idiomas
  for (const i of ins) {
    assert.ok(STRINGS.es.insight(i).length > 10);
    assert.ok(STRINGS.en.insight(i).length > 10);
  }
  // En una SPA no se pide h1 en index.html
  assert.ok(!ids.includes('pagesNoH1'));
});

test('informe completo: todas las partes en Markdown y HTML', () => {
  const input = project(REACT_PWA);
  const stack = detectStack(input);
  const htmlFiles = [{ path: 'index.html', metrics: analyzeHtml(REACT_PWA['index.html'], []) }];
  const jsFiles = ['src/main.tsx', 'src/App.tsx'].map((p) => ({ path: p, metrics: analyzeJs(REACT_PWA[p as keyof typeof REACT_PWA]) }));
  const totals = { html: aggregate('html', htmlFiles.map((f) => f.metrics)), js: aggregate('js', jsFiles.map((f) => f.metrics)) };
  const pages = [analyzePage('index.html', REACT_PWA['index.html'])];
  const inventory = buildInventory(input.files);
  const data: ReportData = {
    project: 'tienda', author: 'Lucía', date: new Date(2026, 10, 9), locale: 'es', perFile: true,
    sections: [{ lang: 'js', metrics: ['files', 'variables', 'functions'], total: totals.js, files: jsFiles, extensions: { '.tsx': 2 } }],
    parts: REPORT_PARTS, totals, stack, pages, inventory, insights: buildInsights({ totals, stack, pages, inventory }),
  };
  const md = renderMarkdown(data);
  for (const h of ['## Resumen', '## Observaciones', '## Stack tecnológico', '## Aplicación web progresiva (PWA)', '## Páginas HTML', '## JavaScript / TypeScript', '## Ficheros y recursos']) {
    assert.ok(md.includes(h), `falta ${h}`);
  }
  assert.match(md, /\*\*Aplicación de una sola página \(SPA\)\.\*\* Hecho con React 18\.3\.1, Vite 5\.4\.2 y TypeScript 5\.5\.3\./);
  assert.match(md, /\| Framework \/ biblioteca de interfaz \| React \| `18\.3\.1` \| package\.json \(dependencies\); import en src\/main\.tsx \|/);
  assert.match(md, /\| dev · servidor de desarrollo \| `vite` \|/);
  assert.match(md, /- \*\*PWA:\*\* PWA instalable/);
  assert.match(md, /✅ \*\*Bien hecho:\*\* TypeScript en modo estricto\./);
  // Orden: resumen antes que el stack, el código antes que los recursos
  assert.ok(md.indexOf('## Resumen') < md.indexOf('## Stack tecnológico'));
  assert.ok(md.indexOf('## JavaScript / TypeScript') < md.indexOf('## Ficheros y recursos'));
  const html = renderHtml({ ...data, locale: 'en' });
  assert.match(html, /<nav class="toc"/);
  assert.match(html, /<section id="stack"><h2>Technology stack<\/h2>/);
  assert.match(html, /<div class="cards">/);
  assert.match(html, /<svg class="bar"/);
  assert.ok(!/style="/.test(html), 'sin estilos en línea (la CSP del panel no los deja)');
  // Sin partes, el informe es el de antes: solo métricas
  const plain = renderMarkdown({ ...data, parts: [] });
  assert.ok(!plain.includes('## Resumen'));
  assert.ok(plain.includes('## JavaScript / TypeScript'));
});

test('scanProject: el proyecto de ejemplo de principio a fin', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join, relative } = await import('node:path');
  const base = join(__dirname, '..', '..', 'test-fixtures');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  const files = walk(base).map((abs) => ({ abs, path: relative(base, abs).split('\\').join('/'), size: statSync(abs).size }));
  const { scanProject } = await import('../scan');
  const r = await scanProject(files, {
    chosen: { html: ['files', 'images'], css: [], js: ['variables'] },
    tags: [],
    skipMinified: true,
    maxFiles: 100,
    read: async (f) => readFileSync(f.abs, 'utf8'),
  });
  assert.ok(r);
  assert.deepEqual(r.sections.map((s) => s.lang), ['html', 'js']);
  assert.equal(r.totals.css.displayFlex.value, 2, 'CSS se analiza aunque no tenga sección');
  assert.equal(r.totals.js.variables.value, 13);
  assert.equal(r.stack.kind, 'staticBuild');
  assert.ok(r.stack.items.some((i) => i.name === 'Vite'));
  assert.equal(r.pages[0].lang, 'es');
  assert.ok(r.insights.some((i) => i.id === 'pagesNoViewport'));
});
