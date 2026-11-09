/**
 * Textos del informe en inglés y español. El informe puede salir en un idioma
 * distinto del de VS Code (ajuste `webReport.language`), por eso no usa
 * vscode.l10n: así también se puede probar sin VS Code.
 */
import { Language } from './metrics';

export type ReportLocale = 'en' | 'es';

interface Strings {
  title: string;
  author: string;
  noAuthor: string;
  project: string;
  date: string;
  summary: string;
  perFile: string;
  metric: string;
  value: string;
  file: string;
  breakdown: string;
  noFiles: string;
  more: (n: number) => string;
  approx: string;
  /** Claves de los desgloses que no son código (el resto se muestra tal cual). */
  detailKeys: Record<string, string>;
  sections: Record<Language, string>;
  metrics: Record<Language, Record<string, string>>;
}

const en: Strings = {
  title: 'Web project report',
  author: 'Author',
  noAuthor: '(not set)',
  project: 'Project',
  date: 'Date',
  summary: 'Summary',
  perFile: 'Per file',
  metric: 'Metric',
  value: 'Value',
  file: 'File',
  breakdown: 'Breakdown',
  noFiles: 'No files found.',
  more: (n) => `…and ${n} more`,
  approx: 'Counts come from a lexical analysis: they are reliable for ordinary code but may be approximate in unusual cases.',
  detailKeys: { methods: 'methods' },
  sections: { html: 'HTML', css: 'CSS', js: 'JavaScript' },
  metrics: {
    html: {
      files: 'Files',
      lines: 'Non-empty lines',
      elements: 'Elements',
      uniqueTags: 'Different tags',
      tags: 'Selected tags',
      inputs: 'Inputs (<input>)',
      buttons: 'Buttons',
      forms: 'Forms',
      images: 'Images',
      imagesWithoutAlt: 'Images without alt',
      links: 'Links (<a>)',
      headings: 'Headings (h1–h6)',
      ids: 'Elements with id',
      classesUsed: 'Different classes used',
      inlineStyles: 'Inline styles (style="…")',
      scripts: 'Scripts',
      comments: 'Comments',
    },
    css: {
      files: 'Files',
      lines: 'Non-empty lines',
      rules: 'Rules',
      selectors: 'Selectors',
      classes: 'Different classes',
      ids: 'Different ids',
      declarations: 'Declarations',
      displayFlex: 'display: flex',
      displayGrid: 'display: grid',
      mediaQueries: '@media queries',
      customProperties: 'Custom properties (--*)',
      important: '!important',
      comments: 'Comments',
    },
    js: {
      files: 'Files',
      lines: 'Non-empty lines',
      variables: 'Variables',
      const: 'const',
      let: 'let',
      var: 'var',
      functions: 'Functions (all kinds)',
      functionDeclarations: 'Function declarations',
      arrowFunctions: 'Arrow functions',
      methods: 'Methods',
      classes: 'Classes',
      eventListeners: 'Event listeners',
      imports: 'Imports',
      consoleCalls: 'console calls',
      comments: 'Comments',
    },
  },
};

const es: Strings = {
  title: 'Informe del proyecto web',
  author: 'Autor',
  noAuthor: '(sin indicar)',
  project: 'Proyecto',
  date: 'Fecha',
  summary: 'Resumen',
  perFile: 'Por fichero',
  metric: 'Métrica',
  value: 'Valor',
  file: 'Fichero',
  breakdown: 'Desglose',
  noFiles: 'No hay ficheros.',
  more: (n) => `…y ${n} más`,
  approx: 'Los conteos salen de un análisis léxico: son fiables con código normal, pero pueden ser aproximados en casos raros.',
  detailKeys: { methods: 'métodos' },
  sections: { html: 'HTML', css: 'CSS', js: 'JavaScript' },
  metrics: {
    html: {
      files: 'Ficheros',
      lines: 'Líneas con contenido',
      elements: 'Elementos',
      uniqueTags: 'Etiquetas distintas',
      tags: 'Etiquetas elegidas',
      inputs: 'Campos (<input>)',
      buttons: 'Botones',
      forms: 'Formularios',
      images: 'Imágenes',
      imagesWithoutAlt: 'Imágenes sin alt',
      links: 'Enlaces (<a>)',
      headings: 'Encabezados (h1–h6)',
      ids: 'Elementos con id',
      classesUsed: 'Clases distintas usadas',
      inlineStyles: 'Estilos en línea (style="…")',
      scripts: 'Scripts',
      comments: 'Comentarios',
    },
    css: {
      files: 'Ficheros',
      lines: 'Líneas con contenido',
      rules: 'Reglas',
      selectors: 'Selectores',
      classes: 'Clases distintas',
      ids: 'Ids distintos',
      declarations: 'Declaraciones',
      displayFlex: 'display: flex',
      displayGrid: 'display: grid',
      mediaQueries: 'Consultas @media',
      customProperties: 'Variables de CSS (--*)',
      important: '!important',
      comments: 'Comentarios',
    },
    js: {
      files: 'Ficheros',
      lines: 'Líneas con contenido',
      variables: 'Variables',
      const: 'const',
      let: 'let',
      var: 'var',
      functions: 'Funciones (de todo tipo)',
      functionDeclarations: 'Funciones declaradas',
      arrowFunctions: 'Funciones flecha',
      methods: 'Métodos',
      classes: 'Clases',
      eventListeners: 'Escuchadores de eventos',
      imports: 'Importaciones',
      consoleCalls: 'Llamadas a console',
      comments: 'Comentarios',
    },
  },
};

export const STRINGS: Record<ReportLocale, Strings> = { en, es };

/** 'auto' sigue el idioma de VS Code (p. ej. «es», «es-ES» → español; el resto, inglés). */
export function resolveLocale(setting: string, vscodeLanguage: string): ReportLocale {
  if (setting === 'en' || setting === 'es') return setting;
  return vscodeLanguage.toLowerCase().startsWith('es') ? 'es' : 'en';
}
