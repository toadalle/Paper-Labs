import type { Entity } from '../../domain/types.js';
import type { EntityMetricsView } from '../types.js';
import { formatNumber, formatRelative } from '../shared/format.js';

export type EntityColumnKey = 'name' | 'family' | 'lifecycle' | 'configuration' | 'recentReward' | 'consistency' | 'age' | 'lastActivity';
export type SortDirection = 'ASC' | 'DESC';
export type EntityFilterOperator =
  | 'IS'
  | 'IS_NOT'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'BEFORE'
  | 'AFTER';

export interface EntitySort {
  column: EntityColumnKey;
  direction: SortDirection;
}

export interface EntityColumnFilter {
  operator: EntityFilterOperator;
  value: string;
}

/** Multiple rules may exist per column. All rules combine with AND. */
export type EntityFilters = Partial<Record<EntityColumnKey, EntityColumnFilter[]>>;

export interface EntityRowView {
  entity: Entity;
  metrics: EntityMetricsView;
}

export interface EntityColumnDefinition {
  key: EntityColumnKey;
  label: string;
  type: 'TEXT' | 'ENUM' | 'NUMBER' | 'DATE';
  enumValues?: string[];
}

export const ENTITY_COLUMNS: EntityColumnDefinition[] = [
  { key: 'name', label: 'Name', type: 'TEXT' },
  { key: 'family', label: 'Family', type: 'TEXT' },
  { key: 'lifecycle', label: 'Lifecycle', type: 'ENUM', enumValues: ['CANDIDATE', 'PERMANENT', 'RETIRED'] },
  { key: 'configuration', label: 'Config', type: 'ENUM', enumValues: ['DRAFT', 'READY'] },
  { key: 'recentReward', label: 'Recent Reward', type: 'NUMBER' },
  { key: 'consistency', label: 'Consistency', type: 'NUMBER' },
  { key: 'age', label: 'Age', type: 'NUMBER' },
  { key: 'lastActivity', label: 'Last Activity', type: 'DATE' }
];

export const DEFAULT_ENTITY_FILTERS: EntityFilters = {
  lifecycle: [{ operator: 'IS', value: 'PERMANENT' }]
};

export function buildEntityRows(entities: Entity[], metrics: Record<string, EntityMetricsView>): EntityRowView[] {
  return entities.map(entity => ({
    entity,
    metrics: metrics[entity.id] ?? {
      recentReward: null,
      consistency: null,
      age: 0,
      lastActivity: entity.createdAt
    }
  }));
}

export function applyEntityView(rows: EntityRowView[], search: string, filters: EntityFilters, sort: EntitySort | null): EntityRowView[] {
  const query = search.trim().toLowerCase();
  const filtered = rows.filter(row => {
    if (query && ![row.entity.id, ...ENTITY_COLUMNS.map(column => displayValueForSearch(row, column.key))].some(value => value.toLowerCase().includes(query))) return false;
    return Object.entries(filters).every(([key, rules]) => {
      if (!rules?.length) return true;
      return rules.every(rule => matchesFilter(row, key as EntityColumnKey, rule));
    });
  });
  if (!sort) return filtered;
  return [...filtered].sort((a, b) => compareRows(a, b, sort));
}

export function displayValueForSearch(row: EntityRowView, key: EntityColumnKey): string {
  switch (key) {
    case 'name': return row.entity.name;
    case 'family': return row.entity.family ?? '—';
    case 'lifecycle': return row.entity.lifecycleState;
    case 'configuration': return row.entity.configurationStatus;
    case 'recentReward': return row.metrics.recentReward === null ? '—' : `${row.metrics.recentReward > 0 ? '+' : ''}${formatNumber(row.metrics.recentReward, 4)}`;
    case 'consistency': return row.metrics.consistency === null ? '—' : `${formatNumber(row.metrics.consistency * 100, 1)}%`;
    case 'age': return formatNumber(row.metrics.age, 0);
    case 'lastActivity': return formatRelative(row.metrics.lastActivity);
  }
}

export function columnDefinition(key: EntityColumnKey): EntityColumnDefinition {
  const column = ENTITY_COLUMNS.find(item => item.key === key);
  if (!column) throw new Error(`Unknown Entity column: ${key}`);
  return column;
}

export function operatorsFor(key: EntityColumnKey): EntityFilterOperator[] {
  switch (columnDefinition(key).type) {
    case 'TEXT': return ['IS', 'IS_NOT', 'CONTAINS', 'NOT_CONTAINS'];
    case 'ENUM': return ['IS', 'IS_NOT'];
    case 'NUMBER': return ['EQ', 'NEQ', 'GT', 'LT', 'GTE', 'LTE'];
    case 'DATE': return ['BEFORE', 'AFTER'];
  }
}

export function operatorLabel(operator: EntityFilterOperator): string {
  return ({
    IS: 'Is', IS_NOT: 'Is not', CONTAINS: 'Contains', NOT_CONTAINS: 'Does not contain',
    EQ: '=', NEQ: '≠', GT: '>', LT: '<', GTE: '≥', LTE: '≤', BEFORE: 'Before', AFTER: 'After'
  })[operator];
}

function matchesFilter(row: EntityRowView, key: EntityColumnKey, filter: EntityColumnFilter): boolean {
  const value = valueFor(row, key);
  const expected = filter.value;

  if (typeof value === 'number') {
    const target = Number(expected);
    if (!Number.isFinite(target)) return false;
    switch (filter.operator) {
      case 'EQ': return value === target;
      case 'NEQ': return value !== target;
      case 'GT': return value > target;
      case 'LT': return value < target;
      case 'GTE': return value >= target;
      case 'LTE': return value <= target;
      default: return false;
    }
  }

  if (key === 'lastActivity') {
    const actualTime = Date.parse(String(value));
    const expectedTime = Date.parse(expected);
    if (!Number.isFinite(actualTime) || !Number.isFinite(expectedTime)) return false;
    if (filter.operator === 'BEFORE') return actualTime < expectedTime;
    if (filter.operator === 'AFTER') return actualTime > expectedTime;
    return false;
  }

  const actual = String(value ?? '').toLowerCase();
  const target = expected.toLowerCase();
  switch (filter.operator) {
    case 'IS': return actual === target;
    case 'IS_NOT': return actual !== target;
    case 'CONTAINS': return actual.includes(target);
    case 'NOT_CONTAINS': return !actual.includes(target);
    default: return false;
  }
}

function valueFor(row: EntityRowView, key: EntityColumnKey): string | number | null {
  switch (key) {
    case 'name': return row.entity.name;
    case 'family': return row.entity.family ?? '';
    case 'lifecycle': return row.entity.lifecycleState;
    case 'configuration': return row.entity.configurationStatus;
    case 'recentReward': return row.metrics.recentReward;
    case 'consistency': return row.metrics.consistency;
    case 'age': return row.metrics.age;
    case 'lastActivity': return row.metrics.lastActivity;
  }
}

function compareRows(a: EntityRowView, b: EntityRowView, sort: EntitySort): number {
  const left = valueFor(a, sort.column);
  const right = valueFor(b, sort.column);
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  let result: number;
  if (typeof left === 'number' && typeof right === 'number') result = left - right;
  else if (sort.column === 'lastActivity') result = Date.parse(String(left)) - Date.parse(String(right));
  else result = String(left).localeCompare(String(right), undefined, { sensitivity: 'base', numeric: true });

  return sort.direction === 'ASC' ? result : -result;
}
