import { FileMetrics, inc } from '../metrics';
import { countLines } from './html';

/** Quita comentarios y vacía las cadenas (pueden llevar «{», «;» o «.clase»). */
function clean(text: string): { code: string; comments: number } {
  let comments = 0;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      comments++;
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
      out += c + ' '.repeat(Math.max(0, j - i - 1)) + (text[j] === c ? c : '');
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return { code: out, comments };
}

/** Divide por comas que no estén dentro de paréntesis (:is(a, b) cuenta como uno). */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

type Ctx = 'root' | 'style' | 'atBlock' | 'keyframes' | 'other';

/** Analiza una hoja de estilo. Admite anidamiento nativo de CSS y @media/@supports/@layer. */
export function analyzeCss(text: string): FileMetrics {
  const { code, comments } = clean(text);
  const stack: Ctx[] = ['root'];
  const classes: Record<string, number> = {};
  const idsMap: Record<string, number> = {};
  const display: Record<string, number> = {};
  let rules = 0;
  let selectors = 0;
  let declarations = 0;
  let mediaQueries = 0;
  let customProperties = 0;
  let important = 0;
  let buf = '';

  const top = () => stack[stack.length - 1];

  const declaration = (raw: string) => {
    const d = raw.trim();
    const colon = d.indexOf(':');
    if (colon <= 0 || top() !== 'style') return;
    const prop = d.slice(0, colon).trim().toLowerCase();
    const value = d.slice(colon + 1).trim().toLowerCase();
    declarations++;
    if (prop.startsWith('--')) customProperties++;
    if (/!\s*important/.test(value)) important++;
    if (prop === 'display') inc(display, value.replace(/\s*!\s*important/, ''));
  };

  for (const ch of code) {
    if (ch === '{') {
      const prelude = buf.trim();
      buf = '';
      if (prelude.startsWith('@')) {
        const name = prelude.slice(1).split(/[\s(]/)[0].toLowerCase();
        if (name === 'media') mediaQueries++;
        if (name.endsWith('keyframes')) stack.push('keyframes');
        else if (['media', 'supports', 'layer', 'container', 'scope', 'document'].includes(name))
          stack.push('atBlock');
        else stack.push(name === 'font-face' || name === 'page' ? 'style' : 'other');
      } else if (top() === 'keyframes') {
        stack.push('other'); // from, to, 50%: no son reglas de estilo
      } else {
        rules++;
        const list = splitTopLevel(prelude);
        selectors += list.length;
        for (const m of prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) inc(classes, m[1]);
        for (const m of prelude.matchAll(/#(-?[_a-zA-Z][\w-]*)/g)) inc(idsMap, m[1]);
        stack.push('style');
      }
    } else if (ch === ';') {
      declaration(buf);
      buf = '';
    } else if (ch === '}') {
      declaration(buf);
      buf = '';
      if (stack.length > 1) stack.pop();
    } else {
      buf += ch;
    }
  }

  const flex = (display['flex'] ?? 0) + (display['inline-flex'] ?? 0);
  const grid = (display['grid'] ?? 0) + (display['inline-grid'] ?? 0);
  return {
    files: { value: 1 },
    lines: { value: countLines(text) },
    rules: { value: rules },
    selectors: { value: selectors },
    classes: { value: Object.keys(classes).length, details: classes },
    ids: { value: Object.keys(idsMap).length, details: idsMap },
    declarations: { value: declarations },
    displayFlex: { value: flex },
    displayGrid: { value: grid },
    mediaQueries: { value: mediaQueries },
    customProperties: { value: customProperties },
    important: { value: important },
    comments: { value: comments },
  };
}
