/**
 * Catálogo de métricas. Es la única fuente de verdad: package.json (enums de
 * la configuración), el selector de métricas y el informe salen de aquí.
 * Un test comprueba que package.json no se desincroniza.
 */

export type Language = 'html' | 'css' | 'js';

export const LANGUAGES: readonly Language[] = ['html', 'css', 'js'];

export interface MetricDef {
  id: string;
  /** Si es true, el valor es el nº de claves distintas en `details` (p. ej. clases distintas). */
  unique?: boolean;
  /** Marcada por defecto en la configuración. */
  default?: boolean;
}

export const METRICS: Record<Language, readonly MetricDef[]> = {
  html: [
    { id: 'files', default: true },
    { id: 'lines' },
    { id: 'elements', default: true },
    { id: 'uniqueTags', unique: true },
    { id: 'tags', default: true },
    { id: 'inputs', default: true },
    { id: 'buttons' },
    { id: 'forms' },
    { id: 'images', default: true },
    { id: 'imagesWithoutAlt', default: true },
    { id: 'links', default: true },
    { id: 'headings' },
    { id: 'ids' },
    { id: 'classesUsed', unique: true, default: true },
    { id: 'inlineStyles' },
    { id: 'semanticTags', default: true },
    { id: 'aria' },
    { id: 'scripts' },
    { id: 'comments' },
  ],
  css: [
    { id: 'files', default: true },
    { id: 'lines' },
    { id: 'rules', default: true },
    { id: 'selectors' },
    { id: 'classes', unique: true, default: true },
    { id: 'ids', unique: true },
    { id: 'declarations', default: true },
    { id: 'displayFlex', default: true },
    { id: 'displayGrid', default: true },
    { id: 'mediaQueries', default: true },
    { id: 'customProperties' },
    { id: 'important' },
    { id: 'colors', unique: true, default: true },
    { id: 'fontFamilies', unique: true },
    { id: 'animations' },
    { id: 'comments' },
  ],
  js: [
    { id: 'files', default: true },
    { id: 'lines' },
    { id: 'variables', default: true },
    { id: 'const' },
    { id: 'let' },
    { id: 'var' },
    { id: 'functions', default: true },
    { id: 'functionDeclarations' },
    { id: 'arrowFunctions' },
    { id: 'methods' },
    { id: 'classes', default: true },
    { id: 'eventListeners', default: true },
    { id: 'imports' },
    { id: 'domQueries' },
    { id: 'fetchCalls' },
    { id: 'storage' },
    { id: 'tsTypes' },
    { id: 'consoleCalls' },
    { id: 'comments' },
  ],
};

export const DEFAULT_HTML_TAGS = ['input', 'img', 'a', 'button', 'section'];

export function defaultMetrics(lang: Language): string[] {
  return METRICS[lang].filter((m) => m.default).map((m) => m.id);
}

export function metricDef(lang: Language, id: string): MetricDef | undefined {
  return METRICS[lang].find((m) => m.id === id);
}

/** Valor de una métrica: un número y, si procede, el desglose (etiqueta → veces). */
export interface MetricValue {
  value: number;
  details?: Record<string, number>;
}

export type FileMetrics = Record<string, MetricValue>;

/** Suma los resultados de varios ficheros respetando las métricas «únicas». */
export function aggregate(lang: Language, files: FileMetrics[]): FileMetrics {
  const total: FileMetrics = {};
  for (const def of METRICS[lang]) {
    let value = 0;
    let details: Record<string, number> | undefined;
    for (const f of files) {
      const m = f[def.id];
      if (!m) continue;
      value += m.value;
      if (m.details) {
        details ??= {};
        for (const [k, v] of Object.entries(m.details)) details[k] = (details[k] ?? 0) + v;
      }
    }
    if (def.unique) value = details ? Object.keys(details).length : 0;
    total[def.id] = details ? { value, details } : { value };
  }
  return total;
}

export function inc(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}
