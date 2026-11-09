# Web Code Stats: HTML, CSS & JS Report

*Informe del proyecto web*

Extensión de VS Code que crea un informe completo de un proyecto web, con autor, en español o en inglés: qué
tipo de proyecto es y con qué está hecho (React, Vue, Vite, Tailwind, PWA…), observaciones con lo que está bien
y lo que conviene revisar, las páginas HTML, los recursos y lo que elijas contar en HTML, CSS y JavaScript/TypeScript.
*English below.*

![Informe en español con tema oscuro](images/informe-es.png)

## Español

### Qué incluye el informe

| Parte | Qué muestra |
|---|---|
| **Resumen** | tipo de proyecto (sitio estático, SPA, SSR/SSG, servidor, escritorio, móvil…), con qué está hecho, ficheros, líneas de código por lenguaje, tamaño, tecnologías, dependencias, estado PWA |
| **Observaciones** | avisos, sugerencias y aciertos: imágenes sin `alt`, páginas sin `lang` o `viewport`, `var`, `console.*`, `!important`, imágenes de más de 500 KB, falta de fichero de bloqueo o `.gitignore`, sin pruebas ni linter, TypeScript no estricto, herramientas en `dependencies`… |
| **Stack tecnológico** | lenguajes, Node.js, frameworks (React, Vue, Svelte, Angular, Solid, Lit, Alpine, htmx, jQuery…), metaframeworks (Next.js, Nuxt, SvelteKit, Astro, Remix, Eleventy, Gatsby…), compilación (Vite, Webpack, Parcel, esbuild…), estilos (Tailwind, Bootstrap, Sass, PostCSS, CSS Modules…), componentes y gráficos, estado y rutas, datos (Firebase, Supabase, Prisma…), pruebas, calidad, plataformas (Electron, Tauri, Capacitor), despliegue (Netlify, Vercel, GitHub Pages, Docker…), CI y gestor de paquetes, cada uno con su versión y dónde se ha detectado; además, los datos de `package.json`, sus scripts y dependencias |
| **PWA** | manifiesto (enlazado, `name`, `start_url`, `display`, iconos de 192 y 512, `maskable`, `theme_color`), service worker y caché sin conexión, o el plugin que los genera (`vite-plugin-pwa`, Workbox, `next-pwa`…) |
| **Páginas HTML** | por página: `lang`, `viewport`, título, descripción, favicon, Open Graph, número de `h1` y `<main>` |
| **HTML, CSS, JavaScript** | las métricas que elijas (abajo), con tabla por fichero |
| **Ficheros y recursos** | ficheros por tipo y peso (imágenes, fuentes, multimedia…) y los más pesados |

El stack se detecta por `package.json` (también en monorepos), ficheros de configuración (`vite.config.ts`,
`tailwind.config.js`, `netlify.toml`…), bibliotecas cargadas por CDN en el HTML y paquetes importados en el código.
Las partes se eligen con el ajuste `webReport.sections` o en **Elegir métricas**.

### Qué cuenta

| HTML | CSS | JavaScript |
|---|---|---|
| ficheros, líneas, elementos, etiquetas distintas, **etiquetas elegidas una a una** (`input`, `img`, `a`…), campos `<input>` (con su `type`), botones, formularios, imágenes, imágenes sin `alt`, enlaces, encabezados, elementos con `id`, clases usadas, estilos en línea, elementos semánticos, atributos ARIA, scripts, comentarios | ficheros, líneas, reglas, selectores, clases distintas, ids, declaraciones, `display: flex`, `display: grid`, `@media`, variables de CSS, `!important`, colores distintos, familias tipográficas, animaciones y transiciones, comentarios | ficheros, líneas, variables (`const`, `let`, `var`, también desestructuradas), funciones (declaradas, flecha, métodos), clases, `addEventListener`, importaciones, consultas al DOM, peticiones de red (`fetch`, axios…), `localStorage` y compañía, tipos de TypeScript, `console.*`, comentarios |

Analiza `.html`, `.css`, `.scss`, `.less`, `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx` y reparte los componentes
`.vue`, `.svelte` y `.astro` en su marcado, su script y su estilo. No cuenta lo que va en comentarios ni en cadenas:
un `"display: flex"` dentro de un texto no suma. Ignora `node_modules`, `dist`, `out`, `build`, los `.d.ts` y los
ficheros `.min.*`.

### Cómo se usa

1. Paleta de órdenes (`Ctrl+Mayús+P`): **Informe web: Elegir métricas y generar informe**. Marca lo que quieras
   contar; si marcas «Etiquetas elegidas», escribe cuáles (`input, img, a, button`). Se guarda en los ajustes del
   espacio de trabajo.
