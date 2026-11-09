/**
 * Observaciones del informe: lo que está bien y lo que conviene revisar,
 * sacado de los conteos, el stack, las páginas y el inventario. Solo datos;
 * los textos están en i18n.ts.
 */
import type { PageInfo } from './analyzers/page';
import type { Inventory } from './inventory';
import type { FileMetrics, Language } from './metrics';
import type { PwaCheckId, StackInfo } from './stack';

export type InsightLevel = 'warn' | 'info' | 'good';

export type InsightId =
  // Accesibilidad y HTML
  | 'imagesWithoutAlt'
  | 'pagesNoLang'
  | 'pagesNoViewport'
  | 'pagesNoTitle'
  | 'pagesNoDescription'
  | 'pagesNoH1'
  | 'pagesManyH1'
  | 'pagesNoDoctype'
  | 'inputsWithoutLabel'
  | 'blockingScripts'
  | 'inlineStyles'
  | 'noSemantic'
  // CSS
  | 'important'
  | 'manyColors'
  | 'noMediaQueries'
  // JS
  | 'varUsed'
  | 'consoleLeft'
  // Recursos
  | 'heavyImages'
  | 'noModernImages'
  | 'legacyFonts'
  // Proyecto
  | 'noLockfile'
  | 'multipleLockfiles'
  | 'noGitignore'
  | 'envFile'
  | 'noReadme'
  | 'noTests'
  | 'noLinter'
  | 'devToolsInDeps'
  | 'tsNotStrict'
  | 'jqueryWithFramework'
  | 'pwaPartial'
  // Bien
  | 'allImagesAlt'
  | 'semantic'
  | 'flexGrid'
  | 'customProperties'
  | 'noVar'
  | 'pwaReady'
  | 'tsStrict'
  | 'hasTests'
  | 'hasLinter'
  | 'hasCi'
  | 'modernImages';

export interface Insight {
  level: InsightLevel;
  id: InsightId;
  n?: number;
  items?: string[];
  /** Comprobaciones de PWA que faltan. */
  checks?: PwaCheckId[];
}

export interface InsightInput {
  totals: Partial<Record<Language, FileMetrics>>;
  stack?: StackInfo;
  pages?: PageInfo[];
  inventory?: Inventory;
}

const MAX_ITEMS = 6;

