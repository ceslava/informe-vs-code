/** Inventario de ficheros del proyecto: cuántos hay de cada tipo y cuánto pesan. */

export type FileCategory = 'markup' | 'styles' | 'scripts' | 'components' | 'images' | 'fonts' | 'media' | 'data' | 'docs' | 'config' | 'other';

export const FILE_CATEGORIES: readonly FileCategory[] = ['markup', 'styles', 'scripts', 'components', 'images', 'fonts', 'media', 'data', 'docs', 'config', 'other'];

const CATEGORY_EXT: Record<Exclude<FileCategory, 'other'>, RegExp> = {
  markup: /\.(?:html?|xhtml|njk|hbs|handlebars|ejs|pug|liquid|twig|php)$/i,
  styles: /\.(?:css|s[ac]ss|less|styl|pcss|postcss)$/i,
  scripts: /\.(?:m?[jt]sx?|c[jt]s)$/i,
  components: /\.(?:vue|svelte|astro)$/i,
  images: /\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|heic)$/i,
  fonts: /\.(?:woff2?|ttf|otf|eot)$/i,
  media: /\.(?:mp4|webm|ogv|mov|mp3|ogg|oga|wav|flac|m4a|aac|vtt|glb|gltf)$/i,
  data: /\.(?:json5?|ya?ml|toml|xml|csv|tsv|webmanifest|geojson)$/i,
  docs: /\.(?:mdx?|txt|pdf|rtf|docx?)$/i,
  config: /(?:^|\/)(?:\.[\w.-]+rc(?:\.\w+)?|\.editorconfig|\.gitignore|\.gitattributes|\.npmrc|\.nvmrc|\.env[\w.-]*|Dockerfile|Procfile|Makefile)$/i,
};

export function categoryOf(path: string): FileCategory {
  for (const c of FILE_CATEGORIES) {
    if (c !== 'other' && CATEGORY_EXT[c].test(path)) return c;
  }
  return 'other';
}

export interface Inventory {
  totalFiles: number;
  totalBytes: number;
  byCategory: { category: FileCategory; files: number; bytes: number; ext: Record<string, number> }[];
  largest: { path: string; size: number }[];
  /** Imágenes de más de HEAVY_IMAGE bytes. */
  heavyImages: { path: string; size: number }[];
  imageFormats: Record<string, number>;
  fontFormats: Record<string, number>;
  /** Hay más ficheros de los que se han podido mirar. */
  truncated: boolean;
}

export const HEAVY_IMAGE = 500 * 1024;

const extOf = (p: string) => {
  const base = p.split('/').pop() ?? p;
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : base.startsWith('.') ? base.toLowerCase() : '—';
};

export function buildInventory(files: readonly { path: string; size: number }[], truncated = false): Inventory {
  const map = new Map<FileCategory, { files: number; bytes: number; ext: Record<string, number> }>();
  const imageFormats: Record<string, number> = {};
  const fontFormats: Record<string, number> = {};
  let totalBytes = 0;
  for (const f of files) {
    const c = categoryOf(f.path);
    const e = map.get(c) ?? { files: 0, bytes: 0, ext: {} };
    e.files++;
    e.bytes += f.size;
    const ext = extOf(f.path);
    e.ext[ext] = (e.ext[ext] ?? 0) + 1;
    map.set(c, e);
    totalBytes += f.size;
    if (c === 'images') imageFormats[ext === 'jpeg' ? 'jpg' : ext] = (imageFormats[ext === 'jpeg' ? 'jpg' : ext] ?? 0) + 1;
    if (c === 'fonts') fontFormats[ext] = (fontFormats[ext] ?? 0) + 1;
  }
  const bySize = [...files].sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
  return {
    totalFiles: files.length,
    totalBytes,
    byCategory: FILE_CATEGORIES.filter((c) => map.has(c)).map((c) => ({ category: c, ...map.get(c)! })),
    largest: bySize.slice(0, 8).filter((f) => f.size > 0),
    heavyImages: bySize.filter((f) => categoryOf(f.path) === 'images' && f.size > HEAVY_IMAGE && !/\.svg$/i.test(f.path)).slice(0, 10),
    imageFormats,
    fontFormats,
    truncated,
  };
}

export function formatBytes(n: number, locale: 'en' | 'es'): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const s = v.toLocaleString(locale === 'es' ? 'es-ES' : 'en-GB', { maximumFractionDigits: i === 0 ? 0 : 1 });
  return `${s} ${units[i]}`;
}
