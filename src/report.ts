import { FileMetrics, Language, METRICS } from './metrics';
import { ReportLocale, STRINGS } from './i18n';

export interface SectionData {
  lang: Language;
  /** Métricas elegidas, en el orden del catálogo. */
  metrics: string[];
  total: FileMetrics;
  files: { path: string; metrics: FileMetrics }[];
}

export interface ReportData {
  project: string;
  author: string;
  date: Date;
  locale: ReportLocale;
  perFile: boolean;
  sections: SectionData[];
}

const MAX_DETAILS = 15;

/** Ordena las métricas elegidas como en el catálogo y quita las que no existen. */
export function orderMetrics(lang: Language, chosen: readonly string[]): string[] {
  const set = new Set(chosen);
  return METRICS[lang].map((m) => m.id).filter((id) => set.has(id));
}

function formatDate(d: Date, locale: ReportLocale): string {
  return d.toLocaleString(locale === 'es' ? 'es-ES' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' });
}

function sortedDetails(details: Record<string, number>): [string, number][] {
  return Object.entries(details).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function detailsText(details: Record<string, number> | undefined, locale: ReportLocale): string {
  if (!details) return '';
  const entries = sortedDetails(details);
  if (entries.length === 0) return '';
  const keys = STRINGS[locale].detailKeys;
  const shown = entries.slice(0, MAX_DETAILS).map(([k, v]) => `${keys[k] ?? k}: ${v}`);
  if (entries.length > MAX_DETAILS) shown.push(STRINGS[locale].more(entries.length - MAX_DETAILS));
  return shown.join(', ');
}

const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/</g, '&lt;');

export function renderMarkdown(r: ReportData): string {
  const t = STRINGS[r.locale];
  const out: string[] = [];
  out.push(`# ${t.title}`, '');
  out.push(`- **${t.project}:** ${mdCell(r.project)}`);
  out.push(`- **${t.author}:** ${mdCell(r.author || t.noAuthor)}`);
  out.push(`- **${t.date}:** ${formatDate(r.date, r.locale)}`, '');
  for (const s of r.sections) {
    const labels = t.metrics[s.lang];
    out.push(`## ${t.sections[s.lang]}`, '');
    if ((s.total.files?.value ?? 0) === 0) {
      out.push(t.noFiles, '');
      continue;
    }
    out.push(`| ${t.metric} | ${t.value} | ${t.breakdown} |`, '|---|---:|---|');
    for (const id of s.metrics) {
      const m = s.total[id];
      out.push(`| ${mdCell(labels[id])} | ${m?.value ?? 0} | ${mdCell(detailsText(m?.details, r.locale))} |`);
    }
    out.push('');
    const cols = s.metrics.filter((id) => id !== 'files');
    if (r.perFile && s.files.length > 0 && cols.length > 0) {
      out.push(`### ${t.perFile}`, '');
      out.push(`| ${t.file} | ${cols.map((id) => mdCell(labels[id])).join(' | ')} |`);
      out.push(`|---|${cols.map(() => '---:').join('|')}|`);
      for (const f of s.files) {
        out.push(`| ${mdCell(f.path)} | ${cols.map((id) => f.metrics[id]?.value ?? 0).join(' | ')} |`);
      }
      out.push('');
    }
  }
  out.push(`_${t.approx}_`, '');
  return out.join('\n');
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  const body: string[] = [];
  body.push(`<header><h1>${esc(t.title)}</h1><dl>`);
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
  for (const s of r.sections) {
    const labels = t.metrics[s.lang];
    body.push(`<section><h2>${esc(t.sections[s.lang])}</h2>`);
    if ((s.total.files?.value ?? 0) === 0) {
      body.push(`<p>${esc(t.noFiles)}</p></section>`);
      continue;
    }
    body.push(`<table><thead><tr><th scope="col">${esc(t.metric)}</th><th scope="col" class="n">${esc(t.value)}</th><th scope="col">${esc(t.breakdown)}</th></tr></thead><tbody>`);
    for (const id of s.metrics) {
      const m = s.total[id];
      body.push(
        `<tr><th scope="row">${esc(labels[id])}</th><td class="n">${m?.value ?? 0}</td><td class="d">${esc(detailsText(m?.details, r.locale))}</td></tr>`,
      );
    }
    body.push('</tbody></table>');
    const cols = s.metrics.filter((id) => id !== 'files');
    if (r.perFile && s.files.length > 0 && cols.length > 0) {
      body.push(`<details><summary>${esc(t.perFile)} (${s.files.length})</summary><div class="scroll"><table><thead><tr><th scope="col">${esc(t.file)}</th>`);
      body.push(cols.map((id) => `<th scope="col" class="n">${esc(labels[id])}</th>`).join(''));
      body.push('</tr></thead><tbody>');
      for (const f of s.files) {
        body.push(
          `<tr><th scope="row"><code>${esc(f.path)}</code></th>${cols
            .map((id) => `<td class="n">${f.metrics[id]?.value ?? 0}</td>`)
            .join('')}</tr>`,
        );
      }
      body.push('</tbody></table></div></details>');
    }
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
  --accent: var(--vscode-textLink-foreground, #0b5cad); --head: var(--vscode-editorWidget-background, #f3f3f6); }
@media (prefers-color-scheme: dark) { :root:not(.vscode-light) { --fg: var(--vscode-foreground, #ececf1); --bg: var(--vscode-editor-background, #1e1e22);
  --muted: var(--vscode-descriptionForeground, #a6a6b0); --line: var(--vscode-panel-border, #3a3a42);
  --accent: var(--vscode-textLink-foreground, #6cb2ff); --head: var(--vscode-editorWidget-background, #26262c); } }
body { font: 14px/1.5 var(--vscode-font-family, system-ui, sans-serif); color: var(--fg); background: var(--bg); margin: 0 auto; padding: 16px; max-width: 960px; }
h1 { font-size: 1.5rem; margin: 0 0 .5rem; } h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; color: var(--accent); }
dl { display: grid; grid-template-columns: max-content 1fr; gap: .15rem 1rem; margin: 0; } dt { color: var(--muted); } dd { margin: 0; }
.toolbar { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
.toolbar button { font: inherit; padding: .35rem .8rem; border: 0; border-radius: 2px; cursor: pointer;
  color: var(--vscode-button-foreground, #fff); background: var(--vscode-button-background, #0b5cad); }
.toolbar button:hover { background: var(--vscode-button-hoverBackground, #094a8b); }
.toolbar button:focus-visible { outline: 2px solid var(--vscode-focusBorder, #0b5cad); outline-offset: 2px; }
table { border-collapse: collapse; width: 100%; } section > table { table-layout: fixed; } section > table th:first-child { width: 38%; } section > table .n { width: 4.5rem; } th, td { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { background: var(--head); font-weight: 600; } tbody th { font-weight: 500; }
.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; } .d { color: var(--muted); font-size: .9em; }
details { margin-top: .75rem; } summary { cursor: pointer; color: var(--accent); } .scroll { overflow-x: auto; }
code { font-family: var(--vscode-editor-font-family, ui-monospace, monospace); font-size: .9em; }
.note { color: var(--muted); font-size: .85em; margin-top: 2rem; }
`;