2. **Informe web: Indicar el autor del informe** pone tu nombre en la cabecera (se guarda en tus ajustes).
3. **Informe web: Generar informe** (o clic derecho en una carpeta del explorador) abre el informe en un panel con
   botones para guardarlo en Markdown o HTML, copiarlo, cambiar el autor o actualizarlo.

### Ajustes

| Ajuste | Para qué |
|---|---|
| `webReport.author` | autor del informe |
| `webReport.language` | `auto` (el de VS Code), `es` o `en` |
| `webReport.sections` | partes del informe: `summary`, `insights`, `stack`, `pwa`, `pages`, `assets` (lista vacía = solo métricas) |
| `webReport.html.metrics`, `webReport.css.metrics`, `webReport.js.metrics` | qué contar; lista vacía = no analizar ese lenguaje |
| `webReport.html.tags` | etiquetas que se cuentan una a una |
| `webReport.perFile` | tabla con cada fichero |
| `webReport.exclude`, `webReport.ignoreMinified`, `webReport.maxFiles` | qué se deja fuera |

Ejemplo de `.vscode/settings.json`:

```json
{
  "webReport.author": "Lucía Prieto",
  "webReport.language": "es",
  "webReport.html.metrics": ["elements", "inputs", "tags"],
  "webReport.html.tags": ["input", "button", "img"],
  "webReport.css.metrics": ["classes", "displayFlex", "displayGrid"],
  "webReport.js.metrics": ["variables", "functions"]
}
```

### Desarrollo

```bash
npm install
npm test                  # analizadores, informe y traducciones (Node, sin VS Code)
npm run test:integration  # dentro de un VS Code real (en Linux sin pantalla: xvfb-run -a npm run test:integration)
npm run package           # crea web-code-stats-0.2.0.vsix
```

`F5` en VS Code abre una ventana de prueba con `test-fixtures/`. Instalar el `.vsix`: Extensiones → `…` →
*Instalar desde VSIX*, o `code --install-extension web-code-stats-0.2.0.vsix`.

Los conteos y la detección del stack salen de un análisis léxico propio (sin dependencias): fiables con código
normal, aproximados en casos raros. El análisis no depende de VS Code (`src/scan.ts`), así que se prueba con Node.

## English

A VS Code extension that builds a complete report on a web project, with an author, in English or Spanish: what kind
of project it is and what it is built with (React, Vue, Vite, Tailwind, PWA…), observations on what is done well and
what to review, the HTML pages, the assets, and the counts you choose in HTML, CSS and JavaScript/TypeScript.

- **Summary**: project type (static site, SPA, SSR/SSG, server, desktop, mobile…), main technologies, files, lines
  of code per language, size, dependencies, PWA status.
- **Observations**: warnings, suggestions and things done well (missing `alt`, `lang` or `viewport`, `var`,
  leftover `console.*`, heavy images, no lockfile, no tests or linter, non-strict TypeScript…).
- **Technology stack**: frameworks, meta-frameworks, build tools, styles, UI and charts, state and routing, data,
  testing, code quality, platforms, deployment, CI and package manager, each with its version and where it was
  detected (`package.json`, config files, CDN links, imports); plus `package.json` details, scripts and dependencies.
- **PWA**: manifest fields and icons, service worker, offline cache, or the plugin that generates them.
- **HTML pages**: `lang`, `viewport`, title, description, favicon, Open Graph, `h1`, `<main>` per page.
- **Files and assets**: files by type and size, heaviest files.

Choose the parts with `webReport.sections` or in **Choose metrics**. Also analyses `.scss`, `.less`, `.jsx`, `.ts`,
`.tsx`, and splits `.vue`, `.svelte` and `.astro` components into markup, script and style.

![Report in English with a light theme](images/informe-en.png)

- **Web Code Stats: Choose metrics and generate report**: pick what to count (elements, inputs, specific tags,
  classes, `display: flex`, `display: grid`, `@media`, variables, functions, event listeners…). Saved to the
  workspace settings.
- **Web Code Stats: Set report author**: your name in the report header.
- **Web Code Stats: Generate report** (or right-click a folder in the Explorer): opens the report with buttons to save
  it as Markdown or HTML, copy it, change the author or refresh it.

Settings: `webReport.author`, `webReport.language` (`auto`, `en`, `es`), `webReport.{html,css,js}.metrics` (empty
list = skip that language), `webReport.html.tags`, `webReport.perFile`, `webReport.exclude`,
`webReport.ignoreMinified`, `webReport.maxFiles`.

Comments and strings are ignored. Counts come from a dependency-free lexical analysis: reliable for ordinary code,
approximate in unusual cases.
