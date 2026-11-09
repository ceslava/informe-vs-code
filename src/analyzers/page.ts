import { parseAttributes } from './html';

/** Lo básico que debe tener una página HTML (accesibilidad, SEO, móvil). */
export interface PageInfo {
  path: string;
  /** Página completa (con <html> o <head>); los fragmentos y plantillas parciales no se revisan. */
  document: boolean;
  doctype: boolean;
  lang?: string;
  charset: boolean;
  viewport: boolean;
  title?: string;
  description: boolean;
  favicon: boolean;
  openGraph: number;
  h1: number;
  main: boolean;
  manifest: boolean;
  themeColor: boolean;
  /** Ficheros CSS y JS enlazados (locales y externos). */
  stylesheets: number;
  scripts: number;
  /** <script> en <head> sin defer, async ni type="module": bloquean el pintado. */
  blockingScripts: number;
  /** <img> sin loading="lazy" ni width/height. */
  imagesWithoutSize: number;
  /** Campos de formulario sin etiqueta asociada (aproximado). */
  inputsWithoutLabel: number;
}

export function analyzePage(path: string, text: string): PageInfo {
  const src = text.replace(/<!--[\s\S]*?-->/g, '').replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, '$1$3');
  const tags = [...src.matchAll(/<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g)].map((m) => ({
    tag: m[1].toLowerCase(),
    attrs: parseAttributes(m[2] ?? ''),
    index: m.index ?? 0,
  }));
  const headEnd = src.search(/<\/head\s*>|<body\b/i);
  const inHead = (i: number) => headEnd === -1 || i < headEnd;
  const html = tags.find((t) => t.tag === 'html');
  const metas = tags.filter((t) => t.tag === 'meta');
  const links = tags.filter((t) => t.tag === 'link');
  const rel = (t: { attrs: Record<string, string> }) => (t.attrs.rel ?? '').toLowerCase().split(/\s+/);
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(src);

  const labelled = new Set(tags.filter((t) => t.tag === 'label' && t.attrs.for).map((t) => t.attrs.for));
  // Campos dentro de <label>…</label>: se cuentan como etiquetados.
  const wrapped = [...src.matchAll(/<label\b[^>]*>[\s\S]*?<\/label\s*>/gi)].reduce(
    (n, m) => n + [...m[0].matchAll(/<(?:input|select|textarea)\b/gi)].length,
    0,
  );
  let fields = 0;
  let fieldsLabelled = 0;
  for (const t of tags) {
    if (!['input', 'select', 'textarea'].includes(t.tag)) continue;
    const type = (t.attrs.type ?? '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    fields++;
    if ((t.attrs.id && labelled.has(t.attrs.id)) || 'aria-label' in t.attrs || 'aria-labelledby' in t.attrs || 'title' in t.attrs) fieldsLabelled++;
  }

  return {
    path,
    document: Boolean(html) || /<head\b/i.test(src),
    doctype: /^\s*<!doctype\s+html/i.test(text.replace(/^﻿/, '').replace(/^\s*<!--[\s\S]*?-->/, '')),
    lang: html?.attrs.lang || undefined,
    charset: metas.some((m) => 'charset' in m.attrs || (m.attrs['http-equiv'] ?? '').toLowerCase() === 'content-type'),
    viewport: metas.some((m) => (m.attrs.name ?? '').toLowerCase() === 'viewport'),
    title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() || undefined : undefined,
    description: metas.some((m) => (m.attrs.name ?? '').toLowerCase() === 'description' && (m.attrs.content ?? '').trim() !== ''),
    favicon: links.some((l) => rel(l).includes('icon') || rel(l).includes('apple-touch-icon')),
    openGraph: metas.filter((m) => (m.attrs.property ?? '').toLowerCase().startsWith('og:')).length,
    h1: tags.filter((t) => t.tag === 'h1').length,
    main: tags.some((t) => t.tag === 'main' || (t.attrs.role ?? '') === 'main'),
    manifest: links.some((l) => rel(l).includes('manifest')),
    themeColor: metas.some((m) => (m.attrs.name ?? '').toLowerCase() === 'theme-color'),
    stylesheets: links.filter((l) => rel(l).includes('stylesheet')).length,
    scripts: tags.filter((t) => t.tag === 'script' && t.attrs.src).length,
    blockingScripts: tags.filter(
      (t) => t.tag === 'script' && t.attrs.src && inHead(t.index) && !('defer' in t.attrs) && !('async' in t.attrs) && (t.attrs.type ?? '').toLowerCase() !== 'module',
    ).length,
    imagesWithoutSize: tags.filter((t) => t.tag === 'img' && !('width' in t.attrs && 'height' in t.attrs) && (t.attrs.loading ?? '') !== 'lazy').length,
    inputsWithoutLabel: Math.max(0, fields - fieldsLabelled - wrapped),
  };
}
