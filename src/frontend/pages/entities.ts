import type { Arena, Entity } from '../../domain/types.js';
import { candidateStateLabel } from '../domain-ui/entity.js';
import { lifecycleActionForEntity } from '../domain-ui/entity-actions.js';
import {
  ENTITY_COLUMNS,
  columnDefinition,
  displayValueForSearch,
  operatorLabel,
  operatorsFor,
  type EntityColumnFilter,
  type EntityColumnKey,
  type EntityFilters,
  type EntityRowView,
  type EntitySort,
  type EntityFilterOperator
} from '../entities/model.js';
import { escapeHtml } from '../shared/escape.js';
import { filterIcon } from '../shared/icons.js';

export interface EntityFilterFlyout {
  column: EntityColumnKey;
  operator: EntityFilterOperator;
  left: number;
  top: number;
}

export interface EntityDraftConfigurationView {
  entityId: string;
  strategyType: string;
  traits: { fast_window: number; slow_window: number; target_exposure: number };
}

export interface EntitiesPageInput {
  rows: EntityRowView[];
  allEntityCount: number;
  selectedEntityId: string | null;
  search: string;
  searchDraft: string;
  filters: EntityFilters;
  sort: EntitySort | null;
  filterFlyout: EntityFilterFlyout | null;
  recentEntities: Entity[];
  pinnedEntities: Entity[];
  experienceCount: number;
  snapshotCount: number;
  arenaCount: number;
  arenas: Arena[];
  saveState: string | null;
  draftConfiguration: EntityDraftConfigurationView | null;
}

export function renderEntitiesPage(input: EntitiesPageInput): { objects: string; workspace: string; inspector: string } {
  const selected = input.rows.find(row => row.entity.id === input.selectedEntityId)?.entity
    ?? input.recentEntities.find(entity => entity.id === input.selectedEntityId)
    ?? input.pinnedEntities.find(entity => entity.id === input.selectedEntityId)
    ?? null;

  return {
    objects: renderObjects(input),
    workspace: `
      <div class="workspace-header entity-workspace-header">
        <div class="workspace-title"><div class="eyebrow">Research population</div><h1>Entities</h1></div>
        <div class="workspace-search search-with-clear">
          <input id="entity-search" class="control" type="text" value="${escapeHtml(input.searchDraft)}" placeholder="Search all Entity values" aria-label="Search all Entity values" autocomplete="off" spellcheck="false">
          <button id="entity-search-clear" class="search-clear" type="button" aria-label="Clear Entity search">×</button>
        </div>
        <div class="workspace-actions">
          <span class="metric">${input.experienceCount} experiences</span>
          <span class="metric">${input.snapshotCount} snapshots</span>
          <span class="metric">${input.arenaCount} arenas</span>
        </div>
      </div>
      <div class="table-wrap table-viewport" data-table-viewport="entities">${table(input)}</div>
      ${input.filterFlyout ? filterFlyout(input.filterFlyout, input.filters[input.filterFlyout.column] ?? []) : ''}
    `,
    inspector: selected ? inspector(selected, input.saveState, input.pinnedEntities.some(entity => entity.id === selected.id), input.arenas, input.draftConfiguration) : emptyInspector()
  };
}

function renderObjects(input: EntitiesPageInput): string {
  return `
    <div class="panel-heading">
      <div><div class="eyebrow">Objects</div><h2>Entities</h2></div>
      <div class="panel-heading-actions"><button id="import-entity-objects" class="button" data-portable-import-toggle type="button">Import</button><button id="new-entity" class="icon-button plus-button" type="button" aria-label="Create Entity"><span aria-hidden="true">+</span></button></div>
    </div>
    <div class="objects-summary objects-summary-top"><span>${input.rows.length} shown</span><span>${input.allEntityCount} total</span></div>
    ${objectSection('Recent', input.recentEntities, input.selectedEntityId, input.pinnedEntities)}
    ${objectSection('Pinned', input.pinnedEntities, input.selectedEntityId, input.pinnedEntities, true)}
  `;
}

