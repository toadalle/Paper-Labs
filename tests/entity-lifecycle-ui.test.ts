import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lifecycleActionForEntity } from '../src/frontend/domain-ui/entity-actions.js';
import type { Entity } from '../src/domain/types.js';

const candidate: Entity = {
  id: 'entity_candidate', name: 'Candidate', family: null, lifecycleState: 'CANDIDATE', candidateStatus: 'ACTIVE',
  evolutionRunId: null, birthEvolutionRunId: null, parentEntityId: null, mutationOperator: null, configurationStatus: 'DRAFT', strategyType: null, strategyVersion: null, traits: {}, traitHash: null,
  createdAt: '2026-09-01T12:00:00.000Z', retiredAt: null
};

test('Entity lifecycle action is Retire before retirement and Delete afterward', () => {
  assert.equal(lifecycleActionForEntity(candidate).id, 'RETIRE');
  assert.equal(lifecycleActionForEntity({ ...candidate, lifecycleState: 'PERMANENT', candidateStatus: null }).id, 'RETIRE');
  assert.equal(lifecycleActionForEntity({ ...candidate, lifecycleState: 'RETIRED', candidateStatus: null, retiredAt: '2026-09-01T13:00:00.000Z' }).id, 'DELETE');
});

test('Entity lifecycle action is exposed through both Inspector and context-menu keyboard/mouse paths', () => {
  const entitiesPage = readFileSync('src/frontend/pages/entities.ts', 'utf8');
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  assert.match(entitiesPage, /id="entity-lifecycle-action"/);
  assert.match(main, /data-entity-context-lifecycle/);
  assert.match(main, /addEventListener\('contextmenu'/);
  assert.match(main, /event\.key === 'ContextMenu'/);
  assert.match(main, /event\.shiftKey && event\.key === 'F10'/);
});
