/**
 * Detección del stack del proyecto: lenguajes, frameworks, herramientas de
 * compilación, estilos, pruebas, calidad, despliegue, PWA… Es puro (sin
 * VS Code): recibe la lista de ficheros, el texto de unos pocos ficheros clave
 * (package.json, manifiestos…) y las señales sacadas del código.
 */

export type Category =
  | 'language'
  | 'runtime'
  | 'framework'
  | 'metaframework'
  | 'build'
  | 'css'
  | 'ui'
  | 'state'
  | 'data'
  | 'backend'
  | 'testing'
  | 'quality'
  | 'pwa'
  | 'platform'
  | 'deploy'
  | 'ci'
  | 'pkg';

export const CATEGORIES: readonly Category[] = [
  'language',
  'runtime',
  'framework',
  'metaframework',
  'build',
  'css',
  'ui',
  'state',
  'data',
  'backend',
  'testing',
  'quality',
  'pwa',
  'platform',
  'deploy',
  'ci',
  'pkg',
];

/** Evidencia de por qué se ha detectado algo (se traduce al pintar el informe). */
export type Evidence =
  | { kind: 'dep'; file: string; dev: boolean }
  | { kind: 'file'; file: string }
  | { kind: 'cdn'; file: string }
  | { kind: 'import'; file: string }
  | { kind: 'ext'; ext: string; count: number }
  | { kind: 'field'; file: string; field: string };

export interface StackItem {
  name: string;
  category: Category;
  version?: string;
  evidence: Evidence[];
  /** Solo en devDependencies (herramienta de desarrollo). */
  devOnly?: boolean;
}

export interface PackageInfo {
  path: string;
  name?: string;
  version?: string;
  description?: string;
  private?: boolean;
  type?: string;
  license?: string;
  packageManager?: string;
  engines?: Record<string, string>;
  workspaces: boolean;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  browserslist: boolean;
}

export interface ManifestInfo {
  path: string;
  name?: string;
  shortName?: string;
  startUrl?: string;
  display?: string;
  themeColor?: string;
  backgroundColor?: string;
  description?: string;
  lang?: string;
  icons: { sizes: string[]; purposes: string[]; count: number };
  screenshots: number;
  shortcuts: number;
  parseError?: boolean;
}

export type PwaCheckId =
  | 'manifest'
  | 'manifestLinked'
  | 'name'
  | 'startUrl'
  | 'display'
  | 'icon192'
  | 'icon512'
  | 'maskable'
  | 'themeColor'
  | 'serviceWorker'
  | 'offline'
  | 'screenshots';

export interface PwaInfo {
  status: 'yes' | 'partial' | 'no';
  manifest?: ManifestInfo;
  /** Plugin que genera el manifiesto y el service worker al compilar (vite-plugin-pwa…). */
  generator?: string;
  /** Ficheros que registran un service worker o que lo son. */
  serviceWorker: string[];
  checks: { id: PwaCheckId; ok: boolean; required: boolean }[];
}

export type ProjectKind =
  | 'static'
  | 'staticBuild'
  | 'spa'
  | 'fullstack'
  | 'ssg'
  | 'server'
  | 'desktop'
  | 'mobile'
  | 'library'
  | 'unknown';

export interface StackInfo {
  kind: ProjectKind;
  /** Las piezas que mejor describen el proyecto (p. ej. React, Vite). */
  highlights: string[];
  items: StackItem[];
  packages: PackageInfo[];
  pwa: PwaInfo;
  typescriptStrict?: boolean;
  nodeVersion?: string;
  monorepo: boolean;
  esModules: boolean;
  /** Ficheros de proyecto que conviene tener. */
  projectFiles: { readme: boolean; license: boolean; gitignore: boolean; editorconfig: boolean; envExample: boolean; env: boolean };
  lockfiles: string[];
}

/** Señales que se sacan del código mientras se analizan HTML y JS. */
export interface CodeSignals {
  /** URL externas de <script src> y <link href>, con la página donde aparecen. */
  urls: { url: string; file: string }[];
  /** Paquetes importados por nombre (import … from 'react'). */
  imports: { name: string; file: string }[];
  /** Ficheros que llaman a navigator.serviceWorker.register. */
  swRegister: string[];
  /** Ficheros que usan la Cache API o Workbox (funcionamiento sin conexión). */
  cacheApi: string[];
  /** <link rel="manifest" href> por página. */
  manifestLinks: { href: string; file: string }[];
  importMap: string[];
  moduleScripts: number;
}

export function emptySignals(): CodeSignals {
  return { urls: [], imports: [], swRegister: [], cacheApi: [], manifestLinks: [], importMap: [], moduleScripts: 0 };
}

const ATTR = (name: string) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
const attr = (tag: string, name: string) => {
  const m = ATTR(name).exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : undefined;
};

