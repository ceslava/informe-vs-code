import { FileMetrics, inc } from '../metrics';

/** Etiqueta de apertura con sus atributos (los valores entre comillas pueden llevar «>»). */
const TAG_RE =
  /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseAttributes(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of src.matchAll(ATTR_RE)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

export function countLines(text: string): number {
  return text.split(/\r?\n/).filter((l) => l.trim() !== '').length;
}

const SEMANTIC = new Set(['header', 'nav', 'main', 'article', 'section', 'aside', 'footer', 'figure', 'figcaption', 'time', 'address', 'search', 'dialog', 'details', 'summary']);

/**
 * Analiza un HTML. Es un análisis léxico, no un parser completo: ignora
 * comentarios y el contenido de <script>, <style>, <template> no se trata aparte.
 * @param tagsToCount etiquetas que se desglosan en la métrica `tags`.
 */
export function analyzeHtml(text: string, tagsToCount: readonly string[]): FileMetrics {
  let comments = 0;
  let src = text.replace(/<!--[\s\S]*?-->/g, () => {
    comments++;
    return '';
  });
  // El contenido de script y style no son elementos HTML.
  src = src.replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, '$1$3');

  const wanted = new Set(tagsToCount.map((t) => t.toLowerCase()));
  const byTag: Record<string, number> = {};
  const tags: Record<string, number> = {};
  for (const t of wanted) tags[t] = 0;
  const inputTypes: Record<string, number> = {};
  const classes: Record<string, number> = {};
  const headings: Record<string, number> = {};
  let elements = 0;
  let imagesWithoutAlt = 0;
  let ids = 0;
  let inlineStyles = 0;
  const semantic: Record<string, number> = {};
  const aria: Record<string, number> = {};

  for (const m of src.matchAll(TAG_RE)) {
    const tag = m[1].toLowerCase();
    if (tag === '!doctype') continue;
    elements++;
    inc(byTag, tag);
    if (wanted.has(tag)) inc(tags, tag);
    const attrs = parseAttributes(m[2] ?? '');
    if (tag === 'input') inc(inputTypes, (attrs.type || 'text').toLowerCase());
    if (tag === 'img' && !('alt' in attrs)) imagesWithoutAlt++;
    if (/^h[1-6]$/.test(tag)) inc(headings, tag);
    if ('id' in attrs) ids++;
    if ('style' in attrs) inlineStyles++;
    if (SEMANTIC.has(tag)) inc(semantic, tag);
    for (const a of Object.keys(attrs)) if (a === 'role' || a.startsWith('aria-')) inc(aria, a);
    if (attrs.class) for (const c of attrs.class.split(/\s+/).filter(Boolean)) inc(classes, c);
  }

  const n = (t: string) => byTag[t] ?? 0;
  const headingCount = Object.values(headings).reduce((a, b) => a + b, 0);
  return {
    files: { value: 1 },
    lines: { value: countLines(text) },
    elements: { value: elements },
    uniqueTags: { value: Object.keys(byTag).length, details: byTag },
    tags: { value: Object.values(tags).reduce((a, b) => a + b, 0), details: tags },
    inputs: { value: n('input'), details: inputTypes },
    buttons: { value: n('button') },
    forms: { value: n('form') },
    images: { value: n('img') },
    imagesWithoutAlt: { value: imagesWithoutAlt },
    links: { value: n('a') },
    headings: { value: headingCount, details: headings },
    ids: { value: ids },
    classesUsed: { value: Object.keys(classes).length, details: classes },
    inlineStyles: { value: inlineStyles },
    semanticTags: { value: Object.values(semantic).reduce((a, b) => a + b, 0), details: semantic },
    aria: { value: Object.values(aria).reduce((a, b) => a + b, 0), details: aria },
    scripts: { value: n('script') },
    comments: { value: comments },
  };
}
