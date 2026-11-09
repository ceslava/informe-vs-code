import * as vscode from 'vscode';
import { REPORT_PARTS, ReportPart, resolveLocale, STRINGS } from './i18n';
import { DEFAULT_HTML_TAGS, defaultMetrics, Language, LANGUAGES, METRICS } from './metrics';
import { orderMetrics, orderParts, renderHtml, renderMarkdown, ReportData } from './report';
import { scanProject } from './scan';

const SECTION = 'webReport';
const MAX_TEXT = 2 * 1024 * 1024;

let panel: vscode.WebviewPanel | undefined;
let lastReport: ReportData | undefined;
let lastFolder: vscode.Uri | undefined;

/** Lo que devuelve activate(): solo lo usan las pruebas de integración. */
export interface WebReportApi {
  lastReport(): ReportData | undefined;
  lastMarkdown(): string | undefined;
}

export function activate(context: vscode.ExtensionContext): WebReportApi {
  context.subscriptions.push(
    vscode.commands.registerCommand('webReport.generate', (uri?: vscode.Uri) => generate(context, uri)),
    vscode.commands.registerCommand('webReport.chooseMetrics', () => chooseMetrics(context)),
    vscode.commands.registerCommand('webReport.setAuthor', setAuthor),
  );
  return {
    lastReport: () => lastReport,
    lastMarkdown: () => (lastReport ? renderMarkdown(lastReport) : undefined),
  };
}

export function deactivate(): void {
  panel?.dispose();
}

function config() {
  return vscode.workspace.getConfiguration(SECTION);
}

/** Dónde guardar un ajuste: en el espacio de trabajo si hay uno abierto. */
function target(): vscode.ConfigurationTarget {
  return vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}

async function pickFolder(uri?: vscode.Uri): Promise<vscode.Uri | undefined> {
  if (uri) return uri;
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: vscode.l10n.t('Analyze this folder'),
    });
    return picked?.[0];
  }
  if (folders.length === 1) return folders[0].uri;
  const f = await vscode.window.showWorkspaceFolderPick({ placeHolder: vscode.l10n.t('Which folder do you want to analyze?') });
  return f?.uri;
}

async function setAuthor(): Promise<string | undefined> {
  const current = config().get<string>('author', '');
  const author = await vscode.window.showInputBox({
    title: vscode.l10n.t('Report author'),
    prompt: vscode.l10n.t('Name that appears in the report header'),
    value: current,
    placeHolder: vscode.l10n.t('e.g. Jane Doe'),
  });
  if (author === undefined) return undefined;
  await config().update('author', author.trim(), vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(
    author.trim() ? vscode.l10n.t('Author saved: {0}', author.trim()) : vscode.l10n.t('Author removed'),
  );
  if (lastReport && panel) {
    lastReport.author = author.trim();
    showReport(lastReport);
  }
  return author.trim();
}

async function chooseMetrics(context: vscode.ExtensionContext): Promise<void> {
  const cfg = config();
  const locale = resolveLocale(cfg.get('language', 'auto'), vscode.env.language);
  const t = STRINGS[locale];
  type Item = vscode.QuickPickItem & { lang?: Language; id?: string; part?: ReportPart };
  const items: Item[] = [];
  const parts = new Set(cfg.get<string[]>('sections', [...REPORT_PARTS]));
  items.push({ label: vscode.l10n.t('Report sections'), kind: vscode.QuickPickItemKind.Separator });
  for (const p of REPORT_PARTS) {
    items.push({ label: t.parts[p], description: t.partHints[p], picked: parts.has(p), part: p });
  }
  for (const lang of LANGUAGES) {
    const chosen = new Set(cfg.get<string[]>(`${lang}.metrics`, defaultMetrics(lang)));
    items.push({ label: t.sections[lang], kind: vscode.QuickPickItemKind.Separator });
    for (const m of METRICS[lang]) {
      items.push({ label: t.metrics[lang][m.id], description: `${lang}.${m.id}`, picked: chosen.has(m.id), lang, id: m.id });
    }
  }
  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: vscode.l10n.t('Choose what the report counts'),
    placeHolder: vscode.l10n.t('Leave a language empty to skip it'),
    matchOnDescription: true,
  });
  if (!picked) return;
  await cfg.update('sections', orderParts(picked.filter((p) => p.part).map((p) => p.part!)), target());
  for (const lang of LANGUAGES) {
    const ids = picked.filter((p) => p.lang === lang && p.id).map((p) => p.id!);
    await cfg.update(`${lang}.metrics`, ids, target());
  }
  if (picked.some((p) => p.lang === 'html' && p.id === 'tags')) {
    const tags = await vscode.window.showInputBox({
      title: vscode.l10n.t('HTML tags to count one by one'),
      prompt: vscode.l10n.t('Comma-separated, e.g. input, img, a, button'),
      value: cfg.get<string[]>('html.tags', DEFAULT_HTML_TAGS).join(', '),
    });
    if (tags !== undefined) {
      const list = tags.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      await cfg.update('html.tags', list, target());
    }
  }
  await generate(context);
}

