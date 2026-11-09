/**
 * Separa un componente de un solo fichero (.vue, .svelte, .astro) en su
 * marcado, sus scripts y sus estilos, para contar cada parte con su analizador.
 */
export interface ComponentParts {
  markup: string;
  scripts: string[];
  styles: { text: string; lang: string }[];
}

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const STYLE_RE = /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi;
const langOf = (attrs: string) => /\blang\s*=\s*["']?(\w+)/i.exec(attrs)?.[1]?.toLowerCase() ?? 'css';

export function isComponent(path: string): boolean {
  return /\.(?:vue|svelte|astro)$/i.test(path);
}

export function splitComponent(path: string, text: string): ComponentParts {
  let src = text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const scripts: string[] = [];
  const styles: ComponentParts['styles'] = [];
  if (/\.astro$/i.test(path)) {
    const fm = /^\s*---\r?\n([\s\S]*?)\r?\n---/.exec(src);
    if (fm) {
      scripts.push(fm[1]);
      src = src.slice(fm[0].length);
    }
  }
  src = src.replace(SCRIPT_RE, (_m, attrs: string, body: string) => {
    if (!/type\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap|text\/template)/i.test(attrs) && body.trim()) scripts.push(body);
    return '';
  });
  src = src.replace(STYLE_RE, (_m, attrs: string, body: string) => {
    if (body.trim()) styles.push({ text: body, lang: langOf(attrs) });
    return '';
  });
  let markup: string;
  if (/\.vue$/i.test(path)) {
    // En Vue el marcado es lo que va en el <template> de primer nivel.
    const open = /<template\b[^>]*>/i.exec(src);
    const close = src.toLowerCase().lastIndexOf('</template');
    markup = open && close > open.index ? src.slice(open.index + open[0].length, close) : '';
  } else markup = blankExpressions(src);
  return { markup, scripts, styles };
}

/**
 * En Svelte y Astro los atributos y el texto llevan expresiones entre llaves
 * (on:click={() => n++}) que confunden la lectura de las etiquetas: se cambian
 * por "" conservando los saltos de línea.
 */
function blankExpressions(src: string): string {
  let out = '';
  let depth = 0;
  for (const ch of src) {
    if (ch === '{') {
      if (depth === 0) out += '""';
      depth++;
    } else if (ch === '}' && depth > 0) {
      depth--;
    } else if (depth === 0) out += ch;
    else if (ch === '\n') out += ch;
  }
  return out;
}
