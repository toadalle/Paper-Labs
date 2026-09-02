import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entities = readFileSync('src/frontend/pages/entities.ts', 'utf8');
const arenas = readFileSync('src/frontend/pages/arenas.ts', 'utf8');
const main = readFileSync('src/frontend/main.ts', 'utf8');
const routes = readFileSync('src/server/routes.ts', 'utf8');
const evaluation = readFileSync('src/application/services/evaluation-service.ts', 'utf8');

test('DRAFT Entity configuration is persistable before immutable finalization', () => {
  assert.match(entities, /entity-save-draft-configuration/);
  assert.match(main, /\/configuration`[\s\S]*method: 'PATCH'/);
  assert.match(main, /\/configuration\/finalize`[\s\S]*method: 'POST'/);
  assert.match(entities, /Finalize Configuration/);
});

test('Arena workspace exposes actual version-family creation rather than a display-only version field', () => {
  assert.match(arenas, /id="arena-base-version"/);
  assert.match(main, /baseArenaId: baseArenaId \|\| null/);
  assert.match(routes, /baseArenaId/);
});

test('Experience Inspector displays backend scientific results and provenance without recomputing Reward', () => {
  assert.match(arenas, /Hard Gates/);
  assert.match(arenas, /Snapshot hash/);
  assert.match(arenas, /Execution engine/);
  assert.match(arenas, /Indicator library/);
  assert.doesNotMatch(arenas, /excessReturn\s*-\s*.*maxDrawdown/);
  assert.doesNotMatch(arenas, /computeReward/);
});

test('scored evaluation resolves immutable snapshots and stamps engine plus indicator versions', () => {
  assert.match(evaluation, /snapshots\.loadBars\(snapshot\)/);
  assert.match(evaluation, /marketDataContentHashes: \[snapshot\.contentHash\]/);
  assert.match(evaluation, /indicatorLibraryVersion: INDICATOR_LIBRARY_VERSION/);
  assert.match(evaluation, /executionEngineVersion: EXECUTION_ENGINE_VERSION/);
});

test('Arena authoring exposes timeframe, avoids invalid capital step-base math, and does not silently prefill research inputs', () => {
  assert.match(arenas, /id="arena-timeframe"[\s\S]*ARENA_CREATE_DEFAULTS\.timeframe/);
  assert.match(arenas, /id="arena-capital"[\s\S]*step="0\.01"/);
  assert.doesNotMatch(arenas, /id="arena-capital"[^>]*value="10000"/);
  assert.doesNotMatch(arenas, /id="arena-name"[^>]*value="Discovery Arena"/);
  assert.doesNotMatch(arenas, /id="arena-symbol"[^>]*value="SPY"/);
  assert.match(main, /optionalNumberInput\('#arena-capital'\)/);
  assert.match(main, /timeframe[\s\S]*#arena-timeframe/);
});

test('Arena Inspector exposes Run Evaluation for READY Candidates using the shared evaluation request path', () => {
  assert.match(arenas, /id="arena-evaluate-entity"/);
  assert.match(arenas, /id="arena-run-evaluation"/);
  assert.match(arenas, /configurationStatus === 'READY'/);
  assert.match(main, /evaluateSelectedArena/);
  assert.match(main, /runEvaluation\(entityId, arenaId/);
  assert.match(main, /\/api\/evaluations/);
});

test('failed draft validation preserves the attempted strategy values across notification rerenders', () => {
  assert.match(main, /state\.entityDraftConfiguration = draft/);
  assert.match(entities, /activeDraft = draftConfiguration\?\.entityId === entity\.id/);
  assert.match(entities, /draftTraits\.fast_window/);
  assert.match(entities, /draftTraits\.slow_window/);
});

test('Arena creation is an explicit + workspace mode rather than a permanent create form', () => {
  assert.match(arenas, /id="new-arena"/);
  assert.match(arenas, /if \(input\.createMode\) return arenaCreateWorkspace/);
  assert.match(arenas, /id="arena-create-cancel"/);
  assert.match(main, /state\.arenaCreateMode = true/);
  assert.match(main, /state\.arenaCreateMode = false/);
  assert.match(main, /createMode: state\.arenaCreateMode/);
});

test('Experience Inspector exports complete read-only scientific evidence', () => {
  assert.match(arenas, /id="experience-export-results"/);
  assert.match(arenas, /read-only JSON result artifact/);
  assert.match(main, /paper-lab-experience-result/);
  assert.match(main, /experience: detail\.experience/);
  assert.match(main, /events: detail\.events/);
  assert.match(main, /trace: detail\.trace/);
  assert.match(main, /paper-lab-experience-\$\{id\}\.json/);
});