function objectSection(label: string, entities: Entity[], selectedId: string | null, pinned: Entity[], pinnedSection = false): string {
  return `
    <section class="object-section">
      <div class="object-section-title">${escapeHtml(label)}</div>
      <div class="object-list">
        ${entities.length ? entities.map(entity => {
          const isPinned = pinned.some(item => item.id === entity.id);
          return `
            <div class="object-row ${entity.id === selectedId ? 'selected' : ''}" data-entity-object-id="${escapeHtml(entity.id)}" tabindex="0">
              <div class="object-row-copy"><strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(entity.lifecycleState)}</span></div>
              <button class="object-row-action ${isPinned ? 'active' : ''}" data-pin-entity-id="${escapeHtml(entity.id)}" type="button" aria-label="${isPinned ? 'Unpin' : 'Pin'} ${escapeHtml(entity.name)}">${isPinned ? '★' : '☆'}</button>
            </div>`;
        }).join('') : `<div class="object-section-empty">${pinnedSection ? 'No pinned Entities.' : 'No recent Entities.'}</div>`}
      </div>
    </section>`;
}

function table(input: EntitiesPageInput): string {
  const body = input.rows.length
    ? input.rows.map(row => entityRow(row, input.selectedEntityId, input.search)).join('')
    : `<tr class="entity-no-results"><td colspan="${ENTITY_COLUMNS.length}"><strong>No Entities match this view.</strong><span>Adjust search or column filters, or use + to create a new Candidate.</span></td></tr>`;
  return `
    <table class="entity-table">
      <thead><tr>${ENTITY_COLUMNS.map(column => columnHeader(column.key, input)).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function columnHeader(key: EntityColumnKey, input: EntitiesPageInput): string {
  const column = columnDefinition(key);
  const activeSort = input.sort?.column === key ? input.sort : null;
  const sortText = activeSort?.direction === 'DESC' ? 'Z–A' : 'A–Z';
  const nextSortDirection = activeSort?.direction === 'ASC' ? 'descending' : 'ascending';
  const filters = input.filters[key] ?? [];
  return `
    <th class="entity-column-header">
      <div class="column-header-inner">
        <span>${escapeHtml(column.label)}</span>
        <span class="column-header-controls">
          <button class="table-tool sort-tool ${activeSort ? 'active' : ''}" data-sort-column="${key}" type="button" aria-label="Sort ${escapeHtml(column.label)} ${nextSortDirection}">${sortText}</button>
          <button class="table-tool filter-tool ${filters.length ? 'active' : ''}" data-filter-column="${key}" type="button" aria-label="${filters.length ? `${column.label} has ${filters.length} active filter${filters.length === 1 ? '' : 's'}` : `Filter ${column.label}`}">${filterIcon()}${filters.length ? `<span class="filter-count">${filters.length}</span>` : ''}</button>
        </span>
      </div>
    </th>`;
}

function filterFlyout(flyout: EntityFilterFlyout, current: EntityColumnFilter[]): string {
  const key = flyout.column;
  const column = columnDefinition(key);
  const style = `left:${Math.round(flyout.left)}px;top:${Math.round(flyout.top)}px`;
  const activeRules = current.length ? `
    <div class="filter-rules" aria-label="Active ${escapeHtml(column.label)} filters">
      ${current.map((rule, index) => `<button class="filter-rule-pill" data-remove-filter-rule="${key}" data-filter-rule-index="${index}" type="button" title="Remove ${escapeHtml(operatorLabel(rule.operator))} ${escapeHtml(rule.value)}"><span>${escapeHtml(operatorLabel(rule.operator))}</span><strong>:</strong><span>${escapeHtml(rule.value)}</span><b aria-hidden="true">×</b></button>`).join('')}
      <button class="filter-clear-all" data-clear-filter="${key}" type="button">Clear all</button>
    </div>` : '';
  const valueControl = column.type === 'ENUM'
    ? `<select id="filter-value-${key}" class="control">${(column.enumValues ?? []).map(value => `<option value="${escapeHtml(value)}">${escapeHtml(titleCase(value))}</option>`).join('')}</select>`
    : `<input id="filter-value-${key}" class="control" type="${column.type === 'NUMBER' ? 'number' : column.type === 'DATE' ? 'date' : 'text'}" value="" ${column.type === 'NUMBER' ? 'step="any"' : ''} autocomplete="off">`;
  return `
    <div class="filter-flyout filter-flyout-portal" style="${style}" role="dialog" aria-label="Filter ${escapeHtml(column.label)}">
      <div class="flyout-title">${escapeHtml(column.label)} filters</div>
      ${activeRules}
      <label class="stacked-field"><span>Condition</span><select id="filter-condition-${key}" class="control">${operatorsFor(key).map(operator => `<option value="${operator}" ${flyout.operator === operator ? 'selected' : ''}>${escapeHtml(operatorLabel(operator))}</option>`).join('')}</select></label>
      <label class="stacked-field"><span>Value</span>${valueControl}</label>
      <div class="flyout-actions"><button class="button primary" data-apply-filter="${key}" type="button">Add filter</button></div>
    </div>`;
}

function entityRow(row: EntityRowView, selectedId: string | null, search: string): string {
  const entity = row.entity;
  return `
    <tr class="${entity.id === selectedId ? 'selected' : ''}" data-entity-id="${escapeHtml(entity.id)}" tabindex="0">
      <td><strong>${highlight(displayValueForSearch(row, 'name'), search)}</strong><small>${highlight(entity.id, search)}</small></td>
      <td>${highlight(displayValueForSearch(row, 'family'), search)}</td>
      <td><span class="status-chip">${highlight(displayValueForSearch(row, 'lifecycle'), search)}</span></td>
      <td><span class="status-chip config-${entity.configurationStatus.toLowerCase()}">${highlight(displayValueForSearch(row, 'configuration'), search)}</span></td>
      <td class="mono">${highlight(displayValueForSearch(row, 'recentReward'), search)}</td>
      <td class="mono">${highlight(displayValueForSearch(row, 'consistency'), search)}</td>
      <td class="mono">${highlight(displayValueForSearch(row, 'age'), search)}</td>
      <td class="muted">${highlight(displayValueForSearch(row, 'lastActivity'), search)}</td>
    </tr>`;
}

function highlight(value: string, query: string): string {
  const needle = query.trim();
  if (!needle) return escapeHtml(value);
  const lower = value.toLowerCase();
  const target = needle.toLowerCase();
  let cursor = 0;
  let out = '';
  while (cursor < value.length) {
    const index = lower.indexOf(target, cursor);
    if (index < 0) {
      out += escapeHtml(value.slice(cursor));
      break;
    }
    out += escapeHtml(value.slice(cursor, index));
    out += `<mark class="search-hit">${escapeHtml(value.slice(index, index + needle.length))}</mark>`;
    cursor = index + needle.length;
  }
  return out || escapeHtml(value);
}

function inspector(entity: Entity, saveState: string | null, pinned: boolean, arenas: Arena[], draftConfiguration: EntityDraftConfigurationView | null): string {
  const lifecycleAction = lifecycleActionForEntity(entity);
  const ready = entity.configurationStatus === 'READY';
  const canEvaluate = ready && entity.lifecycleState === 'CANDIDATE' && entity.candidateStatus === 'ACTIVE' && arenas.length > 0;
  const activeDraft = draftConfiguration?.entityId === entity.id ? draftConfiguration : null;
  const draftTraits = activeDraft?.traits ?? {
    fast_window: Number(entity.traits.fast_window ?? 10),
    slow_window: Number(entity.traits.slow_window ?? 30),
    target_exposure: Number(entity.traits.target_exposure ?? 1)
  };
  const strategySection = ready
    ? `<div class="inspector-section"><h3>Strategy</h3>${field('Configuration', 'READY')}${field('Type', entity.strategyType ?? '—')}${field('Version', entity.strategyVersion ? `v${entity.strategyVersion}` : '—')}${field('Trait hash', entity.traitHash ?? '—')}<div class="trait-readout">${Object.entries(entity.traits).map(([key, value]) => field(titleCase(key), String(value))).join('')}</div><div class="placeholder compact">Birth strategy and traits are immutable. Create a new Entity to vary them.</div></div>`
    : `<div class="inspector-section"><h3>Strategy · Draft</h3>
        <label class="inspector-edit-field"><span>Strategy</span><select id="entity-strategy-type" class="control"><option value="MOVING_AVERAGE_CROSS" ${(activeDraft?.strategyType ?? entity.strategyType ?? 'MOVING_AVERAGE_CROSS') === 'MOVING_AVERAGE_CROSS' ? 'selected' : ''}>Moving Average Cross</option></select></label>
        <div class="trait-grid">
          <label class="inspector-edit-field"><span>Fast Window</span><input id="entity-trait-fast" class="control" type="number" min="1" max="100" step="1" value="${escapeHtml(String(draftTraits.fast_window))}"></label>
          <label class="inspector-edit-field"><span>Slow Window</span><input id="entity-trait-slow" class="control" type="number" min="2" max="200" step="1" value="${escapeHtml(String(draftTraits.slow_window))}"></label>
          <label class="inspector-edit-field"><span>Target Exposure</span><input id="entity-trait-exposure" class="control" type="number" min="0" max="1" step="0.05" value="${escapeHtml(String(draftTraits.target_exposure))}"></label>
        </div>
        <div class="action-grid">
          <button id="entity-save-draft-configuration" class="button" type="button">Save Draft</button>
          <button id="entity-finalize-configuration" class="button primary" type="button">Finalize Configuration</button>
        </div>
        <div class="placeholder compact">Save Draft preserves editable configuration. Finalizing locks strategy type and traits as immutable birth configuration.</div>
      </div>`;
  const arenaSelect = arenas.length
    ? `<label class="inspector-edit-field"><span>Arena</span><select id="entity-evaluate-arena" class="control">${arenas.map(arena => `<option value="${escapeHtml(arena.id)}">${escapeHtml(arena.name)} · ${escapeHtml(arena.symbolUniverse[0] ?? '—')} · v${arena.version}</option>`).join('')}</select></label>`
    : `<div class="placeholder compact">Create an Arena before evaluating a READY Entity.</div>`;
  return `
    <div class="inspector-section profile">
      <div class="eyebrow">Inspector</div>
      <div class="inspector-title-row"><h2>${escapeHtml(entity.name)}</h2><button id="inspector-pin-entity" class="object-row-action ${pinned ? 'active' : ''}" type="button" aria-label="${pinned ? 'Unpin' : 'Pin'} ${escapeHtml(entity.name)}">${pinned ? '★' : '☆'}</button></div>
      <div class="subtitle mono">${escapeHtml(entity.id)}</div>
    </div>
    <div class="inspector-section">
      <h3>Profile</h3>
      <label class="inspector-edit-field"><span>Name</span><input id="entity-name-input" class="control" value="${escapeHtml(entity.name)}" maxlength="80"></label>
      <label class="inspector-edit-field"><span>Family</span><input id="entity-family-input" class="control" value="${escapeHtml(entity.family ?? '')}" maxlength="80" placeholder="None"></label>
      <div class="field-save-state" aria-live="polite">${escapeHtml(saveState ?? '')}</div>
      ${field('Lifecycle', entity.lifecycleState)}
      ${field('Configuration', entity.configurationStatus)}
      ${field('Candidate state', candidateStateLabel(entity))}
      ${field('Origin run', entity.birthEvolutionRunId ?? '—')}
    </div>
    ${strategySection}
    <div class="inspector-section"><h3>Portable Configuration</h3><div class="action-grid"><button id="entity-import-selected" class="button" data-portable-import-toggle type="button">Import Code</button></div><div class="placeholder compact">The same Entity code creates a new Entity from Objects → Import, or patches this selected Entity here. READY trait changes create a new DRAFT Variant instead of rewriting birth traits.</div></div>
    <div class="inspector-section"><h3>Evaluate</h3>${arenaSelect}<div class="action-grid">
      <button id="entity-evaluate" class="button primary" type="button" ${canEvaluate ? '' : 'disabled'}>${canEvaluate ? 'Run Evaluation' : ready ? 'Evaluation unavailable' : 'Finalize first'}</button>
      <button class="button" type="button" disabled>Compare</button>
      <button class="button" type="button" disabled>Promotion</button>
      <button id="entity-lifecycle-action" class="button danger" data-entity-lifecycle-action="${lifecycleAction.id}" type="button">${lifecycleAction.label}</button>
    </div></div>
    <div class="inspector-section"><h3>Performance</h3><div class="placeholder">Completed Experiences appear under Arenas → Experiences.</div></div>
    <div class="inspector-section"><h3>Memory</h3><div class="placeholder">Memory projection will appear after scored Experiences.</div></div>
    <div class="inspector-section"><h3>Lineage</h3>${field('Parent', entity.parentEntityId ?? 'Root')}${field('Operator', entity.mutationOperator ?? '—')}<div class="placeholder compact">Lineage is birth-immutable. Variations create a new Entity rather than rewriting this one.</div></div>
  `;
}

function emptyInspector(): string {
  return `<div class="inspector-section profile"><div class="eyebrow">Inspector</div><h2>No selection</h2><div class="placeholder">Select an Entity from the current view.</div></div>`;
}

function field(label: string, value: string): string {
  return `<div class="field-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|_)([a-z])/g, (_, __, letter: string) => ` ${letter.toUpperCase()}`).trim();
}
