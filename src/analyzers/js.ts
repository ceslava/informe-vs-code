import { FileMetrics, inc } from '../metrics';
import { countLines } from './html';

/** Caracteres tras los que una «/» abre una expresión regular y no es una división. */
const REGEX_PREV = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_KEYWORDS = /\b(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

/**
 * Vacía cadenas, plantillas (salvo lo que va en ${…}), expresiones regulares y
 * comentarios, conservando los saltos de línea. Así los conteos con expresiones
 * regulares no se confunden con texto que solo parece código.
 */
export function stripJs(text: string): { code: string; comments: number } {
  let out = '';
  let comments = 0;
  let i = 0;
  // Pila de llaves para saber cuándo un «}» cierra un ${…} de una plantilla.
  const braces: ('code' | 'template')[] = [];
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  const prevSignificant = () => {
    let k = out.length - 1;
    while (k >= 0 && /\s/.test(out[k])) k--;
    return { ch: k >= 0 ? out[k] : '', text: out.slice(Math.max(0, k - 11), k + 1) };
  };

  const readTemplate = () => {
    // i apunta justo después de «`» o del «}» que cierra un ${…}
    while (i < text.length) {
      const c = text[i];
      if (c === '\\') {
        out += '  ';
        i += 2;
      } else if (c === '`') {
        out += '`';
        i++;
        return;
      } else if (c === '$' && text[i + 1] === '{') {
        out += '${';
        i += 2;
        braces.push('template');
        return;
      } else {
        out += c === '\n' ? '\n' : ' ';
        i++;
      }
    }
  };

  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '/' && n === '/') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      out += blank(text.slice(i, stop));
      comments++;
      i = stop;
    } else if (c === '/' && n === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(i, stop));
      comments++;
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
      out += c + ' '.repeat(Math.max(0, Math.min(j, text.length) - i - 1)) + c;
      i = j + 1;
    } else if (c === '`') {
      out += '`';
      i++;
      readTemplate();
    } else if (c === '/') {
      const prev = prevSignificant();
      if (REGEX_PREV.has(prev.ch) || REGEX_KEYWORDS.test(prev.text)) {
        let j = i + 1;
        let inClass = false;
        while (j < text.length && text[j] !== '\n') {
          if (text[j] === '\\') j++;
          else if (text[j] === '[') inClass = true;
          else if (text[j] === ']') inClass = false;
          else if (text[j] === '/' && !inClass) break;
          j++;
        }
        j++;
        while (j < text.length && /[a-z]/i.test(text[j])) j++;
        out += '/' + ' '.repeat(Math.max(0, j - i - 2)) + '/';
        i = j;
      } else {
        out += c;
        i++;
      }
    } else if (c === '{') {
      braces.push('code');
      out += c;
      i++;
    } else if (c === '}') {
      const kind = braces.pop();
      out += c;
      i++;
      if (kind === 'template') readTemplate();
    } else {
      out += c;
      i++;
    }
  }
  return { code: out, comments };
}

const IDENT = /[A-Za-z_$][\w$]*/y;

/** Nombres declarados en un patrón de desestructuración: {a, b: c, ...d} → a, c, d. */
function patternNames(pattern: string): number {
  let count = 0;
  for (const m of pattern.matchAll(/(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*(?=[,}\]=]|$)/g)) {
    const before = pattern.slice(0, m.index).trimEnd();
    if (!before.endsWith('=')) count++; // tras «=» va un valor por defecto, no un nombre
  }
  return count;
}

/** Cuenta los nombres declarados por un var/let/const que empieza en `start`. */
function countDeclarators(code: string, start: number): number {
  let i = start;
  let count = 0;
  const skipSpace = () => {
    while (i < code.length && /\s/.test(code[i])) i++;
  };
  for (;;) {
    skipSpace();
    const c = code[i];
    if (c === '{' || c === '[') {
      const open = c;
      const close = open === '{' ? '}' : ']';
      let depth = 0;
      const from = i;
      for (; i < code.length; i++) {
        if (code[i] === open) depth++;
        else if (code[i] === close && --depth === 0) break;
      }
      count += patternNames(code.slice(from + 1, i));
      i++;
    } else {
      IDENT.lastIndex = i;
      const m = IDENT.exec(code);
      if (!m) return count;
      count++;
      i += m[0].length;
    }
    // Saltar el inicializador hasta «,» de primer nivel o fin de la declaración.
    let depth = 0;
    for (; i < code.length; i++) {
      const ch = code[i];
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) {
        if (depth === 0) return count; // for (let i = 0) o fin de bloque
        depth--;
      } else if (depth === 0) {
        if (ch === ';') return count;
        if (ch === ',') break;
        if (/^\s+(?:of|in)\b/.test(code.slice(i, i + 5))) return count;
        if (ch === '\n') {
          const before = code.slice(0, i).trimEnd().slice(-1);
          const after = code.slice(i).trimStart()[0] ?? '';
          if (!/[=,+\-*/%&|^<>?:.([{]/.test(before) && !/[.?:+\-*/%&|^<>=,)\]}]/.test(after)) return count;
        }
      }
    }
    if (i >= code.length) return count;
    i++; // la coma
  }
}

