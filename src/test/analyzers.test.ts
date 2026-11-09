import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeHtml } from '../analyzers/html';
import { analyzeCss } from '../analyzers/css';
import { analyzeJs } from '../analyzers/js';
import { aggregate, DEFAULT_HTML_TAGS, METRICS } from '../metrics';
import { renderHtml, renderMarkdown, ReportData } from '../report';
import { resolveLocale, STRINGS } from '../i18n';

const root = join(__dirname, '..', '..');
const fixture = (p: string) => readFileSync(join(root, 'test-fixtures', p), 'utf8');
const values = (m: Record<string, { value: number }>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.value]));

test('HTML: cuenta elementos, campos, imágenes y clases sin mirar comentarios, script ni style', () => {
  const m = analyzeHtml(fixture('index.html'), DEFAULT_HTML_TAGS);
  assert.deepEqual(values(m), {
    files: 1, lines: 28, elements: 23, uniqueTags: 18, tags: 8, inputs: 3, buttons: 1, forms: 1,
    images: 2, imagesWithoutAlt: 1, links: 1, headings: 1, ids: 2, classesUsed: 4, inlineStyles: 1,
    semanticTags: 3, aria: 0, scripts: 2, comments: 1,
  });
  assert.deepEqual(m.inputs.details, { text: 1, email: 1, checkbox: 1 });
  assert.deepEqual(m.tags.details, { input: 3, img: 2, a: 1, button: 1, section: 1 });
  assert.equal(m.classesUsed.details?.boton, 2);
});

test('CSS: reglas, clases, display flex/grid, @media y anidamiento', () => {
  const m = analyzeCss(fixture('css/estilos.css'));
  assert.deepEqual(values(m), {
    files: 1, lines: 15, rules: 8, selectors: 9, classes: 6, ids: 1, declarations: 14,
    displayFlex: 2, displayGrid: 1, mediaQueries: 1, customProperties: 2, important: 1, colors: 2, fontFamilies: 1,
    animations: 1, comments: 1,
  });
  assert.ok(!('falsa' in (m.classes.details ?? {})), 'una clase dentro de una cadena no cuenta');
  assert.ok(!('comentada' in (m.classes.details ?? {})), 'una clase en un comentario no cuenta');
});

test('JS: variables (también desestructuradas y en for), funciones, clases y eventos', () => {
  const m = analyzeJs(fixture('js/app.js'));
  assert.deepEqual(values(m), {
    files: 1, lines: 23, variables: 13, const: 8, let: 4, var: 1, functions: 7, functionDeclarations: 1,
    arrowFunctions: 2, methods: 3, classes: 1, eventListeners: 1, imports: 1, domQueries: 1, fetchCalls: 0, storage: 0,
    tsTypes: 0, consoleCalls: 2, comments: 1,
  });
});

test('JS: casos límite de cadenas, plantillas y expresiones regulares', () => {
  const cases: [string, number, number][] = [
    // código, variables, funciones
    ['const a = 1\nconst b = 2', 2, 0],
    ['let a = 1,\n  b = 2;', 2, 0],
    ['const s = "const x = 1"; const r = /=>/;', 2, 0],
    ['const t = `${(() => 1)()} function`;', 1, 1],
    ['const [x, , y = f(), ...z] = arr;', 3, 0],
    ['export async function cargar() { const r = await fetch(u); }', 1, 1],
    ['const o = { a() {}, b: () => {}, get c() { return 1; } };', 1, 3],
    ['if (a) { b(); } else if (c) { d(); }', 0, 0],
  ];
  for (const [code, vars, fns] of cases) {
    const m = analyzeJs(code);
    assert.equal(m.variables.value, vars, `variables en: ${code}`);
    assert.equal(m.functions.value, fns, `funciones en: ${code}`);
  }
});

test('aggregate: suma valores y une las métricas únicas', () => {
  const a = analyzeCss('.a { display: flex } .b {}');
  const b = analyzeCss('.a { display: flex } .c {}');
  const t = aggregate('css', [a, b]);
  assert.equal(t.files.value, 2);
  assert.equal(t.displayFlex.value, 2);
  assert.equal(t.classes.value, 3);
  assert.equal(t.classes.details?.a, 2);
});

