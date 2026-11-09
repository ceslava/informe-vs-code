/**
 * Análisis completo de un proyecto a partir de su lista de ficheros: métricas
 * de código, páginas, stack, inventario y observaciones. No depende de VS Code
 * (la extensión le pasa cómo leer los ficheros), así se puede probar con Node.
 */
import { isComponent, splitComponent } from './analyzers/component';
import { analyzeCss } from './analyzers/css';
import { analyzeHtml } from './analyzers/html';
import { analyzeJs } from './analyzers/js';
import { analyzePage, PageInfo } from './analyzers/page';
import { buildInsights, Insight } from './insights';
import { buildInventory, Inventory } from './inventory';
import { aggregate, FileMetrics, Language, LANGUAGES } from './metrics';
import type { SectionData } from './report';
import { collectHtmlSignals, collectJsSignals, detectStack, emptySignals, StackInfo, wantedFiles } from './stack';

/** Ficheros que se cuentan en cada lenguaje (además de las partes de los componentes .vue, .svelte y .astro). */
export const EXT: Record<Language, RegExp> = {
  html: /\.html?$/i,
  css: /\.(?:css|scss|less)$/i,
  js: /\.(?:m?jsx?|cjs|tsx?|mts|cts)$/i,
};

export interface ScanFile {
  path: string;
  size: number;
}

export interface ScanOptions<F extends ScanFile = ScanFile> {
  /** Métricas elegidas por lenguaje (vacío = sin sección de ese lenguaje). */
  chosen: Record<Language, string[]>;
  tags: readonly string[];
  skipMinified: boolean;
  maxFiles: number;
  truncated?: boolean;
  /** Lee un fichero; undefined si no se puede o es demasiado grande. */
  read(file: F): Promise<string | undefined>;
  progress?(done: number, total: number): void;
  cancelled?(): boolean;
}

export interface ScanResult {
  sections: SectionData[];
  totals: Record<Language, FileMetrics>;
  stack: StackInfo;
  pages: PageInfo[];
  inventory: Inventory;
  insights: Insight[];
}

export async function scanProject<F extends ScanFile>(files: readonly F[], opts: ScanOptions<F>): Promise<ScanResult | undefined> {
  const { chosen, tags, skipMinified: skipMin, maxFiles, truncated = false } = opts;
  const read = (f: F) => opts.read(f);
  // 2. Código: HTML, CSS, JS/TS y componentes.
  const perLang: Record<Language, SectionData['files']> = { html: [], css: [], js: [] };
  const extensions: Record<Language, Record<string, number>> = { html: {}, css: {}, js: {} };
  const countExt = (lang: Language, path: string) => {
    const ext = '.' + (path.split('.').pop() ?? '').toLowerCase();
    extensions[lang][ext] = (extensions[lang][ext] ?? 0) + 1;
  };
  const pages: PageInfo[] = [];
  const signals = emptySignals();
  const counted: Record<Language, number> = { html: 0, css: 0, js: 0 };
  const code = files.filter(
    (f) => !(skipMin && /\.min\.\w+$/.test(f.path)) && !/\.d\.[mc]?ts$/.test(f.path) && (isComponent(f.path) || LANGUAGES.some((l) => EXT[l].test(f.path))),
  );
  for (const [n, f] of code.entries()) {
    if (opts.cancelled?.()) return undefined;
    if (n % 50 === 0) opts.progress?.(n, code.length);
    const lang = LANGUAGES.find((l) => EXT[l].test(f.path));
    if (lang && counted[lang] >= maxFiles) continue;
    const text = await read(f);
    if (text === undefined) continue;
    if (lang === 'html') {
      counted.html++;
      countExt('html', f.path);
      perLang.html.push({ path: f.path, metrics: analyzeHtml(text, tags) });
      pages.push(analyzePage(f.path, text));
      collectHtmlSignals(f.path, text, signals);
    } else if (lang === 'css') {
      counted.css++;
      countExt('css', f.path);
      const syntax = /\.scss$/i.test(f.path) ? 'scss' : /\.less$/i.test(f.path) ? 'less' : 'css';
      perLang.css.push({ path: f.path, metrics: analyzeCss(text, syntax) });
    } else if (lang === 'js') {
      counted.js++;
      countExt('js', f.path);
      perLang.js.push({ path: f.path, metrics: analyzeJs(text) });
      collectJsSignals(f.path, text, signals);
    } else {
      // Componente: cada parte va a su lenguaje.
      const c = splitComponent(f.path, text);
      if (c.markup.trim()) {
        countExt('html', f.path);
        perLang.html.push({ path: f.path, metrics: analyzeHtml(c.markup, tags) });
        collectHtmlSignals(f.path, c.markup, signals);
      }
      if (c.styles.length) {
        countExt('css', f.path);
        const syntax = c.styles.some((s) => s.lang === 'scss') ? 'scss' : c.styles.some((s) => s.lang === 'less') ? 'less' : 'css';
        perLang.css.push({ path: f.path, metrics: analyzeCss(c.styles.map((s) => s.text).join('\n'), syntax) });
      }
      if (c.scripts.length) {
        countExt('js', f.path);
        const js = c.scripts.join('\n');
        perLang.js.push({ path: f.path, metrics: analyzeJs(js) });
        collectJsSignals(f.path, js, signals);
      }
    }
  }

  // 3. Stack: package.json, manifiestos, configuración…
  const texts: Record<string, string> = {};
  const byPath = new Map(files.map((f) => [f.path, f]));
  for (const p of wantedFiles(files.map((f) => f.path))) {
    const f = byPath.get(p)!;
    const text = await read(f);
    if (text !== undefined) texts[p] = text;
  }
  const stack = detectStack({ files, texts, signals });
  const inventory = buildInventory(files, truncated);
  const totals = Object.fromEntries(LANGUAGES.map((l) => [l, aggregate(l, perLang[l].map((f) => f.metrics))])) as Record<Language, FileMetrics>;
  const sections: SectionData[] = LANGUAGES.filter((l) => chosen[l].length > 0).map((l) => ({
    lang: l,
    metrics: chosen[l],
    total: totals[l],
    files: perLang[l],
    extensions: extensions[l],
  }));
  const insights = buildInsights({ totals, stack, pages, inventory });
  return { sections, totals, stack, pages, inventory, insights };
}
