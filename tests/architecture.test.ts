import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function files(root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, name.name);
    if (name.isDirectory()) out.push(...files(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

test('frontend cannot import infrastructure or server code', () => {
  for (const path of files('src/frontend')) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /from ['"].*\b(infrastructure|server)\b/);
  }
});

test('new source tree contains no legacy Training or Replay feature modules', () => {
  const paths = files('src').join('\n').toLowerCase().replaceAll('\\', '/');
  assert.equal(paths.includes('/training/'), false);
  assert.equal(paths.includes('/replay/'), false);
  assert.equal(paths.includes('/agents/'), false);
  assert.equal(paths.includes('/challenges/'), false);
});

test('frontend avoids native prompt/alert/confirm interaction', () => {
  for (const path of files('src/frontend')) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /window\.(prompt|alert|confirm)\s*\(/);
  }
});

test('visual system remains flat and uses Cascadia Code without ligatures', () => {
  const css = readFileSync('public/styles.css', 'utf8');
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|box-shadow/i);
  assert.match(css, /Cascadia Code/);
  assert.match(css, /font-variant-ligatures:\s*none/);
});
