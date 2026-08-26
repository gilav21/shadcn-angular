/**
 * Choosing what to offer, as pure functions.
 *
 * Separated from the component so the interesting part — *which* node types
 * can go here — is testable without a DOM, and so the same logic could drive a
 * different picker.
 */
import type { NodePortDefinition, NodeTypeDefinition } from '../node-editor';

/** What the palette was asked for. */
export interface PaletteQuery {
  /** Free text, matched against label, id, category and port labels. */
  readonly text?: string;
  /**
   * Only offer types with an input port that would accept this value type.
   *
   * This is the query that makes a palette useful in a TYPED graph: dragging
   * from a `table` output and asking "what can take this" is a far better
   * question than scrolling an alphabetical list.
   */
  readonly acceptsType?: string;
  /** Only offer types with an output port producing this value type. */
  readonly producesType?: string;
}

export interface PaletteGroup {
  readonly category: string;
  readonly types: readonly NodeTypeDefinition[];
}

/** A port whose declared type is compatible with `type`. */
function portAccepts(port: NodePortDefinition, type: string): boolean {
  // An untyped port takes anything — the same rule `canConnect` applies, so
  // the palette cannot offer something the editor would then refuse.
  return port.type === undefined || port.type === type;
}

function matchesText(definition: NodeTypeDefinition, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (needle === '') return true;

  const haystack = [
    definition.label,
    definition.id,
    definition.category ?? '',
    ...definition.ports.map(port => port.label),
    ...definition.ports.map(port => port.type ?? ''),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

/** Node types matching a query, in the order they were registered. */
export function filterTypes(
  definitions: readonly NodeTypeDefinition[],
  query: PaletteQuery,
): readonly NodeTypeDefinition[] {
  return definitions.filter(definition => {
    if (query.text !== undefined && !matchesText(definition, query.text)) return false;

    if (query.acceptsType !== undefined) {
      const canTake = definition.ports.some(
        port => port.direction === 'in' && portAccepts(port, query.acceptsType as string),
      );
      if (!canTake) return false;
    }

    if (query.producesType !== undefined) {
      const canGive = definition.ports.some(
        port => port.direction === 'out' && portAccepts(port, query.producesType as string),
      );
      if (!canGive) return false;
    }
    return true;
  });
}

/**
 * Types grouped by category, categories in first-seen order.
 *
 * First-seen rather than alphabetical: the order a consumer registers their
 * types in is information — usually sources first, sinks last — and sorting it
 * away replaces their ordering with one that means nothing.
 */
export function groupByCategory(
  definitions: readonly NodeTypeDefinition[],
  fallback: string,
): readonly PaletteGroup[] {
  const groups = new Map<string, NodeTypeDefinition[]>();
  for (const definition of definitions) {
    const category = definition.category ?? fallback;
    const existing = groups.get(category);
    if (existing) existing.push(definition);
    else groups.set(category, [definition]);
  }
  return [...groups].map(([category, types]) => ({ category, types }));
}

/** A short "in → out" hint, so a type's shape is readable without opening it. */
export function describePorts(definition: NodeTypeDefinition): string {
  const inputs = definition.ports.filter(port => port.direction === 'in');
  const outputs = definition.ports.filter(port => port.direction === 'out');
  const side = (ports: readonly NodePortDefinition[]): string =>
    ports.length === 0 ? '—' : ports.map(port => port.type ?? port.label).join(', ');
  return `${side(inputs)} → ${side(outputs)}`;
}