test('package.json y las traducciones están al día con el catálogo', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const nlsEn = JSON.parse(readFileSync(join(root, 'package.nls.json'), 'utf8'));
  const nlsEs = JSON.parse(readFileSync(join(root, 'package.nls.es.json'), 'utf8'));
  const props = pkg.contributes.configuration.properties;
  for (const lang of ['html', 'css', 'js'] as const) {
    const ids = METRICS[lang].map((m) => m.id);
    assert.deepEqual(props[`webReport.${lang}.metrics`].items.enum, ids, `${lang}: enum`);
    assert.deepEqual(
      props[`webReport.${lang}.metrics`].default,
      METRICS[lang].filter((m) => m.default).map((m) => m.id),
      `${lang}: default`,
    );
    for (const id of ids) {
      assert.ok(STRINGS.en.metrics[lang][id], `en: falta ${lang}.${id}`);
      assert.ok(STRINGS.es.metrics[lang][id], `es: falta ${lang}.${id}`);
    }
  }
  // Toda clave %…% de package.json existe en los dos idiomas, y los dos tienen las mismas claves.
  const keys = [...JSON.stringify(pkg).matchAll(/"%([^%]+)%"/g)].map((m) => m[1]);
  for (const k of keys) {
    assert.ok(k in nlsEn, `package.nls.json: falta ${k}`);
    assert.ok(k in nlsEs, `package.nls.es.json: falta ${k}`);
  }
  assert.deepEqual(Object.keys(nlsEs).sort(), Object.keys(nlsEn).sort());
});

test('l10n: todas las cadenas de vscode.l10n.t están traducidas al español', () => {
  const src = readFileSync(join(root, 'src', 'extension.ts'), 'utf8');
  const bundle = JSON.parse(readFileSync(join(root, 'l10n', 'bundle.l10n.es.json'), 'utf8'));
  const used = [...src.matchAll(/l10n\.t\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  for (const s of used) assert.ok(s in bundle, `bundle.l10n.es.json: falta «${s}»`);
});

test('informe: idioma, autor y escape', () => {
  assert.equal(resolveLocale('auto', 'es'), 'es');
  assert.equal(resolveLocale('auto', 'es-419'), 'es');
  assert.equal(resolveLocale('auto', 'en'), 'en');
  assert.equal(resolveLocale('en', 'es'), 'en');
  const files = [{ path: 'a<b>.css', metrics: analyzeCss('.x { display: flex }') }];
  const data: ReportData = {
    project: 'demo', author: 'Lucía <Prieto>', date: new Date(2026, 10, 9, 10, 0), locale: 'es', perFile: true,
    sections: [{ lang: 'css', metrics: ['files', 'displayFlex'], total: aggregate('css', files.map((f) => f.metrics)), files }],
  };
  const md = renderMarkdown(data);
  assert.match(md, /# Informe del proyecto web/);
  assert.match(md, /\*\*Autor:\*\* Lucía &lt;Prieto>/);
  assert.match(md, /\| display: flex \| 1 \|/);
  const js = [{ path: 'a.js', metrics: analyzeJs('const o = { m() {} };') }];
  const mdJs = renderMarkdown({ ...data, sections: [{ lang: 'js', metrics: ['functions'], total: aggregate('js', js.map((f) => f.metrics)), files: js }] });
  assert.match(mdJs, /métodos: 1/);
  const html = renderHtml(data);
  assert.match(html, /<html lang="es">/);
  assert.match(html, /Lucía &lt;Prieto&gt;/);
  assert.ok(!html.includes('a<b>'));
  assert.match(renderMarkdown({ ...data, locale: 'en', author: '' }), /\*\*Author:\*\* \(not set\)/);
  const web = renderHtml(data, { cspSource: 'vscode-resource:', nonce: 'abc', buttons: [{ id: 'html', label: 'Guardar' }] });
  assert.match(web, /Content-Security-Policy/);
  assert.match(web, /<script nonce="abc">/);
});
