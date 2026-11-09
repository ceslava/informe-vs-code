/**
 * Textos del informe en inglés y español. El informe puede salir en un idioma
 * distinto del de VS Code (ajuste `webReport.language`), por eso no usa
 * vscode.l10n: así también se puede probar sin VS Code.
 */
import type { Insight, InsightId } from './insights';
import type { FileCategory } from './inventory';
import type { Language } from './metrics';
import type { Category, Evidence, ProjectKind, PwaCheckId } from './stack';

export type ReportLocale = 'en' | 'es';

/** Partes del informe que se pueden activar o quitar (ajuste `webReport.sections`). */
export type ReportPart = 'summary' | 'insights' | 'stack' | 'pwa' | 'pages' | 'assets';
export const REPORT_PARTS: readonly ReportPart[] = ['summary', 'insights', 'stack', 'pwa', 'pages', 'assets'];

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
  contents: string;
  /** Claves de los desgloses que no son código (el resto se muestra tal cual). */
  detailKeys: Record<string, string>;
  sections: Record<Language, string>;
  metrics: Record<Language, Record<string, string>>;
  parts: Record<ReportPart, string>;
  partHints: Record<ReportPart, string>;
  /** Línea bajo el título de una sección de código: «12 ficheros: .tsx 8, .ts 4». */
  filesByExt: (n: number, list: string) => string;
  yes: string;
  no: string;

  // Resumen
  kind: Record<ProjectKind, string>;
  kindLabel: string;
  builtWith: (names: string) => string;
  cards: { files: string; codeLines: string; size: string; technologies: string; pwa: string; observations: string; pages: string; dependencies: string };
  obsCount: (warn: number, info: number) => string;
  linesBy: string;

  // Stack
  categories: Record<Category, string>;
  technology: string;
  version: string;
  detectedIn: string;
  devOnly: string;
  evidence: (e: Evidence) => string;
  noStack: string;
  packageTitle: (path: string) => string;
  pkg: { name: string; version: string; description: string; type: string; module: string; commonjs: string; license: string; node: string; manager: string; private: string; workspaces: string; browserslist: string; typescript: string; strict: string; notStrict: string };
  scripts: string;
  script: string;
  command: string;
  scriptHint: Record<string, string>;
  dependencies: (n: number) => string;
  devDependencies: (n: number) => string;
  dependency: string;
  range: string;
  projectFiles: string;
  projectFileNames: Record<'readme' | 'license' | 'gitignore' | 'editorconfig' | 'envExample', string>;

  // PWA
  pwaStatus: Record<'yes' | 'partial' | 'no', string>;
  pwaIntro: Record<'yes' | 'partial' | 'no', string>;
  pwaChecks: Record<PwaCheckId, string>;
  pwaCheck: string;
  pwaState: string;
  pwaGenerated: (plugin: string) => string;
  manifestFile: string;
  manifestFields: { name: string; shortName: string; startUrl: string; display: string; themeColor: string; backgroundColor: string; icons: string; lang: string };
  required: string;
  recommended: string;

  // Páginas
  pagesIntro: string;
  pageCols: { page: string; lang: string; viewport: string; title: string; description: string; favicon: string; og: string; h1: string; main: string };
  noPages: string;
  fragments: (n: number) => string;

  // Inventario
  fileCategories: Record<FileCategory, string>;
  category: string;
  files: string;
  size: string;
  extensions: string;
  largest: string;
  total: string;
  truncated: string;

  // Observaciones
  levels: Record<'warn' | 'info' | 'good', string>;
  insight: (i: Insight) => string;
  noInsights: string;
}

const join = (xs: string[] | undefined, locale: ReportLocale) =>
  new Intl.ListFormat(locale === 'es' ? 'es' : 'en', { style: 'long', type: 'conjunction' }).format(xs ?? []);

const pathsSuffix = (i: Insight, locale: ReportLocale) => {
  if (!i.items?.length) return '';
  const extra = (i.n ?? i.items.length) - i.items.length;
  return ': ' + i.items.join(', ') + (extra > 0 ? (locale === 'es' ? ` y ${extra} más` : ` and ${extra} more`) : '');
};

