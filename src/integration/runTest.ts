import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const root = join(__dirname, '..', '..');
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: join(__dirname, 'index'),
    launchArgs: [
      join(root, 'test-fixtures'),
      '--disable-extensions',
      '--disable-workspace-trust',
      // Perfil temporal: los ajustes que cambian las pruebas no quedan en tu VS Code.
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vscode-web-code-stats-'))}`,
    ],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
