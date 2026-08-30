// The palette's filtering, tested without a DOM — which is the reason it is a
// separate pure module. `specs/node-editor-addons-spec.md` §2.
import { describe, it, expect } from 'vitest';
import {
    describePorts,
    filterTypes,
    groupByCategory,
} from './node-editor-palette.utils';
import type { NodeTypeDefinition } from '../node-editor';

const READ: NodeTypeDefinition = {
    id: 'read-csv',
    label: 'Read CSV',
    category: 'Source',
    ports: [{ id: 'rows', direction: 'out', label: 'Rows', type: 'table' }],
};

const FILTER: NodeTypeDefinition = {
    id: 'filter',
    label: 'Filter',
    category: 'Transform',
    ports: [
        { id: 'in', direction: 'in', label: 'Rows', type: 'table' },
        { id: 'out', direction: 'out', label: 'Kept', type: 'table' },
    ],
};

const UPPER: NodeTypeDefinition = {
    id: 'uppercase',
    label: 'Uppercase',
    category: 'Transform',
    ports: [
        { id: 'in', direction: 'in', label: 'Text', type: 'text' },
        { id: 'out', direction: 'out', label: 'Text', type: 'text' },
    ],
};

/** No declared types at all — the "takes anything" case. */
const LOG: NodeTypeDefinition = {
    id: 'log',
    label: 'Log',
    ports: [{ id: 'in', direction: 'in', label: 'Anything' }],
};

const ALL = [READ, FILTER, UPPER, LOG];

describe('filterTypes — text', () => {
    it('returns everything for an empty query', () => {
        expect(filterTypes(ALL, {})).toHaveLength(4);
        expect(filterTypes(ALL, { text: '   ' })).toHaveLength(4);
    });

    it('matches the label, case-insensitively', () => {
        expect(filterTypes(ALL, { text: 'upper' }).map(t => t.id)).toEqual(['uppercase']);
    });

    it('matches the id, so a developer can search what they typed in code', () => {
        expect(filterTypes(ALL, { text: 'read-csv' }).map(t => t.id)).toEqual(['read-csv']);
    });

    it('matches the category', () => {
        expect(filterTypes(ALL, { text: 'transform' }).map(t => t.id))
            .toEqual(['filter', 'uppercase']);
    });

    /** "what deals with tables" is a real question someone asks a palette. */
    it('matches a port TYPE', () => {
        expect(filterTypes(ALL, { text: 'table' }).map(t => t.id))
            .toEqual(['read-csv', 'filter']);
    });

    it('matches a port label', () => {
        expect(filterTypes(ALL, { text: 'anything' }).map(t => t.id)).toEqual(['log']);
    });

    it('returns nothing when nothing matches', () => {
        expect(filterTypes(ALL, { text: 'zzz' })).toEqual([]);
    });
});

describe('filterTypes — by what a type can accept', () => {
    /**
     * The query that makes a palette useful in a typed graph: having dragged
     * from a `table` output, "what can take this" beats an alphabetical list.
     */
    it('offers only types with an input that would accept the value', () => {
        expect(filterTypes(ALL, { acceptsType: 'table' }).map(t => t.id))
            .toEqual(['filter', 'log']);
    });

    it('includes an UNTYPED input, because it accepts anything', () => {
        // Same rule canConnect applies, so the palette cannot offer something
        // the editor would then refuse.
        expect(filterTypes(ALL, { acceptsType: 'text' }).map(t => t.id))
            .toEqual(['uppercase', 'log']);
    });

    it('excludes a type with no inputs at all', () => {
        expect(filterTypes(ALL, { acceptsType: 'table' }).map(t => t.id))
            .not.toContain('read-csv');
    });

    it('filters by what a type produces', () => {
        expect(filterTypes(ALL, { producesType: 'text' }).map(t => t.id)).toEqual(['uppercase']);
    });

    it('combines text and type filters', () => {
        expect(filterTypes(ALL, { text: 'filter', acceptsType: 'table' }).map(t => t.id))
            .toEqual(['filter']);
        expect(filterTypes(ALL, { text: 'upper', acceptsType: 'table' })).toEqual([]);
    });
});

describe('groupByCategory', () => {
    it('groups by category', () => {
        const groups = groupByCategory(ALL, 'Other');
        expect(groups.map(g => g.category)).toEqual(['Source', 'Transform', 'Other']);
        expect(groups[1].types.map(t => t.id)).toEqual(['filter', 'uppercase']);
    });

    /**
     * First-seen, not alphabetical. The order a consumer registers their types
     * in is information — usually sources first, sinks last — and sorting it
     * away replaces their ordering with one that means nothing.
     */
    it('keeps categories in first-seen order', () => {
        const groups = groupByCategory([UPPER, READ], 'Other');
        expect(groups.map(g => g.category)).toEqual(['Transform', 'Source']);
    });

    it('puts uncategorised types under the fallback heading', () => {
        expect(groupByCategory([LOG], 'Other')[0].category).toBe('Other');
    });

    it('returns nothing for nothing', () => {
        expect(groupByCategory([], 'Other')).toEqual([]);
    });
});

describe('describePorts', () => {
    it('reads as in → out', () => {
        expect(describePorts(FILTER)).toBe('table → table');
    });

    it('shows an em dash for a missing side', () => {
        expect(describePorts(READ)).toBe('— → table');
    });

    it('falls back to the port LABEL when it has no type', () => {
        expect(describePorts(LOG)).toBe('Anything → —');
    });
});