const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'with']);

/** Analiza JavaScript (también sirve, aproximado, para módulos ES y CommonJS). */
export function analyzeJs(text: string): FileMetrics {
  const { code, comments } = stripJs(text);
  const kinds: Record<string, number> = { const: 0, let: 0, var: 0 };
  for (const m of code.matchAll(/(?<![\w$.])(const|let|var)\s+(?=[A-Za-z_$[{])/g)) {
    inc(kinds, m[1], countDeclarators(code, m.index + m[0].length));
  }
  const functionKeyword = [...code.matchAll(/(?<![\w$.])function\b\s*\*?/g)];
  const functionDeclarations = [
    ...code.matchAll(/(?:^|[;{}\n])\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*[A-Za-z_$]/g),
  ].length;
  const arrows = [...code.matchAll(/=>/g)].length;
  let methods = 0;
  for (const m of code.matchAll(
    /(?:^|[;{},])\s*(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?\*?\s*(#?[A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g,
  )) {
    if (!CONTROL.has(m[1])) methods++;
  }
  const classes = [...code.matchAll(/(?<![\w$.])class\b(?=\s*(?:[A-Za-z_$]|\{|extends\b))/g)].length;
  const listeners = [...code.matchAll(/\.addEventListener\s*\(/g)].length;
  const imports =
    [...code.matchAll(/(?:^|[;\n])\s*import\b(?!\s*\()/g)].length + [...code.matchAll(/(?<![\w$.])require\s*\(/g)].length;
  const consoleCalls: Record<string, number> = {};
  for (const m of code.matchAll(/(?<![\w$.])console\.(\w+)\s*\(/g)) inc(consoleCalls, m[1]);

  const dom: Record<string, number> = {};
  for (const m of code.matchAll(/\.(querySelectorAll|querySelector|getElementById|getElementsByClassName|getElementsByTagName|createElement)\s*\(/g)) inc(dom, m[1]);
  const net: Record<string, number> = {};
  for (const m of code.matchAll(/(?<![\w$.])(fetch)\s*\(|(?<![\w$])(axios)(?:\.\w+)?\s*\(|new\s+(XMLHttpRequest|WebSocket|EventSource)\b/g))
    inc(net, m[1] ?? m[2] ?? m[3]);
  const storage: Record<string, number> = {};
  for (const m of code.matchAll(/(?<![\w$])(localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem|clear)\b|(?<![\w$.])(indexedDB)\s*\.\s*open\b|(?<![\w$.])document\s*\.\s*(cookie)\b/g))
    inc(storage, m[1] ?? m[2] ?? m[3]);
  const ts: Record<string, number> = {};
  for (const m of code.matchAll(/(?:^|[;{}\n])\s*(?:export\s+)?(?:declare\s+)?(?:const\s+)?(interface|type|enum)\s+[A-Za-z_$][\w$]*\s*(?:<[^=;{]*>)?\s*(?:=|\{|extends\b)/g))
    inc(ts, m[1]);

  const variables = kinds.const + kinds.let + kinds.var;
  return {
    files: { value: 1 },
    lines: { value: countLines(text) },
    variables: { value: variables, details: { ...kinds } },
    const: { value: kinds.const },
    let: { value: kinds.let },
    var: { value: kinds.var },
    functions: {
      value: functionKeyword.length + arrows + methods,
      details: { function: functionKeyword.length, '=>': arrows, methods },
    },
    functionDeclarations: { value: functionDeclarations },
    arrowFunctions: { value: arrows },
    methods: { value: methods },
    classes: { value: classes },
    eventListeners: { value: listeners },
    imports: { value: imports },
    domQueries: { value: Object.values(dom).reduce((a, b) => a + b, 0), details: dom },
    fetchCalls: { value: Object.values(net).reduce((a, b) => a + b, 0), details: net },
    storage: { value: Object.values(storage).reduce((a, b) => a + b, 0), details: storage },
    tsTypes: { value: Object.values(ts).reduce((a, b) => a + b, 0), details: ts },
    consoleCalls: { value: Object.values(consoleCalls).reduce((a, b) => a + b, 0), details: consoleCalls },
    comments: { value: comments },
  };
}