async function generate(context: vscode.ExtensionContext, uri?: vscode.Uri): Promise<void> {
  const folder = await pickFolder(uri);
  if (!folder) return;
  lastFolder = folder;
  const cfg = config();
  const locale = resolveLocale(cfg.get('language', 'auto'), vscode.env.language);
  const exclude = cfg.get<string>('exclude', '**/{node_modules,dist,out,build,.git,.vscode-test}/**');
  const skipMin = cfg.get<boolean>('ignoreMinified', true);
  const maxFiles = cfg.get<number>('maxFiles', 2000);
  const tags = cfg.get<string[]>('html.tags', DEFAULT_HTML_TAGS);

  const parts = orderParts(cfg.get<string[]>('sections', [...REPORT_PARTS]));
  const chosen = Object.fromEntries(
    LANGUAGES.map((l) => [l, orderMetrics(l, cfg.get<string[]>(`${l}.metrics`, defaultMetrics(l)))]),
  ) as Record<Language, string[]>;

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('Analyzing web files…'), cancellable: true },
    async (progress, token) => {
      // 1. Todos los ficheros del proyecto (para el inventario y el stack), con su tamaño.
      progress.report({ message: vscode.l10n.t('Listing files') });
      const limit = maxFiles * 5;
      const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*'), exclude, limit + 1, token);
      const truncated = uris.length > limit;
      uris.length = Math.min(uris.length, limit);
      uris.sort((a, b) => a.path.localeCompare(b.path));
      const files = uris.map((u) => ({ uri: u, path: relative(folder, u), size: 0 }));
      if (parts.includes('assets') || parts.includes('summary')) {
        for (let i = 0; i < files.length; i += 64) {
          if (token.isCancellationRequested) return undefined;
          await Promise.all(
            files.slice(i, i + 64).map(async (f) => {
              try {
                f.size = (await vscode.workspace.fs.stat(f.uri)).size;
              } catch {
                /* fichero que ya no existe */
              }
            }),
          );
        }
      }
      const read = async (u: vscode.Uri, size: number): Promise<string | undefined> => {
        if (size > MAX_TEXT) return undefined;
        try {
          return new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(u));
        } catch {
          return undefined;
        }
      };

      progress.report({ message: vscode.l10n.t('Analyzing code') });
      return scanProject(files, {
        chosen,
        tags,
        skipMinified: skipMin,
        maxFiles,
        truncated,
        read: (f) => read(f.uri, f.size),
        progress: (n, total) => progress.report({ message: `${n}/${total}` }),
        cancelled: () => token.isCancellationRequested,
      });
    },
  );
  if (!result) return;
  if (result.sections.length === 0 && parts.length === 0) {
    const choose = vscode.l10n.t('Choose metrics');
    const answer = await vscode.window.showWarningMessage(vscode.l10n.t('No metrics are selected.'), choose);
    if (answer === choose) await chooseMetrics(context);
    return;
  }
  lastReport = {
    project: folder.path.split('/').filter(Boolean).pop() ?? folder.path,
    author: cfg.get<string>('author', ''),
    date: new Date(),
    locale,
    perFile: cfg.get<boolean>('perFile', true),
    parts,
    ...result,
  };
  showReport(lastReport);
}

function relative(folder: vscode.Uri, file: vscode.Uri): string {
  const base = folder.path.endsWith('/') ? folder.path : folder.path + '/';
  return file.path.startsWith(base) ? file.path.slice(base.length) : file.path;
}

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function showReport(r: ReportData): void {
  if (!panel) {
    panel = vscode.window.createWebviewPanel('webReport', vscode.l10n.t('Web report'), vscode.ViewColumn.Active, {
      enableScripts: true,
      localResourceRoots: [],
    });
    panel.onDidDispose(() => (panel = undefined));
    panel.webview.onDidReceiveMessage((msg: { type: string }) => onMessage(msg.type));
  }
  panel.title = STRINGS[r.locale].title;
  panel.webview.html = renderHtml(r, {
    cspSource: panel.webview.cspSource,
    nonce: nonce(),
    buttons: [
      { id: 'markdown', label: vscode.l10n.t('Save as Markdown') },
      { id: 'html', label: vscode.l10n.t('Save as HTML') },
      { id: 'copy', label: vscode.l10n.t('Copy Markdown') },
      { id: 'author', label: vscode.l10n.t('Change author') },
      { id: 'refresh', label: vscode.l10n.t('Refresh') },
    ],
  });
  panel.reveal();
}

async function onMessage(type: string): Promise<void> {
  const r = lastReport;
  if (!r) return;
  switch (type) {
    case 'markdown':
    case 'html': {
      const ext = type === 'markdown' ? 'md' : 'html';
      const base = vscode.workspace.workspaceFolders?.[0]?.uri;
      const name = (r.locale === 'es' ? 'informe-web' : 'web-report') + '.' + ext;
      const dest = await vscode.window.showSaveDialog({
        defaultUri: base ? vscode.Uri.joinPath(base, name) : undefined,
        filters: type === 'markdown' ? { Markdown: ['md'] } : { HTML: ['html'] },
      });
      if (!dest) return;
      const content = type === 'markdown' ? renderMarkdown(r) : renderHtml(r);
      await vscode.workspace.fs.writeFile(dest, new TextEncoder().encode(content));
      const open = vscode.l10n.t('Open');
      if ((await vscode.window.showInformationMessage(vscode.l10n.t('Report saved to {0}', dest.fsPath), open)) === open) {
        await vscode.window.showTextDocument(dest);
      }
      return;
    }
    case 'copy':
      await vscode.env.clipboard.writeText(renderMarkdown(r));
      vscode.window.showInformationMessage(vscode.l10n.t('Report copied as Markdown'));
      return;
    case 'author':
      await setAuthor();
      return;
    case 'refresh':
      await vscode.commands.executeCommand('webReport.generate', lastFolder);
      return;
  }
}
