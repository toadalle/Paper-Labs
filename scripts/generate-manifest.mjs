import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const version = String(pkg.version);

function normalize(path) {
  return path.split(sep).join('/');
}

function excluded(path) {
  const p = normalize(path);
  if (!p) return false;
  if (p === '.env') return true;
  if (p === '.DS_Store') return true;
  if (p.startsWith('node_modules/')) return true;
  if (p.startsWith('dist/')) return true;
  if (p.startsWith('dist-tests/')) return true;
  if (p.startsWith('collaboration/manifests/')) return true;
  if (p.startsWith('data/datasets/')) return true;
  if (p.startsWith('data/logs/')) return true;
  if (p.startsWith('data/exports/')) return true;
  if (/^data\/.*\.sqlite(?:-wal|-shm)?$/i.test(p)) return true;
  if (/\.zip$/i.test(p)) return true;
  return false;
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = resolve(dir, entry.name);
    const rel = normalize(relative(root, absolute));
    if (excluded(rel)) continue;
    if (entry.isDirectory()) out.push(...await walk(absolute));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

const files = (await walk(root)).sort();
const entries = [];
for (const path of files) {
  const data = await readFile(resolve(root, path));
  const info = await stat(resolve(root, path));
  entries.push({
    path,
    sha256: createHash('sha256').update(data).digest('hex'),
    bytes: info.size
  });
}

const manifest = {
  version,
  generatedAt: new Date().toISOString(),
  algorithm: 'sha256',
  trackedFileCount: entries.length,
  exclusions: [
    '.env',
    'node_modules/',
    'dist/',
    'dist-tests/',
    'collaboration/manifests/',
    'data/datasets/',
    'data/logs/',
    'data/exports/',
    'data/*.sqlite*',
    '*.zip'
  ],
  files: entries
};

const outDir = resolve(root, 'collaboration', 'manifests');
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, `MANIFEST-${version}.json`);
await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${relative(root, outPath)} with ${entries.length} tracked files.`);
