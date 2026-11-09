import type { PageInfo } from './analyzers/page';
import { REPORT_PARTS, ReportLocale, ReportPart, STRINGS } from './i18n';
import type { Insight } from './insights';
import { formatBytes, Inventory } from './inventory';
import { FileMetrics, Language, LANGUAGES, METRICS } from './metrics';
import { CATEGORIES, StackInfo, StackItem } from './stack';

export interface SectionData {
  lang: Language;
  /** Métricas elegidas, en el orden del catálogo. */
  metrics: string[];
  total: FileMetrics;
  files: { path: string; metrics: FileMetrics }[];
  /** Ficheros por extensión (".tsx" → 8). */
  extensions?: Record<string, number>;
}

export interface ReportData {
  project: string;
  author: string;
  date: Date;
  locale: ReportLocale;
  perFile: boolean;
  /** Secciones de métricas de código (HTML, CSS, JS) elegidas. */
  sections: SectionData[];
  /** Partes del informe además de las métricas; por defecto, ninguna. */
  parts?: readonly ReportPart[];
  /** Totales de los tres lenguajes, aunque no se hayan elegido métricas (para el resumen y las observaciones). */
  totals?: Partial<Record<Language, FileMetrics>>;
  stack?: StackInfo;
  pages?: PageInfo[];
  inventory?: Inventory;
  insights?: Insight[];
}

const MAX_DETAILS = 15;
const MAX_ROWS = 60;

/** Ordena las métricas elegidas como en el catálogo y quita las que no existen. */
export function orderMetrics(lang: Language, chosen: readonly string[]): string[] {
  const set = new Set(chosen);
  return METRICS[lang].map((m) => m.id).filter((id) => set.has(id));
}

/** Ordena las partes elegidas y quita las que no existen. */
export function orderParts(chosen: readonly string[]): ReportPart[] {
  const set = new Set(chosen);
  return REPORT_PARTS.filter((p) => set.has(p));
}

