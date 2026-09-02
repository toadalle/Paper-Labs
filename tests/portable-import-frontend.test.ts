import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const main = readFileSync(join(root, 'src/frontend/main.ts'), 'utf8');
const entities = readFileSync(join(root, 'src/frontend/pages/entities.ts'), 'utf8');
const arenas = readFileSync(join(root, 'src/frontend/pages/arenas.ts'), 'utf8');
const styles = readFileSync(join(root, 'public/styles.css'), 'utf8');

test('Entity and Arena Objects preserve one-click + creation and expose equal-height Import controls beside it', () => {
  assert.match(entities, /id="import-entity-objects" class="button" data-portable-import-toggle/);
  assert.match(entities, /id="new-entity" class="icon-button plus-button"/);
  assert.match(arenas, /id="import-arena-objects" class="button" data-portable-import-toggle/);
  assert.match(arenas, /id="new-arena" class="icon-button plus-button"/);
  assert.doesNotMatch(entities, /id="import-entity-objects" class="button compact"/);
  assert.doesNotMatch(arenas, /id="import-arena-objects" class="button compact"/);
});

test('selected Entity and selected Arena expose context-sensitive Import Code actions through the same panel toggle', () => {
  assert.match(entities, /id="entity-import-selected"[^>]*data-portable-import-toggle/);
  assert.match(arenas, /id="arena-import-selected"[^>]*data-portable-import-toggle/);
  assert.match(main, /togglePortableImport\('ENTITY_SELECTED'/);
  assert.match(main, /togglePortableImport\('ARENA_SELECTED'/);
});

test('portable Import always previews server-side before apply and does not mutate on paste', () => {
  assert.match(main, /\/api\/import\/preview/);
  assert.match(main, /\/api\/import\/apply/);
  assert.match(main, /Pasting never mutates data/);
  assert.match(main, /plan\.valid/);
});

test('portable Import uses the same persistent right-side panel geometry and dismissal model as Notification History', () => {
  assert.match(styles, /\.portable-import-panel \{/);
  assert.match(styles, /top:\s*3rem/);
  assert.match(styles, /right:\s*0/);
  assert.match(styles, /bottom:\s*0/);
  assert.match(styles, /width:\s*var\(--notification-panel-width\)/);
  assert.match(main, /portable-import-panel shell-import-\$\{state\.shellMode\}/);
  assert.match(main, /state\.importOpen && !target\?\.closest\('\.portable-import-panel'\) && !target\?\.closest\('\[data-portable-import-toggle\]'\)/);
  assert.match(main, /if \(state\.importOpen && state\.importSurface === surface && state\.importTargetId === targetId\)/);
});
