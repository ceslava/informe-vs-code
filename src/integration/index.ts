/**
 * Pruebas dentro de un VS Code real (las lanza runTest.ts con @vscode/test-electron).
 * Sin mocha: run() lanza un error si algo falla.
 */
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { WebReportApi } from '../extension';

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension<WebReportApi>('ceslava.informe-web');
  assert.ok(ext, 'la extensión no está cargada');
  const api = await ext.activate();

  const commands = await vscode.commands.getCommands(true);
  for (const c of ['webReport.generate', 'webReport.chooseMetrics', 'webReport.setAuthor']) {
    assert.ok(commands.includes(c), `falta la orden ${c}`);
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, 'no hay carpeta abierta');
  const cfg = vscode.workspace.getConfiguration('webReport');
  await cfg.update('author', 'Lucía Prieto', vscode.ConfigurationTarget.Global);

  for (const [language, title, author, flex] of [
    ['es', '# Informe del proyecto web', '**Autor:** Lucía Prieto', '| display: flex | 2 |'],
    ['en', '# Web project report', '**Author:** Lucía Prieto', '| display: flex | 2 |'],
  ]) {
    await cfg.update('language', language, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('webReport.generate', folder.uri);
    const md = api.lastMarkdown() ?? '';
    assert.ok(md.includes(title), `${language}: título`);
    assert.ok(md.includes(author), `${language}: autor`);
    assert.ok(md.includes(flex), `${language}: display flex`);
  }

  // Solo JavaScript y solo dos métricas.
  await cfg.update('html.metrics', [], vscode.ConfigurationTarget.Global);
  await cfg.update('css.metrics', [], vscode.ConfigurationTarget.Global);
  await cfg.update('js.metrics', ['variables', 'functions'], vscode.ConfigurationTarget.Global);
  await vscode.commands.executeCommand('webReport.generate', folder.uri);
  const r = api.lastReport();
  assert.deepEqual(r?.sections.map((s) => s.lang), ['js']);
  assert.deepEqual(r?.sections[0].metrics, ['variables', 'functions']);
  assert.equal(r?.sections[0].total.variables.value, 13);
  assert.equal(r?.sections[0].total.functions.value, 7);
  console.log('Pruebas de integración: todo bien');
}