function formatDate(d: Date, locale: ReportLocale): string {
  return d.toLocaleString(locale === 'es' ? 'es-ES' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' });
}

const fmtNum = (n: number, locale: ReportLocale) => n.toLocaleString(locale === 'es' ? 'es-ES' : 'en-GB');

function sortedDetails(details: Record<string, number>): [string, number][] {
  return Object.entries(details).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function detailsText(details: Record<string, number> | undefined, locale: ReportLocale): string {
  if (!details) return '';
  const entries = sortedDetails(details).filter(([, v]) => v > 0);
  if (entries.length === 0) return '';
  const keys = STRINGS[locale].detailKeys;
  const shown = entries.slice(0, MAX_DETAILS).map(([k, v]) => `${keys[k] ?? k}: ${v}`);
  if (entries.length > MAX_DETAILS) shown.push(STRINGS[locale].more(entries.length - MAX_DETAILS));
  return shown.join(', ');
}

/* ------------------------------------------------------------------ */
/* Modelo intermedio: el informe se arma con bloques y luego se pinta  */
/* en Markdown o en HTML.                                              */
/* ------------------------------------------------------------------ */

type Tone = 'good' | 'warn' | 'bad' | 'neutral';
interface RichCell {
  text: string;
  code?: boolean;
  ok?: boolean;
  muted?: boolean;
  tone?: Tone;
}
type Cell = string | number | RichCell;

type Block =
  | { t: 'h3'; text: string }
  | { t: 'p'; text: string; muted?: boolean; strong?: string }
  | { t: 'kv'; items: [string, Cell][] }
  | { t: 'cards'; items: { label: string; value: string; hint?: string; tone?: Tone }[] }
  | { t: 'notes'; items: { level: 'warn' | 'info' | 'good'; label: string; text: string }[] }
  | { t: 'bar'; items: { label: string; value: number; key: string }[] }
  | { t: 'table'; head: string[]; rows: Cell[][]; numeric?: number[]; rowHeader?: boolean; collapsed?: string; fixed?: boolean };

interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

const ok = (v: boolean, text?: string): RichCell => ({ text: text ?? (v ? '✓' : '✗'), ok: v });

function itemLabel(i: StackItem): string {
  return i.version ? `${i.name} ${i.version}` : i.name;
}

function codeTitle(s: SectionData, locale: ReportLocale): string {
  const t = STRINGS[locale];
  if (s.lang === 'js' && Object.keys(s.extensions ?? {}).some((e) => /^\.(?:tsx?|mts|cts)$/.test(e))) return 'JavaScript / TypeScript';
  if (s.lang === 'css' && Object.keys(s.extensions ?? {}).some((e) => /^\.(?:s[ac]ss|less)$/.test(e))) return 'CSS / Sass / Less';
  return t.sections[s.lang];
}

function extLine(s: SectionData, locale: ReportLocale): string | undefined {
  const ext = Object.entries(s.extensions ?? {}).sort((a, b) => b[1] - a[1]);
  if (ext.length === 0) return undefined;
  const n = ext.reduce((a, [, v]) => a + v, 0);
  return STRINGS[locale].filesByExt(n, ext.map(([e, v]) => `${e} ${v}`).join(', '));
}

function summarySection(r: ReportData): Section {
  const t = STRINGS[r.locale];
  const blocks: Block[] = [];
  const st = r.stack;
  if (st) {
    const names = st.highlights.map((h) => {
      const it = st.items.find((i) => i.name === h);
      return it ? itemLabel(it) : h;
    });
    blocks.push({
      t: 'p',
      strong: t.kind[st.kind] + '.',
      text: names.length ? ' ' + t.builtWith(new Intl.ListFormat(r.locale, { type: 'conjunction' }).format(names)) : '',
    });
  }
  const cards: Extract<Block, { t: 'cards' }>['items'] = [];
  const totals = r.totals ?? Object.fromEntries(r.sections.map((s) => [s.lang, s.total]));
  const lines = LANGUAGES.map((l) => ({ lang: l, lines: totals[l]?.lines?.value ?? 0, files: totals[l]?.files?.value ?? 0 }));
  const codeLines = lines.reduce((a, l) => a + l.lines, 0);
  const codeFiles = lines.reduce((a, l) => a + l.files, 0);
  cards.push({ label: t.cards.files, value: fmtNum(r.inventory?.totalFiles ?? codeFiles, r.locale) });
  cards.push({ label: t.cards.codeLines, value: fmtNum(codeLines, r.locale) });
  if (r.inventory) cards.push({ label: t.cards.size, value: formatBytes(r.inventory.totalBytes, r.locale) });
  if (st) {
    const tech = st.items.filter((i) => i.category !== 'language');
    cards.push({ label: t.cards.technologies, value: String(tech.length) });
    const deps = st.packages.reduce((a, p) => a + Object.keys(p.dependencies).length + Object.keys(p.devDependencies).length, 0);
    if (st.packages.length) cards.push({ label: t.cards.dependencies, value: String(deps) });
    cards.push({ label: t.cards.pwa, value: t.pwaStatus[st.pwa.status], tone: st.pwa.status === 'yes' ? 'good' : st.pwa.status === 'partial' ? 'warn' : 'neutral' });
  }
  if (r.pages) cards.push({ label: t.cards.pages, value: String(r.pages.filter((p) => p.document).length) });
  if (r.insights) {
    const w = r.insights.filter((i) => i.level === 'warn').length;
    const i = r.insights.filter((x) => x.level === 'info').length;
    cards.push({ label: t.cards.observations, value: String(w + i), hint: t.obsCount(w, i), tone: w > 0 ? 'warn' : 'good' });
  }
  blocks.push({ t: 'cards', items: cards });
  if (codeLines > 0) {
    blocks.push({ t: 'h3', text: t.linesBy });
    blocks.push({
      t: 'bar',
      items: lines
        .filter((l) => l.lines > 0)
        .map((l) => ({
          key: l.lang,
          label: l.lang === 'js' && st?.items.some((i) => i.name === 'TypeScript' || i.name === 'TSX') ? 'JavaScript / TypeScript' : t.sections[l.lang],
          value: l.lines,
        })),
    });
  }
  return { id: 'summary', title: t.parts.summary, blocks };
}

function insightsSection(r: ReportData): Section {
  const t = STRINGS[r.locale];
  const items = (r.insights ?? []).map((i) => ({ level: i.level, label: t.levels[i.level], text: t.insight(i) }));
  return { id: 'insights', title: t.parts.insights, blocks: items.length ? [{ t: 'notes', items }] : [{ t: 'p', text: t.noInsights, muted: true }] };
}

function stackSection(r: ReportData, st: StackInfo): Section {
  const t = STRINGS[r.locale];
  const blocks: Block[] = [];
  const nonLang = st.items.filter((i) => i.category !== 'language');
  if (nonLang.length === 0) blocks.push({ t: 'p', text: t.noStack, muted: true });
  const rows: Cell[][] = [];
  for (const c of CATEGORIES) {
    const items = st.items.filter((i) => i.category === c);
    items.forEach((i, k) => {
      rows.push([
        k === 0 ? t.categories[c] : '',
        { text: i.name + (i.devOnly ? ` (${t.devOnly})` : '') },
        i.version ? { text: i.version, code: true } : '',
        { text: i.evidence.map((e) => t.evidence(e)).join('; '), muted: true },
      ]);
    });
  }
  if (rows.length) blocks.push({ t: 'table', head: [t.category, t.technology, t.version, t.detectedIn], rows, rowHeader: true });

  for (const pkg of st.packages.slice(0, 6)) {
    blocks.push({ t: 'h3', text: t.packageTitle(pkg.path) });
    const kv: [string, Cell][] = [];
    if (pkg.name) kv.push([t.pkg.name, { text: pkg.name, code: true }]);
    if (pkg.version) kv.push([t.pkg.version, pkg.version]);
    if (pkg.description) kv.push([t.pkg.description, pkg.description]);
    kv.push([t.pkg.type, pkg.type === 'module' ? t.pkg.module : t.pkg.commonjs]);
    if (pkg.engines?.node) kv.push([t.pkg.node, { text: pkg.engines.node, code: true }]);
    else if (pkg === st.packages[0] && st.nodeVersion) kv.push([t.pkg.node, { text: st.nodeVersion, code: true }]);
    if (pkg.packageManager) kv.push([t.pkg.manager, { text: pkg.packageManager, code: true }]);
    if (pkg.license) kv.push([t.pkg.license, pkg.license]);
    if (pkg.private) kv.push([t.pkg.private, t.yes]);
    if (pkg.workspaces) kv.push([t.pkg.workspaces, t.yes]);
    if (pkg.browserslist) kv.push([t.pkg.browserslist, t.yes]);
    if (pkg === st.packages[0] && st.typescriptStrict !== undefined)
      kv.push([t.pkg.typescript, ok(st.typescriptStrict, st.typescriptStrict ? t.pkg.strict : t.pkg.notStrict)]);
    blocks.push({ t: 'kv', items: kv });
    const scripts = Object.entries(pkg.scripts);
    if (scripts.length) {
      blocks.push({
        t: 'table',
        head: [t.script, t.command],
        rows: scripts.map(([k, v]) => [{ text: k + (t.scriptHint[k] ? ` · ${t.scriptHint[k]}` : ''), code: false }, { text: v, code: true }]),
        rowHeader: true,
        collapsed: `${t.scripts} (${scripts.length})`,
      });
    }
    for (const [deps, title] of [
      [pkg.dependencies, t.dependencies],
      [pkg.devDependencies, t.devDependencies],
    ] as const) {
      const list = Object.entries(deps).sort((a, b) => a[0].localeCompare(b[0]));
      if (list.length)
        blocks.push({
          t: 'table',
          head: [t.dependency, t.range],
          rows: list.map(([k, v]) => [{ text: k, code: true }, { text: v, code: true, muted: true }]),
          rowHeader: true,
          collapsed: title(list.length),
        });
    }
  }
  const pf = st.projectFiles;
  blocks.push({ t: 'h3', text: t.projectFiles });
  blocks.push({
    t: 'kv',
    items: (Object.keys(t.projectFileNames) as (keyof typeof t.projectFileNames)[]).map((k) => [t.projectFileNames[k], ok(pf[k])]),
  });
  return { id: 'stack', title: t.parts.stack, blocks };
}

function pwaSection(r: ReportData, st: StackInfo): Section {
  const t = STRINGS[r.locale];
  const pwa = st.pwa;
  const blocks: Block[] = [{ t: 'p', strong: t.pwaStatus[pwa.status] + '.', text: ' ' + t.pwaIntro[pwa.status] }];
  if (pwa.generator) blocks.push({ t: 'p', text: t.pwaGenerated(pwa.generator), muted: true });
  if (pwa.status !== 'no') {
    blocks.push({
      t: 'table',
      head: [t.pwaCheck, t.pwaState, ''],
      rows: pwa.checks.map((c) => [t.pwaChecks[c.id], ok(c.ok), { text: c.required ? t.required : t.recommended, muted: true }]),
      rowHeader: true,
    });
  }
  const m = pwa.manifest;
  if (m) {
    const f = t.manifestFields;
    const kv: [string, Cell][] = [[t.manifestFile, { text: m.path, code: true }]];
    if (m.parseError) kv.push([t.manifestFile, ok(false, 'JSON ✗')]);
    for (const [label, val] of [
      [f.name, m.name],
      [f.shortName, m.shortName],
      [f.startUrl, m.startUrl],
      [f.display, m.display],
      [f.themeColor, m.themeColor],
      [f.backgroundColor, m.backgroundColor],
      [f.lang, m.lang],
    ] as const) {
      if (val) kv.push([label, { text: val, code: true }]);
    }
    if (m.icons.count) kv.push([f.icons, `${m.icons.count} (${m.icons.sizes.join(', ')}${m.icons.purposes.includes('maskable') ? '; maskable' : ''})`]);
    blocks.push({ t: 'kv', items: kv });
  }
  if (pwa.serviceWorker.length) blocks.push({ t: 'kv', items: [['Service worker', { text: pwa.serviceWorker.slice(0, 5).join(', '), code: true }]] });
  return { id: 'pwa', title: t.parts.pwa, blocks };
}

function pagesSection(r: ReportData, pages: PageInfo[]): Section {
  const t = STRINGS[r.locale];
  const docs = pages.filter((p) => p.document);
  const blocks: Block[] = [{ t: 'p', text: t.pagesIntro, muted: true }];
  if (docs.length === 0) blocks.push({ t: 'p', text: t.noPages });
  else {
    const c = t.pageCols;
    const cut = (s: string) => (s.length > 40 ? s.slice(0, 39) + '…' : s);
    blocks.push({
      t: 'table',
      head: [c.page, c.lang, c.viewport, c.title, c.description, c.favicon, c.og, c.h1, c.main],
      rows: docs.slice(0, MAX_ROWS).map((p) => [
        { text: p.path, code: true },
        p.lang ? ok(true, p.lang) : ok(false),
        ok(p.viewport),
        p.title ? ok(true, cut(p.title)) : ok(false),
        ok(p.description),
        ok(p.favicon),
        p.openGraph ? ok(true, String(p.openGraph)) : ok(false),
        { text: String(p.h1), ok: p.h1 === 1 },
        ok(p.main),
      ]),
      rowHeader: true,
    });
    if (docs.length > MAX_ROWS) blocks.push({ t: 'p', text: t.more(docs.length - MAX_ROWS), muted: true });
  }
  const frags = pages.length - docs.length;
  if (frags > 0) blocks.push({ t: 'p', text: t.fragments(frags), muted: true });
  return { id: 'pages', title: t.parts.pages, blocks };
}

function assetsSection(r: ReportData, inv: Inventory): Section {
  const t = STRINGS[r.locale];
  const blocks: Block[] = [];
  const rows: Cell[][] = inv.byCategory.map((c) => [
    t.fileCategories[c.category],
    c.files,
    formatBytes(c.bytes, r.locale),
    { text: sortedDetails(c.ext).slice(0, 8).map(([e, n]) => `${e} ${n}`).join(', '), muted: true },
  ]);
  rows.push([{ text: t.total }, inv.totalFiles, formatBytes(inv.totalBytes, r.locale), '']);
  blocks.push({ t: 'table', head: [t.category, t.files, t.size, t.extensions], rows, numeric: [1, 2], rowHeader: true });
  if (inv.largest.length) {
    blocks.push({ t: 'h3', text: t.largest });
    blocks.push({
      t: 'table',
      head: [t.file, t.size],
      rows: inv.largest.map((f) => [{ text: f.path, code: true }, formatBytes(f.size, r.locale)]),
      numeric: [1],
      rowHeader: true,
    });
  }
  if (inv.truncated) blocks.push({ t: 'p', text: t.truncated, muted: true });
  return { id: 'assets', title: t.parts.assets, blocks };
}

function codeSection(r: ReportData, s: SectionData): Section {
  const t = STRINGS[r.locale];
  const labels = t.metrics[s.lang];
  const blocks: Block[] = [];
  if ((s.total.files?.value ?? 0) === 0) return { id: s.lang, title: codeTitle(s, r.locale), blocks: [{ t: 'p', text: t.noFiles }] };
  const ext = extLine(s, r.locale);
  if (ext) blocks.push({ t: 'p', text: ext, muted: true });
  blocks.push({
    t: 'table',
    head: [t.metric, t.value, t.breakdown],
    rows: s.metrics.map((id) => [labels[id], s.total[id]?.value ?? 0, { text: detailsText(s.total[id]?.details, r.locale), muted: true }]),
    numeric: [1],
    rowHeader: true,
    fixed: true,
  });
  const cols = s.metrics.filter((id) => id !== 'files');
  if (r.perFile && s.files.length > 0 && cols.length > 0) {
    blocks.push({
      t: 'table',
      head: [t.file, ...cols.map((id) => labels[id])],
      rows: s.files.map((f) => [{ text: f.path, code: true }, ...cols.map((id) => f.metrics[id]?.value ?? 0)]),
      numeric: cols.map((_, i) => i + 1),
      rowHeader: true,
      collapsed: `${t.perFile} (${s.files.length})`,
    });
  }
  return { id: s.lang, title: codeTitle(s, r.locale), blocks };
}

export function buildSections(r: ReportData): Section[] {
  const parts = new Set(r.parts ?? []);
  const out: Section[] = [];
  if (parts.has('summary')) out.push(summarySection(r));
  if (parts.has('insights') && r.insights) out.push(insightsSection(r));
  if (parts.has('stack') && r.stack) out.push(stackSection(r, r.stack));
  if (parts.has('pwa') && r.stack) out.push(pwaSection(r, r.stack));
  if (parts.has('pages') && r.pages && r.pages.length > 0) out.push(pagesSection(r, r.pages));
  for (const s of r.sections) out.push(codeSection(r, s));
  if (parts.has('assets') && r.inventory && r.inventory.totalFiles > 0) out.push(assetsSection(r, r.inventory));
  return out;
}

/* ----------------------------- Markdown ----------------------------- */

const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/\r?\n/g, ' ');

function mdValue(c: Cell): string {
  if (typeof c === 'number') return String(c);
  if (typeof c === 'string') return mdCell(c);
  if (c.text === '') return '';
  if (c.code) return '`' + c.text.replace(/`/g, "'").replace(/\|/g, '\\|').replace(/\r?\n/g, ' ') + '`';
  return mdCell(c.text);
}

const NOTE_ICON = { warn: '⚠️', info: '💡', good: '✅' } as const;

export function renderMarkdown(r: ReportData): string {
  const t = STRINGS[r.locale];
  const out: string[] = [];
  out.push(`# ${t.title}`, '');
  out.push(`- **${t.project}:** ${mdCell(r.project)}`);
  out.push(`- **${t.author}:** ${mdCell(r.author || t.noAuthor)}`);
  out.push(`- **${t.date}:** ${formatDate(r.date, r.locale)}`, '');
  for (const s of buildSections(r)) {
    out.push(`## ${s.title}`, '');
    for (const b of s.blocks) {
      switch (b.t) {
        case 'h3':
          out.push(`### ${mdCell(b.text)}`, '');
          break;
        case 'p': {
          const text = (b.strong ? `**${mdCell(b.strong)}**` : '') + mdCell(b.text);
          out.push(b.muted ? `_${text.trim()}_` : text.trim(), '');
          break;
        }
        case 'kv':
          for (const [k, v] of b.items) out.push(`- **${mdCell(k)}:** ${mdValue(v)}`);
          out.push('');
          break;
        case 'cards':
          for (const c of b.items) out.push(`- **${mdCell(c.label)}:** ${mdCell(c.value)}${c.hint ? ` (${mdCell(c.hint)})` : ''}`);
          out.push('');
          break;
        case 'bar': {
          const total = b.items.reduce((a, i) => a + i.value, 0) || 1;
          for (const i of b.items) out.push(`- ${i.label}: ${fmtNum(i.value, r.locale)} (${Math.round((i.value / total) * 100)} %)`);
          out.push('');
          break;
        }
        case 'notes':
          for (const n of b.items) out.push(`- ${NOTE_ICON[n.level]} **${mdCell(n.label)}:** ${mdCell(n.text)}`);
          out.push('');
          break;
        case 'table': {
          if (b.collapsed) out.push(`**${mdCell(b.collapsed)}**`, '');
          const num = new Set(b.numeric ?? []);
          out.push(`| ${b.head.map(mdCell).join(' | ')} |`);
          out.push(`|${b.head.map((_, i) => (num.has(i) ? '---:' : '---')).join('|')}|`);
          for (const row of b.rows) out.push(`| ${row.map(mdValue).join(' | ')} |`);
          out.push('');
          break;
        }
      }
    }
  }
  out.push(`_${t.approx}_`, '');
  return out.join('\n');
}

/* ------------------------------- HTML -------------------------------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlValue(c: Cell): string {
  if (typeof c === 'number') return String(c);
  if (typeof c === 'string') return esc(c);
  let s = c.code ? `<code>${esc(c.text)}</code>` : esc(c.text);
  if (c.ok !== undefined) s = `<span class="${c.ok ? 'ok' : 'ko'}">${s}</span>`;
  if (c.muted) s = `<span class="d">${s}</span>`;
  return s;
}

function htmlBlock(b: Block, locale: ReportLocale): string {
  switch (b.t) {
    case 'h3':
      return `<h3>${esc(b.text)}</h3>`;
    case 'p':
      return `<p${b.muted ? ' class="d"' : ''}>${b.strong ? `<strong>${esc(b.strong)}</strong>` : ''}${esc(b.text)}</p>`;
    case 'kv':
      return `<dl class="kv">${b.items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${htmlValue(v)}</dd>`).join('')}</dl>`;
    case 'cards':
      return `<div class="cards">${b.items
        .map(
          (c) =>
            `<div class="card${c.tone ? ' ' + c.tone : ''}${/^[\d.,\s]+(?:[KMG]?B)?$/.test(c.value) ? '' : ' txt'}"><div class="cv">${esc(c.value)}</div><div class="cl">${esc(c.label)}</div>${c.hint ? `<div class="ch">${esc(c.hint)}</div>` : ''}</div>`,
        )
        .join('')}</div>`;
    case 'bar': {
      const total = b.items.reduce((a, i) => a + i.value, 0) || 1;
      const pct = (v: number) => Math.round((v / total) * 1000) / 10;
      // SVG y no style="width:…": la CSP del panel no permite estilos en línea.
      let x = 0;
      const rects = b.items
        .map((i) => {
          const w = pct(i.value);
          const r = `<rect class="${esc(i.key)}" x="${x}" y="0" width="${w}" height="10"/>`;
          x += w;
          return r;
        })
        .join('');
      return `<svg class="bar" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${esc(b.items.map((i) => `${i.label} ${pct(i.value)} %`).join(', '))}">${rects}</svg><ul class="legend">${b.items
        .map((i) => `<li><span class="sw ${esc(i.key)}"></span>${esc(i.label)} <b>${fmtNum(i.value, locale)}</b> <span class="d">${pct(i.value)} %</span></li>`)
        .join('')}</ul>`;
    }
    case 'notes':
      return `<ul class="notes">${b.items
        .map((n) => `<li class="${n.level}"><span class="tag">${esc(n.label)}</span> ${esc(n.text)}</li>`)
        .join('')}</ul>`;
    case 'table': {
      const num = new Set(b.numeric ?? []);
      const head = `<thead><tr>${b.head.map((h, i) => `<th scope="col"${num.has(i) ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>`;
      const rows = b.rows
        .map(
          (row) =>
            `<tr>${row
              .map((c, i) =>
                i === 0 && b.rowHeader
                  ? `<th scope="row">${htmlValue(c)}</th>`
                  : `<td${num.has(i) ? ' class="n"' : ''}>${htmlValue(c)}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('');
      const table = `<div class="scroll"><table${b.fixed ? ' class="fixed"' : ''}>${head}<tbody>${rows}</tbody></table></div>`;
      return b.collapsed ? `<details><summary>${esc(b.collapsed)}</summary>${table}</details>` : table;
    }
  }
}

export interface WebviewExtras {
  cspSource: string;
  nonce: string;
  buttons: { id: string; label: string }[];
}

/**
 * HTML del informe. Sin `extras` es un documento autónomo (para guardar);
 * con `extras` lleva la barra de botones y la CSP del panel de VS Code.
 */
export function renderHtml(r: ReportData, extras?: WebviewExtras): string {
  const t = STRINGS[r.locale];
  const sections = buildSections(r);
  const body: string[] = [];
  body.push(`<header><h1>${esc(t.title)}</h1><dl class="kv">`);
  body.push(`<dt>${esc(t.project)}</dt><dd>${esc(r.project)}</dd>`);
  body.push(`<dt>${esc(t.author)}</dt><dd>${esc(r.author || t.noAuthor)}</dd>`);
  body.push(`<dt>${esc(t.date)}</dt><dd>${esc(formatDate(r.date, r.locale))}</dd></dl></header>`);
  if (extras) {
    body.push(
      `<nav class="toolbar">${extras.buttons
        .map((b) => `<button type="button" data-action="${esc(b.id)}">${esc(b.label)}</button>`)
        .join('')}</nav>`,
    );
  }
  if (sections.length > 2) {
    body.push(`<nav class="toc" aria-label="${esc(t.contents)}">${sections.map((s) => `<a href="#${esc(s.id)}">${esc(s.title)}</a>`).join('')}</nav>`);
  }
  for (const s of sections) {
    body.push(`<section id="${esc(s.id)}"><h2>${esc(s.title)}</h2>`);
    for (const b of s.blocks) body.push(htmlBlock(b, r.locale));
    body.push('</section>');
  }
  body.push(`<p class="note">${esc(t.approx)}</p>`);

  const csp = extras
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${extras.cspSource} 'nonce-${extras.nonce}'; script-src 'nonce-${extras.nonce}';">`
    : '';
  const nonceAttr = extras ? ` nonce="${extras.nonce}"` : '';
  const script = extras
    ? `<script nonce="${extras.nonce}">
const vscode = acquireVsCodeApi();
document.querySelector('.toolbar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) vscode.postMessage({ type: b.dataset.action });
});
document.querySelectorAll('.toc a').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({ behavior: 'smooth' });
}));
</script>`
    : '';
  return `<!doctype html>
<html lang="${r.locale}">
<head>
<meta charset="utf-8">
${csp}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)} · ${esc(r.project)}</title>
<style${nonceAttr}>${CSS}</style>
</head>
<body>
${body.join('\n')}
${script}
</body>
</html>`;
}

/* Colores del tema de VS Code dentro del panel; fuera de VS Code, los de respaldo. */
const CSS = `
:root { color-scheme: light dark; --fg: var(--vscode-foreground, #1d1d1f); --bg: var(--vscode-editor-background, #ffffff);
  --muted: var(--vscode-descriptionForeground, #5c5c66); --line: var(--vscode-panel-border, #d6d6dc);
  --accent: var(--vscode-textLink-foreground, #0b5cad); --head: var(--vscode-editorWidget-background, #f3f3f6);
  --good: var(--vscode-testing-iconPassed, #1a7f37); --warn: var(--vscode-editorWarning-foreground, #9a6700); --bad: var(--vscode-errorForeground, #c62828);
  --c-html: #e34c26; --c-css: #2965f1; --c-js: #c9a400; }
@media (prefers-color-scheme: dark) { :root:not(.vscode-light) { --fg: var(--vscode-foreground, #ececf1); --bg: var(--vscode-editor-background, #1e1e22);
  --muted: var(--vscode-descriptionForeground, #a6a6b0); --line: var(--vscode-panel-border, #3a3a42);
  --accent: var(--vscode-textLink-foreground, #6cb2ff); --head: var(--vscode-editorWidget-background, #26262c);
  --good: var(--vscode-testing-iconPassed, #4ac26b); --warn: var(--vscode-editorWarning-foreground, #d4a72c); --bad: var(--vscode-errorForeground, #ff7b72);
  --c-js: #f0db4f; } }
body { font: 14px/1.5 var(--vscode-font-family, system-ui, sans-serif); color: var(--fg); background: var(--bg); margin: 0 auto; padding: 16px; max-width: 1000px; }
h1 { font-size: 1.5rem; margin: 0 0 .5rem; } h2 { font-size: 1.2rem; margin: 2.25rem 0 .6rem; color: var(--accent); padding-bottom: .25rem; border-bottom: 1px solid var(--line); }
h3 { font-size: 1rem; margin: 1.25rem 0 .4rem; }
section { scroll-margin-top: 1rem; }
dl.kv { display: grid; grid-template-columns: max-content 1fr; gap: .15rem 1rem; margin: .25rem 0 .75rem; } dt { color: var(--muted); } dd { margin: 0; }
.toolbar { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
.toolbar button { font: inherit; padding: .35rem .8rem; border: 0; border-radius: 2px; cursor: pointer;
  color: var(--vscode-button-foreground, #fff); background: var(--vscode-button-background, #0b5cad); }
.toolbar button:hover { background: var(--vscode-button-hoverBackground, #094a8b); }
.toolbar button:focus-visible, .toc a:focus-visible, summary:focus-visible { outline: 2px solid var(--vscode-focusBorder, #0b5cad); outline-offset: 2px; }
.toc { display: flex; flex-wrap: wrap; gap: .25rem .9rem; margin: 1rem 0; padding: .5rem .75rem; background: var(--head); border-radius: 4px; }
.toc a { color: var(--accent); text-decoration: none; } .toc a:hover { text-decoration: underline; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .6rem; margin: .75rem 0; }
.card { border: 1px solid var(--line); border-radius: 6px; padding: .6rem .75rem; background: var(--head); }
.card .cv { font-size: 1.35rem; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; } .card .cl { color: var(--muted); font-size: .85em; } .card .ch { color: var(--muted); font-size: .8em; }
.card.txt .cv { font-size: 1.05rem; padding-top: .2rem; } .card.good .cv { color: var(--good); } .card.warn .cv { color: var(--warn); } .card.bad .cv { color: var(--bad); }
.bar { display: block; width: 100%; height: 12px; border-radius: 6px; background: var(--line); margin: .5rem 0; }
.bar rect { fill: var(--muted); } .bar rect.html { fill: var(--c-html); } .bar rect.css { fill: var(--c-css); } .bar rect.js { fill: var(--c-js); }
.sw { background: var(--muted); } .sw.html { background: var(--c-html); } .sw.css { background: var(--c-css); } .sw.js { background: var(--c-js); }
.legend { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: .25rem 1.25rem; }
.sw { display: inline-block; width: .7em; height: .7em; border-radius: 2px; margin-right: .35em; vertical-align: baseline; }
.notes { list-style: none; padding: 0; margin: .5rem 0; display: grid; gap: .4rem; }
.notes li { padding: .45rem .7rem; border-left: 4px solid var(--muted); background: var(--head); border-radius: 0 4px 4px 0; }
.notes li.warn { border-color: var(--warn); } .notes li.good { border-color: var(--good); } .notes li.info { border-color: var(--accent); }
.notes .tag { font-weight: 600; font-size: .8em; text-transform: uppercase; letter-spacing: .03em; margin-right: .25rem; }
.notes li.warn .tag { color: var(--warn); } .notes li.good .tag { color: var(--good); } .notes li.info .tag { color: var(--accent); }
table { border-collapse: collapse; width: 100%; } table.fixed { table-layout: fixed; } table.fixed th:first-child { width: 38%; } table.fixed .n { width: 4.5rem; }
th, td { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { background: var(--head); font-weight: 600; } tbody th { font-weight: 500; }
.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; } .d { color: var(--muted); font-size: .9em; }
.ok { color: var(--good); } .ko { color: var(--bad); }
details { margin-top: .75rem; } summary { cursor: pointer; color: var(--accent); margin-bottom: .25rem; } .scroll { overflow-x: auto; }
code { font-family: var(--vscode-editor-font-family, ui-monospace, monospace); font-size: .9em; overflow-wrap: anywhere; }
.note { color: var(--muted); font-size: .85em; margin-top: 2rem; }
@media print { .toolbar, .toc { display: none; } details > * { display: block; } body { max-width: none; } }
`;