const enChecks: Record<PwaCheckId, string> = {
  manifest: 'Web app manifest',
  manifestLinked: 'Manifest linked from the page (<link rel="manifest">)',
  name: 'name or short_name',
  startUrl: 'start_url',
  display: 'display: standalone, fullscreen or minimal-ui',
  icon192: 'Icon of at least 192×192',
  icon512: 'Icon of at least 512×512',
  maskable: 'Maskable icon (purpose: maskable)',
  themeColor: 'theme_color',
  serviceWorker: 'Service worker registered',
  offline: 'Offline cache (Cache API or Workbox)',
  screenshots: 'Screenshots (richer install dialog)',
};

const esChecks: Record<PwaCheckId, string> = {
  manifest: 'Manifiesto de la aplicación web',
  manifestLinked: 'Manifiesto enlazado desde la página (<link rel="manifest">)',
  name: 'name o short_name',
  startUrl: 'start_url',
  display: 'display: standalone, fullscreen o minimal-ui',
  icon192: 'Icono de 192×192 como mínimo',
  icon512: 'Icono de 512×512 como mínimo',
  maskable: 'Icono adaptable (purpose: maskable)',
  themeColor: 'theme_color',
  serviceWorker: 'Service worker registrado',
  offline: 'Caché sin conexión (Cache API o Workbox)',
  screenshots: 'Capturas (diálogo de instalación más completo)',
};

const enInsights: Record<InsightId, (i: Insight) => string> = {
  imagesWithoutAlt: (i) => `${i.n} image(s) without an alt attribute. Screen readers cannot describe them; use alt="" for decorative images.`,
  pagesNoLang: (i) => `Pages without lang on <html>${pathsSuffix(i, 'en')}. Screen readers and translators need it.`,
  pagesNoViewport: (i) => `Pages without <meta name="viewport">${pathsSuffix(i, 'en')}. They will not adapt to mobile screens.`,
  pagesNoTitle: (i) => `Pages without <title>${pathsSuffix(i, 'en')}.`,
  pagesNoDescription: (i) => `Pages without <meta name="description">${pathsSuffix(i, 'en')}. Search engines show it in results.`,
  pagesNoH1: (i) => `Pages without an <h1>${pathsSuffix(i, 'en')}.`,
  pagesManyH1: (i) => `Pages with more than one <h1>${pathsSuffix(i, 'en')}. Usually there is one main heading per page.`,
  pagesNoDoctype: (i) => `Pages without <!doctype html>${pathsSuffix(i, 'en')}: the browser renders them in quirks mode.`,
  inputsWithoutLabel: (i) => `${i.n} form field(s) without an associated <label> (or aria-label).`,
  blockingScripts: (i) => `Scripts in <head> without defer, async or type="module" block rendering${pathsSuffix(i, 'en')}.`,
  inlineStyles: (i) => `${i.n} inline style attribute(s) (style="…"). Classes in the stylesheet are easier to maintain.`,
  noSemantic: () => 'No semantic elements (header, nav, main, section, footer…). They help accessibility and SEO.',
  important: (i) => `${i.n} !important declaration(s). They are a sign of specificity problems.`,
  manyColors: (i) => `${i.n} different colours in the CSS. Custom properties (--colour) keep a palette consistent.`,
  noMediaQueries: () => 'No @media queries: the layout may not adapt to different screen sizes.',
  varUsed: (i) => `${i.n} variable(s) declared with var. const and let have block scope and avoid surprises.`,
  consoleLeft: (i) => `${i.n} console call(s). Remove the debugging ones before publishing.`,
  heavyImages: (i) => `Images heavier than 500 KB${pathsSuffix(i, 'en')}. Compress them or use WebP/AVIF.`,
  noModernImages: (i) => `${i.n} PNG/JPG/GIF image(s) and none in WebP or AVIF, which weigh much less.`,
  legacyFonts: () => 'Fonts in TTF/OTF/EOT and none in WOFF2, the lightest web format.',
  noLockfile: () => 'There is a package.json but no lockfile (package-lock.json, pnpm-lock.yaml…): installs are not reproducible.',
  multipleLockfiles: (i) => `Several package managers' lockfiles${pathsSuffix(i, 'en')}. Keep just one.`,
  noGitignore: () => 'No .gitignore: node_modules and build output could end up in the repository.',
  envFile: () => 'There is a .env file. Check that it is in .gitignore and does not publish keys or passwords.',
  noReadme: () => 'No README: explain what the project is and how to run it.',
  noTests: () => 'No testing tool detected (Vitest, Jest, Playwright…).',
  noLinter: () => 'No linter or formatter detected (ESLint, Prettier, Biome, Stylelint).',
  devToolsInDeps: (i) => `Development tools in dependencies instead of devDependencies${pathsSuffix(i, 'en')}.`,
  tsNotStrict: () => 'TypeScript is not in strict mode ("strict": true in tsconfig.json catches more errors).',
  jqueryWithFramework: (i) => `jQuery together with ${join(i.items, 'en')}: they usually overlap and add weight.`,
  pwaPartial: (i) => `It is almost a PWA. Missing: ${(i.checks ?? []).map((c) => enChecks[c]).join('; ')}.`,
  allImagesAlt: (i) => `All ${i.n} image(s) have an alt attribute.`,
  semantic: (i) => `Uses ${i.n} semantic HTML element(s).`,
  flexGrid: (i) => `Layout with Flexbox (${i.items?.[0]}) and Grid (${i.items?.[1]}).`,
  customProperties: (i) => `Uses ${i.n} CSS custom propert${i.n === 1 ? 'y' : 'ies'}.`,
  noVar: () => 'All variables use const or let.',
  pwaReady: () => 'Installable PWA: manifest, icons and service worker.',
  tsStrict: () => 'TypeScript in strict mode.',
  hasTests: (i) => `Has tests: ${join(i.items, 'en')}.`,
  hasLinter: (i) => `Code quality tools: ${join(i.items, 'en')}.`,
  hasCi: (i) => `Continuous integration: ${join(i.items, 'en')}.`,
  modernImages: (i) => `${i.n} image(s) in modern formats (WebP/AVIF).`,
};

