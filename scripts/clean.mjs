import { rmSync } from 'node:fs';
for (const path of ['dist', 'dist-tests']) rmSync(path, { recursive: true, force: true });