export function buildInsights({ totals, stack, pages, inventory }: InsightInput): Insight[] {
  const out: Insight[] = [];
  const v = (lang: Language, id: string) => totals[lang]?.[id]?.value ?? 0;
  const push = (level: InsightLevel, id: InsightId, extra: Omit<Insight, 'level' | 'id'> = {}) => out.push({ level, id, ...extra });
  const list = (xs: string[]) => ({ n: xs.length, items: xs.slice(0, MAX_ITEMS) });

  // HTML
  const htmlFiles = v('html', 'files');
  if (htmlFiles > 0) {
    const images = v('html', 'images');
    const noAlt = v('html', 'imagesWithoutAlt');
    if (noAlt > 0) push('warn', 'imagesWithoutAlt', { n: noAlt });
    else if (images > 0) push('good', 'allImagesAlt', { n: images });
    const sem = v('html', 'semanticTags');
    if (sem > 0) push('good', 'semantic', { n: sem });
    else if (v('html', 'elements') > 20) push('info', 'noSemantic');
    const inline = v('html', 'inlineStyles');
    if (inline > 0) push('info', 'inlineStyles', { n: inline });
  }
  const docs = (pages ?? []).filter((p) => p.document);
  if (docs.length > 0) {
    const where = (f: (p: PageInfo) => boolean) => docs.filter(f).map((p) => p.path);
    const noLang = where((p) => !p.lang);
    if (noLang.length) push('warn', 'pagesNoLang', list(noLang));
    const noVp = where((p) => !p.viewport);
    if (noVp.length) push('warn', 'pagesNoViewport', list(noVp));
    const noTitle = where((p) => !p.title);
    if (noTitle.length) push('warn', 'pagesNoTitle', list(noTitle));
    const noDoctype = where((p) => !p.doctype);
    if (noDoctype.length) push('info', 'pagesNoDoctype', list(noDoctype));
    const noDesc = where((p) => !p.description);
    if (noDesc.length) push('info', 'pagesNoDescription', list(noDesc));
    // Las SPA montan el contenido con JS: un index.html sin h1 es normal.
    const spa = stack && ['spa', 'fullstack', 'desktop', 'mobile'].includes(stack.kind);
    if (!spa) {
      const noH1 = where((p) => p.h1 === 0);
      if (noH1.length) push('info', 'pagesNoH1', list(noH1));
    }
    const manyH1 = where((p) => p.h1 > 1);
    if (manyH1.length) push('info', 'pagesManyH1', list(manyH1));
    const unlabelled = docs.reduce((a, p) => a + p.inputsWithoutLabel, 0);
    if (unlabelled) push('warn', 'inputsWithoutLabel', { n: unlabelled });
    const blocking = where((p) => p.blockingScripts > 0);
    if (blocking.length) push('info', 'blockingScripts', list(blocking));
  }

  // CSS
  if (v('css', 'files') > 0) {
    const flex = v('css', 'displayFlex');
    const grid = v('css', 'displayGrid');
    if (flex > 0 && grid > 0) push('good', 'flexGrid', { items: [String(flex), String(grid)] });
    const vars = v('css', 'customProperties');
    if (vars > 0) push('good', 'customProperties', { n: vars });
    const imp = v('css', 'important');
    if (imp > 0) push(imp > 10 ? 'warn' : 'info', 'important', { n: imp });
    const colors = v('css', 'colors');
    if (colors > 20) push('info', 'manyColors', { n: colors });
    const frameworkCss = stack?.items.some((i) => ['Tailwind CSS', 'Bootstrap', 'Bulma', 'UnoCSS', 'Pico CSS'].includes(i.name));
    if (v('css', 'mediaQueries') === 0 && v('css', 'rules') > 15 && !frameworkCss) push('warn', 'noMediaQueries');
  }

  // JS
  if (v('js', 'files') > 0) {
    const vars = v('js', 'variables');
    const vr = v('js', 'var');
    if (vr > 0) push('warn', 'varUsed', { n: vr });
    else if (vars > 0) push('good', 'noVar');
    const cons = v('js', 'consoleCalls');
    if (cons > 0) push('info', 'consoleLeft', { n: cons });
  }

  // Recursos
  if (inventory) {
    if (inventory.heavyImages.length > 0) push('warn', 'heavyImages', list(inventory.heavyImages.map((f) => f.path)));
    const f = inventory.imageFormats;
    const raster = (f.png ?? 0) + (f.jpg ?? 0) + (f.gif ?? 0) + (f.bmp ?? 0);
    const modern = (f.webp ?? 0) + (f.avif ?? 0);
    if (raster >= 3 && modern === 0) push('info', 'noModernImages', { n: raster });
    else if (modern > 0) push('good', 'modernImages', { n: modern });
    const ff = inventory.fontFormats;
    if (((ff.ttf ?? 0) + (ff.otf ?? 0) + (ff.eot ?? 0)) > 0 && !ff.woff2) push('info', 'legacyFonts');
  }

  // Proyecto y stack
  if (stack) {
    const has = (n: string) => stack.items.some((i) => i.name === n);
    const cat = (c: string) => stack.items.filter((i) => i.category === c && i.evidence.some((e) => e.kind !== 'import'));
    const pkg = stack.packages[0];
    const deps = stack.packages.reduce((a, p) => a + Object.keys(p.dependencies).length + Object.keys(p.devDependencies).length, 0);
    if (pkg && deps > 0) {
      if (stack.lockfiles.length === 0) push('warn', 'noLockfile');
      if (!stack.projectFiles.gitignore) push('warn', 'noGitignore');
      const tests = cat('testing');
      if (tests.length === 0) push('info', 'noTests');
      else push('good', 'hasTests', { items: tests.map((t) => t.name) });
      const linters = cat('quality').filter((q) => ['ESLint', 'Biome', 'Stylelint', 'Prettier'].includes(q.name));
      if (linters.length === 0) push('info', 'noLinter');
      else push('good', 'hasLinter', { items: linters.map((t) => t.name) });
      // Herramientas de desarrollo en dependencies (van en devDependencies)
      const devTools = new Set(['vite', 'webpack', 'parcel', 'rollup', 'esbuild', 'eslint', 'prettier', 'jest', 'vitest', 'typescript', 'sass', 'postcss', 'autoprefixer', '@babel/core', 'nodemon', 'stylelint']);
      const misplaced = stack.packages.flatMap((p) => Object.keys(p.dependencies).filter((d) => devTools.has(d)));
      if (misplaced.length) push('info', 'devToolsInDeps', list([...new Set(misplaced)]));
    }
    const managers = new Set(stack.lockfiles.map((l) => l.split('/').pop()));
    if (managers.size > 1) push('warn', 'multipleLockfiles', list([...managers] as string[]));
    if (stack.projectFiles.env) push(stack.projectFiles.gitignore ? 'info' : 'warn', 'envFile');
    if (!stack.projectFiles.readme && (pkg || (inventory?.totalFiles ?? 0) > 5)) push('info', 'noReadme');
    if (cat('ci').length > 0) push('good', 'hasCi', { items: cat('ci').map((c) => c.name) });
    if (has('TypeScript') && stack.typescriptStrict === false) push('info', 'tsNotStrict');
    if (has('TypeScript') && stack.typescriptStrict === true) push('good', 'tsStrict');
    const fws = stack.items.filter((i) => ['React', 'Vue', 'Svelte', 'Angular', 'Preact', 'SolidJS'].includes(i.name));
    if (has('jQuery') && fws.length > 0) push('info', 'jqueryWithFramework', { items: fws.map((f) => f.name) });
    if (stack.pwa.status === 'yes') push('good', 'pwaReady');
    else if (stack.pwa.status === 'partial') push('warn', 'pwaPartial', { checks: stack.pwa.checks.filter((c) => !c.ok && (c.required || c.id === 'serviceWorker')).map((c) => c.id) });
  }

  const order: Record<InsightLevel, number> = { warn: 0, info: 1, good: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
