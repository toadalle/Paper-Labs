import test from 'node:test';
import assert from 'node:assert/strict';
import type { Entity } from '../src/domain/types.js';
import { applyEntityView, buildEntityRows, type EntityFilters } from '../src/frontend/entities/model.js';

const base = '2026-08-31T12:00:00.000Z';
const entities: Entity[] = [
  { id: 'e1', name: 'Alpha', family: 'Core', lifecycleState: 'CANDIDATE', candidateStatus: 'ACTIVE', evolutionRunId: 'run', birthEvolutionRunId: 'run', parentEntityId: null, mutationOperator: null, configurationStatus: 'DRAFT', strategyType: null, strategyVersion: null, traits: {}, traitHash: null, createdAt: base, retiredAt: null },
  { id: 'e2', name: 'Beta', family: 'Core', lifecycleState: 'PERMANENT', candidateStatus: null, evolutionRunId: null, birthEvolutionRunId: null, parentEntityId: null, mutationOperator: null, configurationStatus: 'DRAFT', strategyType: null, strategyVersion: null, traits: {}, traitHash: null, createdAt: base, retiredAt: null },
  { id: 'e3', name: 'Gamma', family: 'Other', lifecycleState: 'CANDIDATE', candidateStatus: 'ACTIVE', evolutionRunId: 'run', birthEvolutionRunId: 'run', parentEntityId: null, mutationOperator: null, configurationStatus: 'DRAFT', strategyType: null, strategyVersion: null, traits: {}, traitHash: null, createdAt: base, retiredAt: null }
];
const metrics = {
  e1: { recentReward: 0.2, consistency: 0.75, age: 4, lastActivity: '2026-08-31T12:00:00.000Z' },
  e2: { recentReward: -0.1, consistency: 0.25, age: 8, lastActivity: '2026-08-30T12:00:00.000Z' },
  e3: { recentReward: 0.5, consistency: 1, age: 5, lastActivity: '2026-08-31T13:00:00.000Z' }
};

test('entity column filters combine with AND and text matching is case-insensitive', () => {
  const filters: EntityFilters = {
    name: [{ operator: 'CONTAINS', value: 'a' }],
    lifecycle: [{ operator: 'IS', value: 'CANDIDATE' }],
    family: [{ operator: 'IS', value: 'core' }]
  };
  const rows = applyEntityView(buildEntityRows(entities, metrics), '', filters, null);
  assert.deepEqual(rows.map(row => row.entity.id), ['e1']);
});

test('only the supplied sort owns ordering and direction toggles deterministically', () => {
  const rows = buildEntityRows(entities, metrics);
  const ascending = applyEntityView(rows, '', {}, { column: 'recentReward', direction: 'ASC' });
  const descending = applyEntityView(rows, '', {}, { column: 'recentReward', direction: 'DESC' });
  assert.deepEqual(ascending.map(row => row.entity.id), ['e2', 'e1', 'e3']);
  assert.deepEqual(descending.map(row => row.entity.id), ['e3', 'e1', 'e2']);
});

test('broad search applies in addition to structured filters', () => {
  const rows = applyEntityView(buildEntityRows(entities, metrics), 'gamma', { lifecycle: [{ operator: 'IS', value: 'CANDIDATE' }] }, null);
  assert.deepEqual(rows.map(row => row.entity.id), ['e3']);
});

test('broad search matches displayed values from any data column, not header names', () => {
  const rows = buildEntityRows(entities, metrics);
  assert.deepEqual(applyEntityView(rows, 'candidate', {}, null).map(row => row.entity.id), ['e1', 'e3']);
  assert.deepEqual(applyEntityView(rows, '75%', {}, null).map(row => row.entity.id), ['e1']);
  assert.deepEqual(applyEntityView(rows, 'recent reward', {}, null).map(row => row.entity.id), []);
});


test('multiple filters on the same Entity column combine with AND', () => {
  const filters: EntityFilters = {
    name: [
      { operator: 'CONTAINS', value: 'a' },
      { operator: 'NOT_CONTAINS', value: 'mm' }
    ]
  };
  const rows = applyEntityView(buildEntityRows(entities, metrics), '', filters, null);
  assert.deepEqual(rows.map(row => row.entity.id), ['e1', 'e2']);
});