const esInsights: Record<InsightId, (i: Insight) => string> = {
  imagesWithoutAlt: (i) => `${i.n} imagen(es) sin atributo alt. Los lectores de pantalla no pueden describirlas; usa alt="" en las decorativas.`,
  pagesNoLang: (i) => `Páginas sin lang en <html>${pathsSuffix(i, 'es')}. Lo necesitan los lectores de pantalla y los traductores.`,
  pagesNoViewport: (i) => `Páginas sin <meta name="viewport">${pathsSuffix(i, 'es')}. No se adaptarán a la pantalla del móvil.`,
  pagesNoTitle: (i) => `Páginas sin <title>${pathsSuffix(i, 'es')}.`,
  pagesNoDescription: (i) => `Páginas sin <meta name="description">${pathsSuffix(i, 'es')}. Es el texto que muestran los buscadores.`,
  pagesNoH1: (i) => `Páginas sin <h1>${pathsSuffix(i, 'es')}.`,
  pagesManyH1: (i) => `Páginas con más de un <h1>${pathsSuffix(i, 'es')}. Lo normal es un encabezado principal por página.`,
  pagesNoDoctype: (i) => `Páginas sin <!doctype html>${pathsSuffix(i, 'es')}: el navegador las pinta en modo de compatibilidad.`,
  inputsWithoutLabel: (i) => `${i.n} campo(s) de formulario sin <label> asociado (ni aria-label).`,
  blockingScripts: (i) => `Scripts en <head> sin defer, async ni type="module" bloquean el pintado${pathsSuffix(i, 'es')}.`,
  inlineStyles: (i) => `${i.n} estilo(s) en línea (style="…"). Las clases en la hoja de estilo se mantienen mejor.`,
  noSemantic: () => 'No hay elementos semánticos (header, nav, main, section, footer…). Ayudan a la accesibilidad y al SEO.',
  important: (i) => `${i.n} declaración(es) con !important. Suelen indicar problemas de especificidad.`,
  manyColors: (i) => `${i.n} colores distintos en el CSS. Las variables (--color) mantienen la paleta coherente.`,
  noMediaQueries: () => 'No hay consultas @media: el diseño puede no adaptarse a distintos tamaños de pantalla.',
  varUsed: (i) => `${i.n} variable(s) declarada(s) con var. const y let tienen ámbito de bloque y evitan sorpresas.`,
  consoleLeft: (i) => `${i.n} llamada(s) a console. Quita las de depuración antes de publicar.`,
  heavyImages: (i) => `Imágenes de más de 500 KB${pathsSuffix(i, 'es')}. Comprímelas o usa WebP/AVIF.`,
  noModernImages: (i) => `${i.n} imagen(es) PNG/JPG/GIF y ninguna en WebP o AVIF, que pesan mucho menos.`,
  legacyFonts: () => 'Fuentes en TTF/OTF/EOT y ninguna en WOFF2, el formato web más ligero.',
  noLockfile: () => 'Hay package.json pero no un fichero de bloqueo (package-lock.json, pnpm-lock.yaml…): las instalaciones no son reproducibles.',
  multipleLockfiles: (i) => `Ficheros de bloqueo de varios gestores de paquetes${pathsSuffix(i, 'es')}. Deja solo uno.`,
  noGitignore: () => 'No hay .gitignore: node_modules y la carpeta de compilación podrían acabar en el repositorio.',
  envFile: () => 'Hay un fichero .env. Comprueba que está en .gitignore y que no publica claves ni contraseñas.',
  noReadme: () => 'No hay README: explica qué es el proyecto y cómo se pone en marcha.',
  noTests: () => 'No se ha detectado ninguna herramienta de pruebas (Vitest, Jest, Playwright…).',
  noLinter: () => 'No se ha detectado linter ni formateador (ESLint, Prettier, Biome, Stylelint).',
  devToolsInDeps: (i) => `Herramientas de desarrollo en dependencies en lugar de devDependencies${pathsSuffix(i, 'es')}.`,
  tsNotStrict: () => 'TypeScript no está en modo estricto ("strict": true en tsconfig.json detecta más errores).',
  jqueryWithFramework: (i) => `jQuery junto a ${join(i.items, 'es')}: suelen solaparse y añaden peso.`,
  pwaPartial: (i) => `Casi es una PWA. Falta: ${(i.checks ?? []).map((c) => esChecks[c]).join('; ')}.`,
  allImagesAlt: (i) => `Las ${i.n} imágenes tienen atributo alt.`,
  semantic: (i) => `Usa ${i.n} elemento(s) semántico(s) de HTML.`,
  flexGrid: (i) => `Maquetación con Flexbox (${i.items?.[0]}) y Grid (${i.items?.[1]}).`,
  customProperties: (i) => `Usa ${i.n} variable(s) de CSS.`,
  noVar: () => 'Todas las variables usan const o let.',
  pwaReady: () => 'PWA instalable: manifiesto, iconos y service worker.',
  tsStrict: () => 'TypeScript en modo estricto.',
  hasTests: (i) => `Tiene pruebas: ${join(i.items, 'es')}.`,
  hasLinter: (i) => `Herramientas de calidad de código: ${join(i.items, 'es')}.`,
  hasCi: (i) => `Integración continua: ${join(i.items, 'es')}.`,
  modernImages: (i) => `${i.n} imagen(es) en formatos modernos (WebP/AVIF).`,
};

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
  approx: 'Counts and detections come from a lexical analysis of the files: they are reliable for ordinary code but may be approximate in unusual cases.',
  contents: 'Contents',
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
      semanticTags: 'Semantic elements',
      aria: 'ARIA attributes and roles',
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
      colors: 'Different colours',
      fontFamilies: 'Font families',
      animations: 'Animations and transitions',
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
      domQueries: 'DOM queries (querySelector…)',
      fetchCalls: 'Network requests (fetch, axios…)',
      storage: 'Browser storage (localStorage…)',
      tsTypes: 'TypeScript types (interface, type, enum)',
      consoleCalls: 'console calls',
      comments: 'Comments',
    },
  },
  parts: { summary: 'Summary', insights: 'Observations', stack: 'Technology stack', pwa: 'Progressive web app (PWA)', pages: 'HTML pages', assets: 'Files and assets' },
  partHints: {
    summary: 'Project type, size and key figures',
    insights: 'What is done well and what to review',
    stack: 'Frameworks, build tools, styles, testing, deployment…',
    pwa: 'Manifest, icons, service worker',
    pages: 'lang, viewport, title, description… for each page',
    assets: 'Files by type, size and heaviest files',
  },
  filesByExt: (n, list) => `${n} file${n === 1 ? '' : 's'}: ${list}`,
  yes: 'yes',
  no: 'no',
  kind: {
    static: 'Static website (HTML, CSS and JavaScript without a build step)',
    staticBuild: 'Website with a build tool',
    spa: 'Single-page application (SPA)',
    fullstack: 'Web application with server rendering (SSR/SSG)',
    ssg: 'Statically generated website (SSG)',
    server: 'Server / API application',
    desktop: 'Desktop application with web technologies',
    mobile: 'Mobile application with web technologies',
    library: 'JavaScript package or library',
    unknown: 'Project without a recognisable web structure',
  },
  kindLabel: 'Project type',
  builtWith: (names) => `Built with ${names}.`,
  cards: { files: 'Files', codeLines: 'Lines of code', size: 'Size', technologies: 'Technologies', pwa: 'PWA', observations: 'To review', pages: 'HTML pages', dependencies: 'Dependencies' },
  obsCount: (w, i) => `${w} warning${w === 1 ? '' : 's'}, ${i} suggestion${i === 1 ? '' : 's'}`,
  linesBy: 'Lines by language',
  categories: {
    language: 'Languages',
    runtime: 'Runtime',
    framework: 'UI framework / library',
    metaframework: 'Meta-framework / site generator',
    build: 'Build and bundling',
    css: 'Styles',
    ui: 'Components, animation and graphics',
    state: 'State, routing and forms',
    data: 'Data and services',
    backend: 'Server',
    testing: 'Testing',
    quality: 'Code quality',
    pwa: 'PWA',
    platform: 'Platforms',
    deploy: 'Deployment',
    ci: 'Continuous integration',
    pkg: 'Package manager',
  },
  technology: 'Technology',
  version: 'Version',
  detectedIn: 'Detected in',
  devOnly: 'development',
  evidence: (e) => {
    switch (e.kind) {
      case 'dep':
        return `${e.file} (${e.dev ? 'devDependencies' : 'dependencies'})`;
      case 'file':
        return e.file;
      case 'cdn':
        return `CDN in ${e.file}`;
      case 'import':
        return `import in ${e.file}`;
      case 'ext':
        return `${e.count} file${e.count === 1 ? '' : 's'}`;
      case 'field':
        return `${e.file} (${e.field})`;
    }
  },
  noStack: 'No frameworks or tools detected: plain HTML, CSS and JavaScript.',
  packageTitle: (p) => `Package (${p})`,
  pkg: {
    name: 'Name',
    version: 'Version',
    description: 'Description',
    type: 'Modules',
    module: 'ES modules (type: module)',
    commonjs: 'CommonJS',
    license: 'Licence',
    node: 'Node.js',
    manager: 'Package manager',
    private: 'Private',
    workspaces: 'Monorepo (workspaces)',
    browserslist: 'Target browsers (browserslist)',
    typescript: 'TypeScript',
    strict: 'strict mode',
    notStrict: 'not strict',
  },
  scripts: 'Scripts (npm run …)',
  script: 'Script',
  command: 'Command',
  scriptHint: {
    dev: 'development server',
    start: 'start',
    build: 'production build',
    preview: 'preview the build',
    test: 'tests',
    lint: 'linting',
    format: 'formatting',
    deploy: 'deployment',
    serve: 'serve',
    typecheck: 'type checking',
    e2e: 'end-to-end tests',
    storybook: 'component catalogue',
  },
  dependencies: (n) => `Dependencies (${n})`,
  devDependencies: (n) => `Development dependencies (${n})`,
  dependency: 'Package',
  range: 'Version',
  projectFiles: 'Project files',
  projectFileNames: { readme: 'README', license: 'LICENSE', gitignore: '.gitignore', editorconfig: '.editorconfig', envExample: '.env.example' },
  pwaStatus: { yes: 'Installable PWA', partial: 'Partial PWA', no: 'Not a PWA' },
  pwaIntro: {
    yes: 'The project has everything a browser needs to install it as an app.',
    partial: 'The project has some PWA pieces, but not all of them.',
    no: 'No web app manifest or service worker found. To turn it into an installable app, add a manifest.webmanifest linked from the page and register a service worker.',
  },
  pwaChecks: enChecks,
  pwaCheck: 'Check',
  pwaState: 'Status',
  pwaGenerated: (p) => `The manifest and service worker are generated at build time by ${p}; check its configuration.`,
  manifestFile: 'Manifest',
  manifestFields: { name: 'name', shortName: 'short_name', startUrl: 'start_url', display: 'display', themeColor: 'theme_color', backgroundColor: 'background_color', icons: 'Icons', lang: 'lang' },
  required: 'required',
  recommended: 'recommended',
  pagesIntro: 'The basics every page needs for accessibility, mobile and search engines.',
  pageCols: { page: 'Page', lang: 'lang', viewport: 'viewport', title: 'title', description: 'description', favicon: 'favicon', og: 'Open Graph', h1: 'h1', main: '<main>' },
  noPages: 'No complete HTML pages (with <html> or <head>).',
  fragments: (n) => `${n} HTML fragment${n === 1 ? '' : 's'} or partial template${n === 1 ? '' : 's'} not reviewed.`,
  fileCategories: {
    markup: 'Markup (HTML, templates)',
    styles: 'Styles',
    scripts: 'Scripts',
    components: 'Components (.vue, .svelte, .astro)',
    images: 'Images',
    fonts: 'Fonts',
    media: 'Audio, video and 3D',
    data: 'Data and configuration (JSON, YAML…)',
    docs: 'Documents',
    config: 'Dotfiles and tool configuration',
    other: 'Other',
  },
  category: 'Type',
  files: 'Files',
  size: 'Size',
  extensions: 'Extensions',
  largest: 'Largest files',
  total: 'Total',
  truncated: 'The project has more files than the limit (webReport.maxFiles × 5): the inventory is partial.',
  levels: { warn: 'Review', info: 'Suggestion', good: 'Well done' },
  insight: (i) => enInsights[i.id](i),
  noInsights: 'Nothing to point out.',
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
  approx: 'Los conteos y las detecciones salen de un análisis léxico de los ficheros: son fiables con código normal, pero pueden ser aproximados en casos raros.',
  contents: 'Contenido',
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
      semanticTags: 'Elementos semánticos',
      aria: 'Atributos ARIA y roles',
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
      colors: 'Colores distintos',
      fontFamilies: 'Familias tipográficas',
      animations: 'Animaciones y transiciones',
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
      domQueries: 'Consultas al DOM (querySelector…)',
      fetchCalls: 'Peticiones de red (fetch, axios…)',
      storage: 'Almacenamiento del navegador (localStorage…)',
      tsTypes: 'Tipos de TypeScript (interface, type, enum)',
      consoleCalls: 'Llamadas a console',
      comments: 'Comentarios',
    },
  },
  parts: { summary: 'Resumen', insights: 'Observaciones', stack: 'Stack tecnológico', pwa: 'Aplicación web progresiva (PWA)', pages: 'Páginas HTML', assets: 'Ficheros y recursos' },
  partHints: {
    summary: 'Tipo de proyecto, tamaño y cifras clave',
    insights: 'Lo que está bien y lo que conviene revisar',
    stack: 'Frameworks, compilación, estilos, pruebas, despliegue…',
    pwa: 'Manifiesto, iconos, service worker',
    pages: 'lang, viewport, título, descripción… de cada página',
    assets: 'Ficheros por tipo, peso y los más pesados',
  },
  filesByExt: (n, list) => `${n} fichero${n === 1 ? '' : 's'}: ${list}`,
  yes: 'sí',
  no: 'no',
  kind: {
    static: 'Sitio web estático (HTML, CSS y JavaScript sin compilación)',
    staticBuild: 'Sitio web con herramienta de compilación',
    spa: 'Aplicación de una sola página (SPA)',
    fullstack: 'Aplicación web con renderizado en el servidor (SSR/SSG)',
    ssg: 'Sitio web generado estáticamente (SSG)',
    server: 'Aplicación de servidor / API',
    desktop: 'Aplicación de escritorio con tecnologías web',
    mobile: 'Aplicación móvil con tecnologías web',
    library: 'Paquete o biblioteca de JavaScript',
    unknown: 'Proyecto sin una estructura web reconocible',
  },
  kindLabel: 'Tipo de proyecto',
  builtWith: (names) => `Hecho con ${names}.`,
  cards: { files: 'Ficheros', codeLines: 'Líneas de código', size: 'Tamaño', technologies: 'Tecnologías', pwa: 'PWA', observations: 'A revisar', pages: 'Páginas HTML', dependencies: 'Dependencias' },
  obsCount: (w, i) => `${w} aviso${w === 1 ? '' : 's'}, ${i} sugerencia${i === 1 ? '' : 's'}`,
  linesBy: 'Líneas por lenguaje',
  categories: {
    language: 'Lenguajes',
    runtime: 'Entorno de ejecución',
    framework: 'Framework / biblioteca de interfaz',
    metaframework: 'Metaframework / generador de sitios',
    build: 'Compilación y empaquetado',
    css: 'Estilos',
    ui: 'Componentes, animación y gráficos',
    state: 'Estado, rutas y formularios',
    data: 'Datos y servicios',
    backend: 'Servidor',
    testing: 'Pruebas',
    quality: 'Calidad de código',
    pwa: 'PWA',
    platform: 'Plataformas',
    deploy: 'Despliegue',
    ci: 'Integración continua',
    pkg: 'Gestor de paquetes',
  },
  technology: 'Tecnología',
  version: 'Versión',
  detectedIn: 'Detectado en',
  devOnly: 'desarrollo',
  evidence: (e) => {
    switch (e.kind) {
      case 'dep':
        return `${e.file} (${e.dev ? 'devDependencies' : 'dependencies'})`;
      case 'file':
        return e.file;
      case 'cdn':
        return `CDN en ${e.file}`;
      case 'import':
        return `import en ${e.file}`;
      case 'ext':
        return `${e.count} fichero${e.count === 1 ? '' : 's'}`;
      case 'field':
        return `${e.file} (${e.field})`;
    }
  },
  noStack: 'No se han detectado frameworks ni herramientas: HTML, CSS y JavaScript a secas.',
  packageTitle: (p) => `Paquete (${p})`,
  pkg: {
    name: 'Nombre',
    version: 'Versión',
    description: 'Descripción',
    type: 'Módulos',
    module: 'Módulos ES (type: module)',
    commonjs: 'CommonJS',
    license: 'Licencia',
    node: 'Node.js',
    manager: 'Gestor de paquetes',
    private: 'Privado',
    workspaces: 'Monorepo (workspaces)',
    browserslist: 'Navegadores objetivo (browserslist)',
    typescript: 'TypeScript',
    strict: 'modo estricto',
    notStrict: 'no estricto',
  },
  scripts: 'Scripts (npm run …)',
  script: 'Script',
  command: 'Orden',
  scriptHint: {
    dev: 'servidor de desarrollo',
    start: 'arrancar',
    build: 'compilación para producción',
    preview: 'previsualizar la compilación',
    test: 'pruebas',
    lint: 'revisión del código',
    format: 'formateo',
    deploy: 'despliegue',
    serve: 'servir',
    typecheck: 'comprobación de tipos',
    e2e: 'pruebas de extremo a extremo',
    storybook: 'catálogo de componentes',
  },
  dependencies: (n) => `Dependencias (${n})`,
  devDependencies: (n) => `Dependencias de desarrollo (${n})`,
  dependency: 'Paquete',
  range: 'Versión',
  projectFiles: 'Ficheros del proyecto',
  projectFileNames: { readme: 'README', license: 'LICENSE', gitignore: '.gitignore', editorconfig: '.editorconfig', envExample: '.env.example' },
  pwaStatus: { yes: 'PWA instalable', partial: 'PWA a medias', no: 'No es una PWA' },
  pwaIntro: {
    yes: 'El proyecto tiene todo lo que necesita un navegador para instalarlo como aplicación.',
    partial: 'El proyecto tiene algunas piezas de PWA, pero no todas.',
    no: 'No hay manifiesto ni service worker. Para que se pueda instalar como aplicación, añade un manifest.webmanifest enlazado desde la página y registra un service worker.',
  },
  pwaChecks: esChecks,
  pwaCheck: 'Comprobación',
  pwaState: 'Estado',
  pwaGenerated: (p) => `El manifiesto y el service worker los genera ${p} al compilar; revisa su configuración.`,
  manifestFile: 'Manifiesto',
  manifestFields: { name: 'name', shortName: 'short_name', startUrl: 'start_url', display: 'display', themeColor: 'theme_color', backgroundColor: 'background_color', icons: 'Iconos', lang: 'lang' },
  required: 'imprescindible',
  recommended: 'recomendable',
  pagesIntro: 'Lo básico que necesita cada página para la accesibilidad, el móvil y los buscadores.',
  pageCols: { page: 'Página', lang: 'lang', viewport: 'viewport', title: 'título', description: 'descripción', favicon: 'favicon', og: 'Open Graph', h1: 'h1', main: '<main>' },
  noPages: 'No hay páginas HTML completas (con <html> o <head>).',
  fragments: (n) => `${n} fragmento${n === 1 ? '' : 's'} o plantilla${n === 1 ? '' : 's'} parcial${n === 1 ? '' : 'es'} de HTML sin revisar.`,
  fileCategories: {
    markup: 'Marcado (HTML, plantillas)',
    styles: 'Estilos',
    scripts: 'Scripts',
    components: 'Componentes (.vue, .svelte, .astro)',
    images: 'Imágenes',
    fonts: 'Fuentes',
    media: 'Audio, vídeo y 3D',
    data: 'Datos y configuración (JSON, YAML…)',
    docs: 'Documentos',
    config: 'Ficheros ocultos y configuración de herramientas',
    other: 'Otros',
  },
  category: 'Tipo',
  files: 'Ficheros',
  size: 'Tamaño',
  extensions: 'Extensiones',
  largest: 'Ficheros más pesados',
  total: 'Total',
  truncated: 'El proyecto tiene más ficheros que el límite (webReport.maxFiles × 5): el inventario es parcial.',
  levels: { warn: 'Revisar', info: 'Sugerencia', good: 'Bien hecho' },
  insight: (i) => esInsights[i.id](i),
  noInsights: 'Nada que señalar.',
};

export const STRINGS: Record<ReportLocale, Strings> = { en, es };

/** 'auto' sigue el idioma de VS Code (p. ej. «es», «es-ES» → español; el resto, inglés). */
export function resolveLocale(setting: string, vscodeLanguage: string): ReportLocale {
  if (setting === 'en' || setting === 'es') return setting;
  return vscodeLanguage.toLowerCase().startsWith('es') ? 'es' : 'en';
}
