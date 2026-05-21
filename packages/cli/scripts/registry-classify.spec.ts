import { describe, it, expect } from 'vitest';
import {
    registryHasComponent,
    registryReferencesFile,
    pathHasSubSegment,
    buildDirOwnerMap,
    isInSingleOwnerDirectory,
    classifyComponentFile,
} from '../../../.claude/hooks/registry-classify.mjs';

// A miniature registry exercising every layout the classifier must handle:
// flat components, a folderized component with a `sub/` directory, and a
// multi-owner `charts/` directory.
const FIXTURE_REGISTRY = `
export const registry = defineRegistry({
  button: {
    name: 'button',
    files: ['button.component.ts'],
  },
  badge: {
    name: 'badge',
    files: ['badge.component.ts'],
  },
  accordion: {
    name: 'accordion',
    files: [
      'accordion/index.ts',
      'accordion/accordion.component.ts',
      'accordion/accordion.component.html',
      'accordion/sub/accordion-item.component.ts',
    ],
  },
  'pie-chart': {
    name: 'pie-chart',
    files: ['charts/pie-chart.component.ts'],
  },
  'bar-chart': {
    name: 'bar-chart',
    files: ['charts/bar-chart.component.ts'],
  },
});
`;

describe('registryHasComponent', () => {
    it('matches an unquoted component key', () => {
        expect(registryHasComponent(FIXTURE_REGISTRY, 'button')).toBe(true);
    });

    it('matches a quoted component key', () => {
        expect(registryHasComponent(FIXTURE_REGISTRY, 'pie-chart')).toBe(true);
    });

    it('returns false for an unknown component', () => {
        expect(registryHasComponent(FIXTURE_REGISTRY, 'carousel')).toBe(false);
    });
});

describe('registryReferencesFile', () => {
    it('detects a flat file already listed', () => {
        expect(registryReferencesFile(FIXTURE_REGISTRY, 'button.component.ts')).toBe(true);
    });

    it('detects a folder-prefixed .html file already listed', () => {
        expect(
            registryReferencesFile(FIXTURE_REGISTRY, 'accordion/accordion.component.html'),
        ).toBe(true);
    });

    it('returns false for a file the registry does not list', () => {
        expect(registryReferencesFile(FIXTURE_REGISTRY, 'accordion/missing.ts')).toBe(false);
    });
});

describe('pathHasSubSegment', () => {
    it('is true when a path segment is exactly "sub"', () => {
        expect(pathHasSubSegment('accordion/sub/accordion-item.component.ts')).toBe(true);
    });

    it('is false when "sub" only appears as a substring of a segment', () => {
        expect(pathHasSubSegment('subway.component.ts')).toBe(false);
        expect(pathHasSubSegment('data-table/data-table-subtotal.component.ts')).toBe(false);
    });

    it('is false for a plain nested path', () => {
        expect(pathHasSubSegment('charts/pie-chart.component.ts')).toBe(false);
    });
});

describe('buildDirOwnerMap', () => {
    const map = buildDirOwnerMap(FIXTURE_REGISTRY);

    it('groups flat files under the "." root with every flat component', () => {
        expect([...(map.get('.') ?? [])].sort()).toEqual(['badge', 'button']);
    });

    it('maps a component folder to its single owner', () => {
        expect([...(map.get('accordion') ?? [])]).toEqual(['accordion']);
    });

    it('maps a sub/ directory to its owning component', () => {
        expect([...(map.get('accordion/sub') ?? [])]).toEqual(['accordion']);
    });

    it('maps a shared directory to all of its owners', () => {
        expect([...(map.get('charts') ?? [])].sort()).toEqual(['bar-chart', 'pie-chart']);
    });
});

describe('isInSingleOwnerDirectory', () => {
    const map = buildDirOwnerMap(FIXTURE_REGISTRY);

    it('is true for a file in a folder owned by one component', () => {
        expect(isInSingleOwnerDirectory('accordion/accordion-extra.component.ts', map)).toBe(true);
    });

    it('is false for a file in a multi-owner directory', () => {
        expect(isInSingleOwnerDirectory('charts/new-chart.component.ts', map)).toBe(false);
    });

    it('is false for a file in the ui/ root, even with one flat component', () => {
        const singleFlat = buildDirOwnerMap(
            `defineRegistry({ button: { name: 'button', files: ['button.component.ts'] } });`,
        );
        expect(isInSingleOwnerDirectory('brand-new.component.ts', singleFlat)).toBe(false);
    });
});

describe('classifyComponentFile', () => {
    it('classifies an already-referenced file as "referenced"', () => {
        expect(classifyComponentFile('button.component.ts', FIXTURE_REGISTRY)).toBe('referenced');
        expect(
            classifyComponentFile('accordion/accordion.component.ts', FIXTURE_REGISTRY),
        ).toBe('referenced');
    });

    it('classifies an unlisted file under sub/ as "sub-directory"', () => {
        expect(
            classifyComponentFile('accordion/sub/accordion-trigger.component.ts', FIXTURE_REGISTRY),
        ).toBe('sub-directory');
    });

    it('classifies an unlisted file in a single-owner folder as "single-owner"', () => {
        expect(
            classifyComponentFile('accordion/accordion-extra.component.ts', FIXTURE_REGISTRY),
        ).toBe('single-owner');
    });

    it('classifies a file in a multi-owner directory as "new-component"', () => {
        expect(
            classifyComponentFile('charts/new-chart.component.ts', FIXTURE_REGISTRY),
        ).toBe('new-component');
    });

    it('classifies a brand-new flat file as "new-component"', () => {
        expect(classifyComponentFile('brand-new-widget.component.ts', FIXTURE_REGISTRY)).toBe(
            'new-component',
        );
    });
});
