import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
rmSync(resolve(root, 'dist-tests'), { recursive: true, force: true });

const tsc = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc');
const compile = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.tests.json'], {
  cwd: root,
  stdio: 'inherit'
});
if (compile.status !== 0) process.exit(compile.status ?? 1);

const run = spawnSync(process.execPath, ['--test', 'dist-tests/tests/*.test.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: true
});
process.exit(run.status ?? 1);