/** Saca señales de un HTML (o de la parte de plantilla de un componente). */
export function collectHtmlSignals(file: string, text: string, into: CodeSignals): void {
  const src = text.replace(/<!--[\s\S]*?-->/g, '');
  for (const m of src.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = m[0];
    const isScript = m[1].toLowerCase() === 'script';
    const url = attr(tag, isScript ? 'src' : 'href');
    if (url && /^(?:https?:)?\/\//i.test(url)) into.urls.push({ url, file });
    if (isScript) {
      const type = (attr(tag, 'type') ?? '').toLowerCase();
      if (type === 'module') into.moduleScripts++;
      if (type === 'importmap') into.importMap.push(file);
    } else {
      const rel = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
      if (rel.includes('manifest')) into.manifestLinks.push({ href: attr(tag, 'href') ?? '', file });
    }
  }
  // Import maps y scripts en línea: también pueden importar paquetes o registrar un service worker.
  for (const m of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    if (m[1].trim()) collectJsSignals(file, m[1], into);
  }
}

/** Nombre del paquete a partir de un especificador: «@scope/pkg/sub» → «@scope/pkg». */
export function packageName(spec: string): string | undefined {
  if (/^(?:\.|\/|[a-z]+:|#|~)/i.test(spec) || spec.includes('${')) {
    // URL de CDN tipo esm.sh/react@18 o cdn.skypack.dev/vue
    const cdn = /^(?:https?:)?\/\/(?:esm\.sh|cdn\.skypack\.dev|esm\.run|cdn\.jsdelivr\.net\/npm|unpkg\.com|jspm\.dev|ga\.jspm\.io\/npm:)\/?((?:@[\w.-]+\/)?[\w.-]+)/i.exec(
      spec,
    );
    return cdn ? cdn[1].replace(/@[\d^~.x*-]+.*$/, '') : undefined;
  }
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Saca señales de un fichero JavaScript/TypeScript. No hace falta que esté limpio de comentarios. */
export function collectJsSignals(file: string, text: string, into: CodeSignals): void {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  const specs = [
    ...code.matchAll(/\bimport\s+(?:[\w$*{}\s,]+\s+from\s+)?["']([^"'\n]+)["']/g),
    ...code.matchAll(/\bexport\s+[\w$*{}\s,]+\s+from\s+["']([^"'\n]+)["']/g),
    ...code.matchAll(/\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g),
    ...code.matchAll(/\brequire\s*\(\s*["']([^"'\n]+)["']\s*\)/g),
  ];
  for (const m of specs) {
    const name = packageName(m[1]);
    if (name && !name.startsWith('node:')) into.imports.push({ name, file });
  }
  if (/\bserviceWorker\s*\.\s*register\s*\(/.test(code) || /\bregisterSW\b|virtual:pwa-register/.test(code))
    into.swRegister.push(file);
  if (/\bcaches\s*\.\s*(?:open|match)\s*\(|\bworkbox\b|\bimportScripts\s*\([^)]*workbox/i.test(code)) into.cacheApi.push(file);
}

interface Rule {
  name: string;
  cat: Category;
  /** Paquetes de npm; «@scope/*» vale para todo el scope. */
  deps?: string[];
  /** Ficheros o carpetas que lo delatan (se compara con la ruta relativa). */
  files?: RegExp;
  /** URL de CDN. */
  urls?: RegExp;
}

const CFG = (base: string) => new RegExp(`(?:^|/)${base}\\.(?:js|cjs|mjs|ts|cts|mts|json)$`);

const RULES: Rule[] = [
  // Frameworks de interfaz
  { name: 'React', cat: 'framework', deps: ['react', 'react-dom'], urls: /\breact(?:-dom)?(?:@|\/umd\/|\.(?:production|development))/i },
  { name: 'Preact', cat: 'framework', deps: ['preact'], urls: /\bpreact(?:@|\/)/i },
  { name: 'Vue', cat: 'framework', deps: ['vue'], files: /\.vue$/, urls: /\bvue(?:@\d|\/dist\/|\.global|\.esm)/i },
  { name: 'Svelte', cat: 'framework', deps: ['svelte'], files: /\.svelte$/ },
  { name: 'Angular', cat: 'framework', deps: ['@angular/core'], files: /(?:^|\/)angular\.json$/ },
  { name: 'SolidJS', cat: 'framework', deps: ['solid-js'] },
  { name: 'Lit', cat: 'framework', deps: ['lit', 'lit-element'], urls: /\blit(?:@|-element)/i },
  { name: 'Qwik', cat: 'framework', deps: ['@builder.io/qwik', '@qwik.dev/core'] },
  { name: 'Alpine.js', cat: 'framework', deps: ['alpinejs'], urls: /alpinejs/i },
  { name: 'htmx', cat: 'framework', deps: ['htmx.org'], urls: /htmx(?:\.org|\.min\.js|@)/i },
  { name: 'Stimulus', cat: 'framework', deps: ['@hotwired/stimulus'] },
  { name: 'jQuery', cat: 'framework', deps: ['jquery'], urls: /jquery(?:[.-]\d|\.min|\.js|@|\/)/i },
  // Metaframeworks y generadores de sitios
  { name: 'Next.js', cat: 'metaframework', deps: ['next'], files: CFG('next\\.config') },
  { name: 'Nuxt', cat: 'metaframework', deps: ['nuxt', 'nuxt3'], files: CFG('nuxt\\.config') },
  { name: 'SvelteKit', cat: 'metaframework', deps: ['@sveltejs/kit'] },
  { name: 'Remix', cat: 'metaframework', deps: ['@remix-run/*'] },
  { name: 'React Router (framework)', cat: 'metaframework', deps: ['@react-router/dev'] },
  { name: 'Astro', cat: 'metaframework', deps: ['astro'], files: /(?:^|\/)astro\.config\.\w+$|\.astro$/ },
  { name: 'Gatsby', cat: 'metaframework', deps: ['gatsby'], files: CFG('gatsby-config') },
  { name: 'Eleventy', cat: 'metaframework', deps: ['@11ty/eleventy'], files: /(?:^|\/)(?:\.eleventy\.js|eleventy\.config\.\w+)$/ },
  { name: 'VitePress', cat: 'metaframework', deps: ['vitepress'], files: /(?:^|\/)\.vitepress\/config\.\w+$/ },
  { name: 'Docusaurus', cat: 'metaframework', deps: ['@docusaurus/core'] },
  { name: 'Hugo', cat: 'metaframework', files: /(?:^|\/)hugo\.(?:toml|ya?ml|json)$/ },
  { name: 'Jekyll', cat: 'metaframework', files: /(?:^|\/)_config\.ya?ml$/ },
  // Compilación y empaquetado
  { name: 'Vite', cat: 'build', deps: ['vite', 'rolldown-vite'], files: CFG('vite\\.config') },
  { name: 'Webpack', cat: 'build', deps: ['webpack'], files: CFG('webpack(?:\\.[\\w-]+)?\\.config') },
  { name: 'Parcel', cat: 'build', deps: ['parcel', 'parcel-bundler'], files: /(?:^|\/)\.parcelrc$/ },
  { name: 'Rollup', cat: 'build', deps: ['rollup'], files: CFG('rollup\\.config') },
  { name: 'esbuild', cat: 'build', deps: ['esbuild'] },
  { name: 'Rspack', cat: 'build', deps: ['@rspack/core', '@rspack/cli'] },
  { name: 'Babel', cat: 'build', deps: ['@babel/core'], files: /(?:^|\/)(?:\.babelrc(?:\.\w+)?|babel\.config\.\w+)$/ },
  { name: 'SWC', cat: 'build', deps: ['@swc/core'], files: /(?:^|\/)\.swcrc$/ },
  { name: 'Gulp', cat: 'build', deps: ['gulp'], files: /(?:^|\/)gulpfile\.\w+$/i },
  { name: 'Grunt', cat: 'build', deps: ['grunt'], files: /(?:^|\/)gruntfile\.\w+$/i },
  { name: 'Turborepo', cat: 'build', deps: ['turbo'], files: /(?:^|\/)turbo\.json$/ },
  { name: 'Nx', cat: 'build', deps: ['nx'], files: /(?:^|\/)nx\.json$/ },
  // Estilos
  { name: 'Tailwind CSS', cat: 'css', deps: ['tailwindcss', '@tailwindcss/*'], files: CFG('tailwind\\.config'), urls: /tailwindcss/i },
  { name: 'Bootstrap', cat: 'css', deps: ['bootstrap', 'react-bootstrap'], urls: /bootstrap(?:@|\.min|\/dist|\.bundle|\.css)/i },
  { name: 'Bulma', cat: 'css', deps: ['bulma'], urls: /bulma/i },
  { name: 'Pico CSS', cat: 'css', deps: ['@picocss/pico'], urls: /picocss|pico(?:\.min)?\.css/i },
  { name: 'UnoCSS', cat: 'css', deps: ['unocss', '@unocss/*'], files: CFG('uno\\.config') },
  { name: 'Sass', cat: 'css', deps: ['sass', 'sass-embedded', 'node-sass'] },
  { name: 'Less', cat: 'css', deps: ['less'] },
  { name: 'PostCSS', cat: 'css', deps: ['postcss'], files: /(?:^|\/)(?:postcss\.config\.\w+|\.postcssrc(?:\.\w+)?)$/ },
  { name: 'Autoprefixer', cat: 'css', deps: ['autoprefixer'] },
  { name: 'CSS Modules', cat: 'css', files: /\.module\.(?:css|scss|sass|less)$/ },
  { name: 'styled-components', cat: 'css', deps: ['styled-components'] },
  { name: 'Emotion', cat: 'css', deps: ['@emotion/*'] },
  { name: 'Normalize.css', cat: 'css', deps: ['normalize.css', 'modern-normalize'], urls: /normalize/i },
  { name: 'Animate.css', cat: 'css', deps: ['animate.css'], urls: /animate(?:\.min)?\.css/i },
  { name: 'Google Fonts', cat: 'css', urls: /fonts\.(?:googleapis|gstatic)\.com/i },
  { name: 'Font Awesome', cat: 'css', deps: ['@fortawesome/*', 'font-awesome'], urls: /font-?awesome|kit\.fontawesome/i },
  { name: 'Bootstrap Icons', cat: 'css', deps: ['bootstrap-icons'], urls: /bootstrap-icons/i },
  // Componentes, animación, gráficos
  { name: 'MUI', cat: 'ui', deps: ['@mui/material', '@material-ui/core'] },
  { name: 'Chakra UI', cat: 'ui', deps: ['@chakra-ui/react'] },
  { name: 'Ant Design', cat: 'ui', deps: ['antd'] },
  { name: 'Radix UI', cat: 'ui', deps: ['@radix-ui/*', 'radix-ui'] },
  { name: 'shadcn/ui', cat: 'ui', files: /(?:^|\/)components\.json$/ },
  { name: 'Headless UI', cat: 'ui', deps: ['@headlessui/react', '@headlessui/vue'] },
  { name: 'Vuetify', cat: 'ui', deps: ['vuetify'] },
  { name: 'PrimeVue', cat: 'ui', deps: ['primevue'] },
  { name: 'PrimeReact', cat: 'ui', deps: ['primereact'] },
  { name: 'Element Plus', cat: 'ui', deps: ['element-plus'] },
  { name: 'DaisyUI', cat: 'ui', deps: ['daisyui'] },
  { name: 'Lucide', cat: 'ui', deps: ['lucide', 'lucide-react', 'lucide-vue-next'] },
  { name: 'Framer Motion', cat: 'ui', deps: ['framer-motion', 'motion'] },
  { name: 'GSAP', cat: 'ui', deps: ['gsap'], urls: /gsap/i },
  { name: 'Three.js', cat: 'ui', deps: ['three'], urls: /\bthree(?:@|\.module|\.min|\/build)/i },
  { name: 'Chart.js', cat: 'ui', deps: ['chart.js', 'react-chartjs-2'], urls: /chart\.js|chart(?:\.umd)?\.min\.js/i },
  { name: 'D3', cat: 'ui', deps: ['d3'], urls: /\bd3(?:@|\.v\d|\.min|\/dist)/i },
  { name: 'Leaflet', cat: 'ui', deps: ['leaflet', 'react-leaflet'], urls: /leaflet/i },
  { name: 'Swiper', cat: 'ui', deps: ['swiper'], urls: /swiper/i },
  { name: 'AOS', cat: 'ui', deps: ['aos'], urls: /\baos(?:@|\.js|\.css|\/dist)/i },
  { name: 'Lottie', cat: 'ui', deps: ['lottie-web', '@lottiefiles/*', 'lottie-react'], urls: /lottie/i },
  { name: 'p5.js', cat: 'ui', deps: ['p5'], urls: /\bp5(?:@|\.min|\.js)/i },
  // Estado, rutas, i18n
  { name: 'React Router', cat: 'state', deps: ['react-router', 'react-router-dom'] },
  { name: 'Vue Router', cat: 'state', deps: ['vue-router'] },
  { name: 'TanStack Router', cat: 'state', deps: ['@tanstack/react-router'] },
  { name: 'Redux', cat: 'state', deps: ['redux', '@reduxjs/toolkit', 'react-redux'] },
  { name: 'Zustand', cat: 'state', deps: ['zustand'] },
  { name: 'Pinia', cat: 'state', deps: ['pinia'] },
  { name: 'Vuex', cat: 'state', deps: ['vuex'] },
  { name: 'MobX', cat: 'state', deps: ['mobx'] },
  { name: 'Jotai', cat: 'state', deps: ['jotai'] },
  { name: 'TanStack Query', cat: 'state', deps: ['@tanstack/react-query', '@tanstack/vue-query', 'react-query'] },
  { name: 'SWR', cat: 'state', deps: ['swr'] },
  { name: 'React Hook Form', cat: 'state', deps: ['react-hook-form'] },
  { name: 'Zod', cat: 'state', deps: ['zod'] },
  { name: 'i18next', cat: 'state', deps: ['i18next', 'react-i18next'] },
  { name: 'Vue I18n', cat: 'state', deps: ['vue-i18n'] },
  // Datos y servicios
  { name: 'Axios', cat: 'data', deps: ['axios'], urls: /axios/i },
  { name: 'Firebase', cat: 'data', deps: ['firebase', 'firebase-admin'], urls: /firebase/i },
  { name: 'Supabase', cat: 'data', deps: ['@supabase/supabase-js'] },
  { name: 'Prisma', cat: 'data', deps: ['prisma', '@prisma/client'], files: /(?:^|\/)schema\.prisma$/ },
  { name: 'Drizzle ORM', cat: 'data', deps: ['drizzle-orm'] },
  { name: 'Mongoose', cat: 'data', deps: ['mongoose'] },
  { name: 'GraphQL', cat: 'data', deps: ['graphql'], files: /\.graphql$/ },
  { name: 'Apollo Client', cat: 'data', deps: ['@apollo/client'] },
  { name: 'Socket.IO', cat: 'data', deps: ['socket.io', 'socket.io-client'] },
  { name: 'Stripe', cat: 'data', deps: ['stripe', '@stripe/stripe-js'], urls: /js\.stripe\.com/i },
  // Servidor
  { name: 'Express', cat: 'backend', deps: ['express'] },
  { name: 'Fastify', cat: 'backend', deps: ['fastify'] },
  { name: 'Koa', cat: 'backend', deps: ['koa'] },
  { name: 'Hono', cat: 'backend', deps: ['hono'] },
  { name: 'NestJS', cat: 'backend', deps: ['@nestjs/core'] },
  { name: 'PHP', cat: 'backend', files: /\.php$|(?:^|\/)composer\.json$/ },
  { name: 'Python', cat: 'backend', files: /(?:^|\/)(?:requirements\.txt|pyproject\.toml|Pipfile)$|\.py$/ },
  // Pruebas
  { name: 'Vitest', cat: 'testing', deps: ['vitest'], files: CFG('vitest\\.config') },
  { name: 'Jest', cat: 'testing', deps: ['jest'], files: CFG('jest\\.config') },
  { name: 'Mocha', cat: 'testing', deps: ['mocha'], files: /(?:^|\/)\.mocharc(?:\.\w+)?$/ },
  { name: 'Jasmine', cat: 'testing', deps: ['jasmine', 'jasmine-core'] },
  { name: 'Testing Library', cat: 'testing', deps: ['@testing-library/*'] },
  { name: 'Playwright', cat: 'testing', deps: ['@playwright/test', 'playwright'], files: CFG('playwright\\.config') },
  { name: 'Cypress', cat: 'testing', deps: ['cypress'], files: CFG('cypress\\.config') },
  { name: 'Storybook', cat: 'testing', deps: ['storybook', '@storybook/*'], files: /(?:^|\/)\.storybook\// },
  // Calidad
  { name: 'ESLint', cat: 'quality', deps: ['eslint'], files: /(?:^|\/)(?:eslint\.config\.\w+|\.eslintrc(?:\.\w+)?)$/ },
  { name: 'Prettier', cat: 'quality', deps: ['prettier'], files: /(?:^|\/)(?:\.prettierrc(?:\.\w+)?|prettier\.config\.\w+)$/ },
  { name: 'Stylelint', cat: 'quality', deps: ['stylelint'], files: /(?:^|\/)(?:\.stylelintrc(?:\.\w+)?|stylelint\.config\.\w+)$/ },
  { name: 'Biome', cat: 'quality', deps: ['@biomejs/biome'], files: /(?:^|\/)biome\.jsonc?$/ },
  { name: 'Husky', cat: 'quality', deps: ['husky'], files: /(?:^|\/)\.husky\// },
  { name: 'lint-staged', cat: 'quality', deps: ['lint-staged'] },
  { name: 'commitlint', cat: 'quality', deps: ['@commitlint/cli'] },
  { name: 'EditorConfig', cat: 'quality', files: /(?:^|\/)\.editorconfig$/ },
  // PWA
  { name: 'vite-plugin-pwa', cat: 'pwa', deps: ['vite-plugin-pwa', '@vite-pwa/*'] },
  { name: 'Workbox', cat: 'pwa', deps: ['workbox-*', 'workbox-webpack-plugin'], files: /(?:^|\/)workbox-config\.\w+$/, urls: /workbox/i },
  { name: 'next-pwa', cat: 'pwa', deps: ['next-pwa', '@ducanh2912/next-pwa', '@serwist/next'] },
  { name: 'Angular service worker', cat: 'pwa', deps: ['@angular/service-worker'], files: /(?:^|\/)ngsw-config\.json$/ },
  // Plataformas
  { name: 'Electron', cat: 'platform', deps: ['electron'] },
  { name: 'Tauri', cat: 'platform', deps: ['@tauri-apps/*'], files: /(?:^|\/)src-tauri\// },
  { name: 'Capacitor', cat: 'platform', deps: ['@capacitor/core'], files: CFG('capacitor\\.config') },
  { name: 'Cordova', cat: 'platform', deps: ['cordova'], files: /(?:^|\/)config\.xml$/ },
  { name: 'React Native', cat: 'platform', deps: ['react-native'] },
  { name: 'Expo', cat: 'platform', deps: ['expo'] },
  // Despliegue
  { name: 'Netlify', cat: 'deploy', deps: ['netlify-cli'], files: /(?:^|\/)(?:netlify\.toml|_redirects)$/ },
  { name: 'Vercel', cat: 'deploy', deps: ['vercel'], files: /(?:^|\/)vercel\.json$|(?:^|\/)\.vercel\// },
  { name: 'GitHub Pages', cat: 'deploy', deps: ['gh-pages'], files: /(?:^|\/)CNAME$|(?:^|\/)\.nojekyll$/ },
  { name: 'Firebase Hosting', cat: 'deploy', files: /(?:^|\/)(?:firebase\.json|\.firebaserc)$/ },
  { name: 'Cloudflare', cat: 'deploy', deps: ['wrangler'], files: /(?:^|\/)wrangler\.(?:toml|jsonc?)$/ },
  { name: 'Docker', cat: 'deploy', files: /(?:^|\/)(?:Dockerfile|(?:docker-)?compose\.ya?ml|docker-compose\.ya?ml)$/ },
  { name: 'Render', cat: 'deploy', files: /(?:^|\/)render\.ya?ml$/ },
  { name: 'Fly.io', cat: 'deploy', files: /(?:^|\/)fly\.toml$/ },
  { name: 'Heroku', cat: 'deploy', files: /(?:^|\/)Procfile$/ },
  // Integración continua
  { name: 'GitHub Actions', cat: 'ci', files: /^\.github\/workflows\/[^/]+\.ya?ml$/ },
  { name: 'GitLab CI', cat: 'ci', files: /(?:^|\/)\.gitlab-ci\.ya?ml$/ },
  { name: 'CircleCI', cat: 'ci', files: /^\.circleci\// },
  { name: 'Azure Pipelines', cat: 'ci', files: /(?:^|\/)azure-pipelines\.ya?ml$/ },
  { name: 'Jenkins', cat: 'ci', files: /(?:^|\/)Jenkinsfile$/ },
];

const LOCKFILES: [RegExp, string][] = [
  [/(?:^|\/)package-lock\.json$/, 'npm'],
  [/(?:^|\/)npm-shrinkwrap\.json$/, 'npm'],
  [/(?:^|\/)yarn\.lock$/, 'Yarn'],
  [/(?:^|\/)pnpm-lock\.yaml$/, 'pnpm'],
  [/(?:^|\/)bun\.lockb?$/, 'Bun'],
  [/(?:^|\/)deno\.lock$/, 'Deno'],
];

/** Lenguajes según la extensión de los ficheros. */
const LANG_EXT: [string, RegExp][] = [
  ['HTML', /\.html?$/i],
  ['CSS', /\.css$/i],
  ['Sass (SCSS)', /\.s[ac]ss$/i],
  ['Less', /\.less$/i],
  ['JavaScript', /\.(?:m|c)?js$/i],
  ['JSX', /\.jsx$/i],
  ['TypeScript', /\.(?:m|c)?ts$/i],
  ['TSX', /\.tsx$/i],
  ['Vue SFC', /\.vue$/i],
  ['Svelte', /\.svelte$/i],
  ['Astro', /\.astro$/i],
  ['Markdown', /\.mdx?$/i],
  ['PHP', /\.php$/i],
  ['Python', /\.py$/i],
];

/** Qué ficheros de texto necesita leer detectStack (además del HTML y JS, que ya se leen para contar). */
export function wantedFiles(paths: readonly string[]): string[] {
  const out: string[] = [];
  let packages = 0;
  for (const p of paths) {
    const base = p.split('/').pop() ?? p;
    if (base === 'package.json' && packages < 20) {
      packages++;
      out.push(p);
    } else if (/(?:\.webmanifest|^manifest\.json|^site\.webmanifest|^manifest\.webmanifest)$/i.test(base)) out.push(p);
    else if (/^(?:\.nvmrc|\.node-version|\.tool-versions)$/.test(base)) out.push(p);
    else if (/^tsconfig(?:\.app)?\.json$/.test(base) && !p.includes('/node_modules/')) out.push(p);
    else if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(p)) out.push(p);
    else if (/^(?:sw|service-worker|serviceworker|firebase-messaging-sw)\.(?:js|ts|mjs)$/i.test(base)) out.push(p);
  }
  return out;
}

export interface StackInput {
  files: readonly { path: string; size: number }[];
  texts: Readonly<Record<string, string>>;
  signals: CodeSignals;
}

function readJson(text: string | undefined): any {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    try {
      // JSON con comentarios y comas finales (tsconfig.json)
      return JSON.parse(
        text
          .replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, s) => s ?? '')
          .replace(/,(\s*[}\]])/g, '$1'),
      );
    } catch {
      return null;
    }
  }
}

const strRecord = (o: unknown): Record<string, string> => {
  const r: Record<string, string> = {};
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (typeof v === 'string') r[k] = v;
  return r;
};

function parsePackage(path: string, text: string): PackageInfo | undefined {
  const j = readJson(text);
  if (!j || typeof j !== 'object') return undefined;
  return {
    path,
    name: typeof j.name === 'string' ? j.name : undefined,
    version: typeof j.version === 'string' ? j.version : undefined,
    description: typeof j.description === 'string' ? j.description : undefined,
    private: j.private === true,
    type: typeof j.type === 'string' ? j.type : undefined,
    license: typeof j.license === 'string' ? j.license : undefined,
    packageManager: typeof j.packageManager === 'string' ? j.packageManager : undefined,
    engines: j.engines ? strRecord(j.engines) : undefined,
    workspaces: Boolean(j.workspaces),
    scripts: strRecord(j.scripts),
    dependencies: { ...strRecord(j.peerDependencies), ...strRecord(j.dependencies) },
    devDependencies: strRecord(j.devDependencies),
    browserslist: Boolean(j.browserslist),
  };
}

/** Versión legible a partir de un rango de npm: «^18.3.1» → «18.3.1»; «workspace:*» → undefined. */
export function cleanVersion(range: string | undefined): string | undefined {
  if (!range) return undefined;
  const m = /(\d+(?:\.\d+){0,2}(?:-[\w.]+)?)/.exec(range);
  if (!m || /^(?:workspace|file|link|git|github|http)/.test(range)) return undefined;
  return m[1];
}

function versionFromUrl(url: string): string | undefined {
  const m = /@(\d+(?:\.\d+){0,2})|\/v?(\d+\.\d+(?:\.\d+)?)\/|[-.]v?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.(?:js|css)/.exec(url);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

const depMatches = (pattern: string, dep: string) =>
  pattern.endsWith('*') ? dep.startsWith(pattern.slice(0, -1)) : dep === pattern;

function parseManifest(path: string, text: string): ManifestInfo {
  const j = readJson(text);
  if (!j || typeof j !== 'object') return { path, icons: { sizes: [], purposes: [], count: 0 }, screenshots: 0, shortcuts: 0, parseError: true };
  const icons: any[] = Array.isArray(j.icons) ? j.icons : [];
  const sizes = new Set<string>();
  const purposes = new Set<string>();
  for (const i of icons) {
    for (const s of String(i?.sizes ?? '').split(/\s+/).filter(Boolean)) sizes.add(s.toLowerCase());
    for (const p of String(i?.purpose ?? 'any').split(/\s+/).filter(Boolean)) purposes.add(p.toLowerCase());
    if (/\.svg$/i.test(String(i?.src ?? '')) || String(i?.type ?? '').includes('svg')) sizes.add('any');
  }
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  return {
    path,
    name: s(j.name),
    shortName: s(j.short_name),
    startUrl: s(j.start_url),
    display: s(j.display) ?? (Array.isArray(j.display_override) ? s(j.display_override[0]) : undefined),
    themeColor: s(j.theme_color),
    backgroundColor: s(j.background_color),
    description: s(j.description),
    lang: s(j.lang),
    icons: { sizes: [...sizes], purposes: [...purposes], count: icons.length },
    screenshots: Array.isArray(j.screenshots) ? j.screenshots.length : 0,
    shortcuts: Array.isArray(j.shortcuts) ? j.shortcuts.length : 0,
  };
}

/** Resuelve el href de un <link rel="manifest"> respecto a la página. */
function resolveHref(page: string, href: string): string {
  const clean = href.replace(/[?#].*$/, '');
  const parts = clean.startsWith('/') ? [] : page.split('/').slice(0, -1);
  for (const seg of clean.replace(/^\//, '').split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

const hasSize = (m: ManifestInfo, px: number) =>
  m.icons.sizes.includes('any') ||
  m.icons.sizes.some((s) => {
    const n = parseInt(s.split('x')[0], 10);
    return n >= px;
  });

function analyzePwa(input: StackInput, items: StackItem[]): PwaInfo {
  const paths = input.files.map((f) => f.path);
  const linked = input.signals.manifestLinks;
  // Manifiesto: el enlazado desde una página (resolviendo la ruta, también desde public/) o uno con nombre típico.
  let manifestPath: string | undefined;
  for (const l of linked) {
    const target = resolveHref(l.file, l.href);
    const candidates = [target, `public/${target}`, `static/${target}`, `src/${target}`, `app/${target}`];
    manifestPath = paths.find((p) => candidates.includes(p) || (target && p.endsWith('/' + target)));
    if (manifestPath) break;
  }
  manifestPath ??= paths.find((p) => /(?:^|\/)(?:manifest\.json|[^/]*\.webmanifest)$/i.test(p) && !/(?:^|\/)(?:\.vscode|src-tauri|android|ios)\//.test(p) && input.texts[p] !== undefined && /"(?:icons|start_url|display)"/.test(input.texts[p]));
  const manifest = manifestPath && input.texts[manifestPath] !== undefined ? parseManifest(manifestPath, input.texts[manifestPath]) : undefined;
  const generator = items.find((i) => i.category === 'pwa')?.name;
  const swFiles = paths.filter((p) => /(?:^|\/)(?:sw|service-worker|serviceworker)\.(?:js|ts|mjs)$/i.test(p));
  const serviceWorker = [...new Set([...input.signals.swRegister, ...swFiles])];
  const offline = input.signals.cacheApi.length > 0 || items.some((i) => i.name === 'Workbox') || Boolean(generator);

  const gen = Boolean(generator);
  const displayOk = manifest?.display ? ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].includes(manifest.display) : false;
  const checks: PwaInfo['checks'] = [
    { id: 'manifest', ok: Boolean(manifest && !manifest.parseError) || gen, required: true },
    { id: 'manifestLinked', ok: linked.length > 0 || gen, required: true },
    { id: 'name', ok: Boolean(manifest?.name || manifest?.shortName) || gen, required: true },
    { id: 'startUrl', ok: Boolean(manifest?.startUrl) || gen, required: false },
    { id: 'display', ok: displayOk || gen, required: true },
    { id: 'icon192', ok: (manifest ? hasSize(manifest, 192) : false) || gen, required: true },
    { id: 'icon512', ok: (manifest ? hasSize(manifest, 512) : false) || gen, required: true },
    { id: 'maskable', ok: Boolean(manifest?.icons.purposes.includes('maskable')), required: false },
    { id: 'themeColor', ok: Boolean(manifest?.themeColor) || gen, required: false },
    { id: 'serviceWorker', ok: serviceWorker.length > 0 || gen, required: false },
    { id: 'offline', ok: offline, required: false },
    { id: 'screenshots', ok: (manifest?.screenshots ?? 0) > 0, required: false },
  ];
  // Desde 2024 Chrome no exige service worker para instalar, pero sí para funcionar sin conexión.
  const required = checks.filter((c) => c.required);
  const anything = Boolean(manifest) || gen || serviceWorker.length > 0 || linked.length > 0;
  const status: PwaInfo['status'] = required.every((c) => c.ok) && checks.find((c) => c.id === 'serviceWorker')!.ok
    ? 'yes'
    : anything
      ? 'partial'
      : 'no';
  return { status, manifest, generator, serviceWorker, checks };
}

export function detectStack(input: StackInput): StackInfo {
  const paths = input.files.map((f) => f.path);
  const packages: PackageInfo[] = [];
  for (const [p, text] of Object.entries(input.texts)) {
    if (p.split('/').pop() === 'package.json') {
      const pkg = parsePackage(p, text);
      if (pkg) packages.push(pkg);
    }
  }
  packages.sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));

  const items = new Map<string, StackItem>();
  const add = (name: string, category: Category, ev: Evidence, version?: string) => {
    let it = items.get(name);
    if (!it) {
      it = { name, category, evidence: [] };
      items.set(name, it);
    }
    if (version && !it.version) it.version = version;
    if (it.evidence.length < 3 && !it.evidence.some((e) => JSON.stringify(e) === JSON.stringify(ev))) it.evidence.push(ev);
  };

  // 1. Dependencias de package.json
  const depOnlyDev = new Map<string, boolean>();
  for (const rule of RULES) {
    if (!rule.deps) continue;
    for (const pkg of packages) {
      for (const [deps, dev] of [[pkg.dependencies, false], [pkg.devDependencies, true]] as const) {
        for (const [dep, range] of Object.entries(deps)) {
          if (rule.deps.some((d) => depMatches(d, dep))) {
            add(rule.name, rule.cat, { kind: 'dep', file: pkg.path, dev }, cleanVersion(range));
            depOnlyDev.set(rule.name, (depOnlyDev.get(rule.name) ?? true) && dev);
          }
        }
      }
    }
  }
  // 2. Ficheros de configuración
  for (const rule of RULES) {
    if (!rule.files) continue;
    let n = 0;
    for (const p of paths) {
      if (rule.files.test(p)) {
        add(rule.name, rule.cat, { kind: 'file', file: p });
        if (++n >= 2) break;
      }
    }
  }
  // 3. CDN e importaciones en el código
  for (const rule of RULES) {
    if (rule.urls) {
      for (const u of input.signals.urls) {
        if (rule.urls.test(u.url)) add(rule.name, rule.cat, { kind: 'cdn', file: u.file }, versionFromUrl(u.url));
      }
    }
    if (rule.deps) {
      for (const imp of input.signals.imports) {
        if (rule.deps.some((d) => depMatches(d, imp.name))) add(rule.name, rule.cat, { kind: 'import', file: imp.file });
      }
    }
  }
  for (const [name, dev] of depOnlyDev) {
    const it = items.get(name);
    if (it && dev && it.evidence.every((e) => e.kind === 'dep' || e.kind === 'file')) it.devOnly = true;
  }
  // Jekyll solo si hay además carpetas típicas; _config.yml a secas es ambiguo.
  if (items.has('Jekyll') && !paths.some((p) => /(?:^|\/)(?:_layouts|_posts|_includes)\//.test(p) || /(?:^|\/)Gemfile$/.test(p)))
    items.delete('Jekyll');
  // shadcn/ui: components.json lo usa también otra gente; exige Radix o Tailwind.
  if (items.has('shadcn/ui') && !items.has('Radix UI') && !items.has('Tailwind CSS')) items.delete('shadcn/ui');
  // Cordova: config.xml solo si no hay más pistas de que no lo es.
  if (items.has('Cordova') && !packages.some((p) => p.dependencies.cordova || p.devDependencies.cordova) && !paths.some((p) => /(?:^|\/)www\//.test(p)))
    items.delete('Cordova');
  // Con un metaframework, el framework base se queda (React con Next.js), pero Vite lo implica Astro/SvelteKit/Nuxt: se mantiene si está declarado.

  // 4. Lenguajes por extensión
  for (const [name, re] of LANG_EXT) {
    const count = paths.filter((p) => re.test(p)).length;
    if (count > 0) add(name, 'language', { kind: 'ext', ext: name, count });
  }
  const tsItem = items.get('TypeScript');
  const tsDep = packages.map((p) => p.devDependencies.typescript ?? p.dependencies.typescript).find(Boolean);
  if (tsDep) {
    if (tsItem) tsItem.version ??= cleanVersion(tsDep);
    else add('TypeScript', 'language', { kind: 'dep', file: packages.find((p) => p.devDependencies.typescript || p.dependencies.typescript)!.path, dev: true }, cleanVersion(tsDep));
  }

  // 5. Entorno: Node.js y gestor de paquetes
  let nodeVersion: string | undefined;
  for (const p of paths) {
    const base = p.split('/').pop();
    const text = input.texts[p];
    if (text === undefined) continue;
    if (base === '.nvmrc' || base === '.node-version') {
      nodeVersion ??= text.trim().split(/\s+/)[0]?.replace(/^v/, '');
      if (nodeVersion) add('Node.js', 'runtime', { kind: 'file', file: p }, nodeVersion);
    } else if (base === '.tool-versions') {
      const m = /^nodejs\s+(\S+)/m.exec(text);
      if (m) {
        nodeVersion ??= m[1];
        add('Node.js', 'runtime', { kind: 'file', file: p }, m[1]);
      }
    }
  }
  for (const pkg of packages) {
    if (pkg.engines?.node) {
      nodeVersion ??= pkg.engines.node;
      add('Node.js', 'runtime', { kind: 'field', file: pkg.path, field: 'engines.node' }, pkg.engines.node);
    }
  }
  if (packages.length > 0 && !items.has('Node.js') && (Object.keys(packages[0].scripts).length > 0 || Object.keys(packages[0].devDependencies).length > 0))
    add('Node.js', 'runtime', { kind: 'file', file: packages[0].path });
  if (paths.some((p) => /(?:^|\/)deno\.jsonc?$/.test(p))) add('Deno', 'runtime', { kind: 'file', file: paths.find((p) => /(?:^|\/)deno\.jsonc?$/.test(p))! });
  if (paths.some((p) => /(?:^|\/)bun\.lockb?$|(?:^|\/)bunfig\.toml$/.test(p))) add('Bun', 'runtime', { kind: 'file', file: paths.find((p) => /bun\.lockb?$|bunfig\.toml$/.test(p))! });

  const lockfiles: string[] = [];
  for (const p of paths) {
    for (const [re, name] of LOCKFILES) {
      if (re.test(p)) {
        lockfiles.push(p);
        add(name, 'pkg', { kind: 'file', file: p });
      }
    }
  }
  const pm = packages.find((p) => p.packageManager)?.packageManager;
  if (pm) {
    const [n, v] = pm.split('@');
    const name = { npm: 'npm', yarn: 'Yarn', pnpm: 'pnpm', bun: 'Bun' }[n] ?? n;
    add(name, 'pkg', { kind: 'field', file: packages.find((p) => p.packageManager)!.path, field: 'packageManager' }, cleanVersion(v));
  }
  if (packages.length > 0 && ![...items.values()].some((i) => i.category === 'pkg'))
    add('npm', 'pkg', { kind: 'file', file: packages[0].path });

  // GitHub Pages desplegado desde un flujo de GitHub Actions
  for (const [p, text] of Object.entries(input.texts)) {
    if (/^\.github\/workflows\//.test(p)) {
      if (/actions\/deploy-pages|peaceiris\/actions-gh-pages|JamesIves\/github-pages-deploy-action/.test(text)) add('GitHub Pages', 'deploy', { kind: 'file', file: p });
      if (/netlify/i.test(text)) add('Netlify', 'deploy', { kind: 'file', file: p });
      if (/vercel/i.test(text) && !/\bvercel\.json\b/.test(text)) add('Vercel', 'deploy', { kind: 'file', file: p });
    }
  }

  const list = [...items.values()];
  const pwa = analyzePwa(input, list);
  if (pwa.manifest) add('Web App Manifest', 'pwa', { kind: 'file', file: pwa.manifest.path });
  if (pwa.serviceWorker.length > 0) add('Service worker', 'pwa', { kind: 'file', file: pwa.serviceWorker[0] });

  // TypeScript estricto
  let typescriptStrict: boolean | undefined;
  const tsconfig = Object.keys(input.texts).find((p) => /(?:^|\/)tsconfig\.json$/.test(p));
  if (tsconfig) {
    const j = readJson(input.texts[tsconfig]);
    if (j && typeof j === 'object') typescriptStrict = j.compilerOptions?.strict === true;
  }

  const base = (p: string) => p.split('/').pop() ?? '';
  const top = paths.filter((p) => !p.includes('/'));
  const projectFiles = {
    readme: top.some((p) => /^readme(?:\.\w+)?$/i.test(p)),
    license: top.some((p) => /^(?:license|licence|copying)(?:\.\w+)?$/i.test(p)),
    gitignore: top.some((p) => p === '.gitignore'),
    editorconfig: top.some((p) => p === '.editorconfig'),
    envExample: paths.some((p) => /^\.env\.(?:example|sample|template)$/.test(base(p))),
    env: paths.some((p) => /^\.env(?:\.local|\.production|\.development)?$/.test(base(p))),
  };

  const all = [...items.values()];
  const sorted = all.sort(
    (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || evidenceWeight(b) - evidenceWeight(a) || a.name.localeCompare(b.name),
  );
  const { kind, highlights } = classify(sorted, packages, paths);
  return {
    kind,
    highlights,
    items: sorted,
    packages,
    pwa,
    typescriptStrict,
    nodeVersion,
    monorepo: packages.some((p) => p.workspaces) || items.has('Turborepo') || items.has('Nx') || paths.some((p) => /(?:^|\/)pnpm-workspace\.yaml$|(?:^|\/)lerna\.json$/.test(p)),
    esModules: packages[0]?.type === 'module' || input.signals.moduleScripts > 0,
    projectFiles,
    lockfiles,
  };
}

function evidenceWeight(i: StackItem): number {
  if (i.category === 'language') {
    const e = i.evidence.find((x) => x.kind === 'ext');
    return e && e.kind === 'ext' ? e.count : 0;
  }
  return i.evidence.some((e) => e.kind === 'dep' && !e.dev) ? 2 : 1;
}

const KIND_SSR = new Set(['Next.js', 'Nuxt', 'SvelteKit', 'Remix', 'React Router (framework)', 'Qwik']);
const KIND_SSG = new Set(['Astro', 'Gatsby', 'Eleventy', 'VitePress', 'Docusaurus', 'Hugo', 'Jekyll']);
const SPA_FRAMEWORKS = new Set(['React', 'Preact', 'Vue', 'Svelte', 'Angular', 'SolidJS', 'Lit']);

function classify(items: StackItem[], packages: PackageInfo[], paths: string[]): { kind: ProjectKind; highlights: string[] } {
  const r = classifyRaw(items, packages, paths);
  return { kind: r.kind, highlights: [...new Set(r.highlights)].slice(0, 5) };
}

function classifyRaw(items: StackItem[], packages: PackageInfo[], paths: string[]): { kind: ProjectKind; highlights: string[] } {
  const has = (n: string) => items.some((i) => i.name === n);
  const of = (c: Category) => items.filter((i) => i.category === c && !(i.evidence.length > 0 && i.evidence.every((e) => e.kind === 'import'))).map((i) => i.name);
  const meta = of('metaframework');
  const fw = of('framework').filter((n) => n !== 'jQuery' || of('framework').length === 1);
  const build = of('build').filter((n) => !['Babel', 'SWC', 'Turborepo', 'Nx', 'esbuild'].includes(n) || of('build').length === 1);
  const platform = of('platform');
  const backend = of('backend').filter((n) => n !== 'Python' && n !== 'PHP');
  const lang = has('TypeScript') ? ['TypeScript'] : [];
  const html = paths.some((p) => /\.html?$/i.test(p));
  const firstPkg = packages[0];

  if (platform.some((p) => ['Electron', 'Tauri'].includes(p))) return { kind: 'desktop', highlights: [...platform, ...fw, ...build, ...lang] };
  if (platform.some((p) => ['Capacitor', 'Cordova', 'React Native', 'Expo'].includes(p))) return { kind: 'mobile', highlights: [...platform, ...fw, ...build, ...lang] };
  const ssr = meta.filter((m) => KIND_SSR.has(m));
  if (ssr.length > 0) return { kind: 'fullstack', highlights: [...ssr, ...fw.filter((f) => f !== 'jQuery'), ...lang] };
  const ssg = meta.filter((m) => KIND_SSG.has(m));
  if (ssg.length > 0) return { kind: 'ssg', highlights: [...ssg, ...fw.filter((f) => f !== 'jQuery'), ...lang] };
  const spa = fw.filter((f) => SPA_FRAMEWORKS.has(f));
  if (spa.length > 0) return { kind: 'spa', highlights: [...spa, ...build, ...lang] };
  if (backend.length > 0 && !html) return { kind: 'server', highlights: [...backend, ...lang] };
  if (build.length > 0) return { kind: 'staticBuild', highlights: [...build, ...fw, ...lang] };
  if (html) return { kind: 'static', highlights: [...fw, ...of('css').filter((c) => !['Google Fonts', 'Font Awesome', 'Bootstrap Icons', 'Normalize.css'].includes(c)), ...lang] };
  if (backend.length > 0) return { kind: 'server', highlights: [...backend, ...lang] };
  if (firstPkg) return { kind: 'library', highlights: lang };
  return { kind: 'unknown', highlights: [] };
}
