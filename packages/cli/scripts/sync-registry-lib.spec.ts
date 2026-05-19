import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
    resolveImport,
    resolveAsset,
    parseDecoratorUrls,
    buildDirOwners,
    classifyImport,
    getEntryFile,
    walkTree,
    type BoundaryContext,
} from './sync-registry-lib';

// ---------------------------------------------------------------------------
// Fixture component tree (built on disk so resolveImport/resolveAsset and the
// walkTree integration can be exercised against real files and directories).
// ---------------------------------------------------------------------------

let root: string;

function touch(relPath: string, content = ''): void {
    const full = path.join(root, relPath);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
}

beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), 'sync-registry-lib-'));
    touch('ui/badge.component.ts');
    touch('ui/button/index.ts', "export * from './button.component';");
    touch('ui/button/button.component.ts', 'export class ButtonComponent {}');
    touch('ui/accordion/index.ts', "export * from './accordion.component';");
    touch(
        'ui/accordion/accordion.component.ts',
        [
            "import { AccordionItemComponent } from './sub/accordion-item.component';",
            '@Component({',
            "  templateUrl: './accordion.component.html',",
            "  styleUrl: './accordion.component.css',",
            '})',
            'export class AccordionComponent {}',
        ].join('\n'),
    );
    touch('ui/accordion/accordion.component.html', '<div></div>');
    touch('ui/accordion/accordion.component.css', '.x{}');
    touch(
        'ui/accordion/sub/accordion-item.component.ts',
        "import { ButtonComponent } from '../../button';\nexport class AccordionItemComponent {}",
    );
    // A deep import: gadget reaches into accordion's folder, not its barrel.
    touch(
        'ui/gadget.component.ts',
        "import { AccordionComponent } from './accordion/accordion.component';",
    );
    touch('ui/dual.ts');
    touch('ui/dual/index.ts');
    touch('lib/utils.ts');
    mkdirSync(path.join(root, 'ui/emptydir'), { recursive: true });
});

afterAll(() => {
    rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// resolveImport
// ---------------------------------------------------------------------------

describe('resolveImport', () => {
    it('resolves a sibling import to its .ts file', () => {
        expect(
            resolveImport('../badge.component', 'ui/accordion/accordion.component.ts', root),
        ).toBe('ui/badge.component.ts');
    });

    it('resolves a directory import to the directory barrel index.ts', () => {
        expect(
            resolveImport('../button', 'ui/accordion/accordion.component.ts', root),
        ).toBe('ui/button/index.ts');
    });

    it('returns null for a directory with no barrel index.ts', () => {
        expect(
            resolveImport('../emptydir', 'ui/accordion/accordion.component.ts', root),
        ).toBeNull();
    });

    it('prefers a .ts file over a same-named directory', () => {
        expect(resolveImport('./dual', 'ui/badge.component.ts', root)).toBe('ui/dual.ts');
    });

    it('resolves an import that climbs into the lib directory', () => {
        expect(
            resolveImport('../../lib/utils', 'ui/accordion/accordion.component.ts', root),
        ).toBe('lib/utils.ts');
    });

    it('returns null for an unresolvable specifier', () => {
        expect(
            resolveImport('./does-not-exist', 'ui/accordion/accordion.component.ts', root),
        ).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// resolveAsset
// ---------------------------------------------------------------------------

describe('resolveAsset', () => {
    it('resolves a templateUrl-style .html reference', () => {
        expect(
            resolveAsset('./accordion.component.html', 'ui/accordion/accordion.component.ts', root),
        ).toBe('ui/accordion/accordion.component.html');
    });

    it('resolves a styleUrl-style .css reference', () => {
        expect(
            resolveAsset('./accordion.component.css', 'ui/accordion/accordion.component.ts', root),
        ).toBe('ui/accordion/accordion.component.css');
    });

    it('returns null when the asset does not exist', () => {
        expect(
            resolveAsset('./missing.component.html', 'ui/accordion/accordion.component.ts', root),
        ).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// parseDecoratorUrls
// ---------------------------------------------------------------------------

describe('parseDecoratorUrls', () => {
    it('extracts a templateUrl reference', () => {
        expect(parseDecoratorUrls(`templateUrl: './foo.component.html',`)).toEqual([
            './foo.component.html',
        ]);
    });

    it('extracts templateUrl and styleUrl together', () => {
        const src = `
            templateUrl: './foo.component.html',
            styleUrl: './foo.component.css',
        `;
        expect(parseDecoratorUrls(src)).toEqual([
            './foo.component.html',
            './foo.component.css',
        ]);
    });

    it('extracts every entry from a styleUrls array', () => {
        const src = `styleUrls: ['./a.css', './b.css']`;
        expect(parseDecoratorUrls(src)).toEqual(['./a.css', './b.css']);
    });

    it('does not double-count styleUrls as a styleUrl', () => {
        const src = `styleUrls: ['./only.css']`;
        expect(parseDecoratorUrls(src)).toEqual(['./only.css']);
    });

    it('returns an empty array when no asset URLs are present', () => {
        expect(parseDecoratorUrls(`template: '<div></div>',`)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// buildDirOwners
// ---------------------------------------------------------------------------

describe('buildDirOwners', () => {
    it('groups entry files by their directory', () => {
        const entries = new Map<string, string>([
            ['ui/button.component.ts', 'button'],
            ['ui/badge.component.ts', 'badge'],
            ['ui/data-table/data-table.component.ts', 'data-table'],
            ['ui/charts/pie-chart.component.ts', 'pie-chart'],
            ['ui/charts/bar-chart.component.ts', 'bar-chart'],
        ]);
        const owners = buildDirOwners(entries);

        expect([...(owners.get('ui') ?? [])].sort()).toEqual(['badge', 'button']);
        expect([...(owners.get('ui/data-table') ?? [])]).toEqual(['data-table']);
        expect([...(owners.get('ui/charts') ?? [])].sort()).toEqual(['bar-chart', 'pie-chart']);
    });
});

// ---------------------------------------------------------------------------
// classifyImport
// ---------------------------------------------------------------------------

describe('classifyImport', () => {
    const entryFileToComponent = new Map<string, string>([
        ['ui/accordion/index.ts', 'accordion'],
        ['ui/button/index.ts', 'button'],
        ['ui/data-table/data-table.component.ts', 'data-table'],
    ]);
    const ctx: BoundaryContext = {
        entryFileToComponent,
        dirOwners: buildDirOwners(entryFileToComponent),
    };

    it('classifies another component entry file as a dependency', () => {
        expect(classifyImport('ui/button/index.ts', 'accordion', ctx)).toEqual({
            kind: 'dependency',
            owner: 'button',
        });
    });

    it('classifies the current component own entry as own', () => {
        expect(classifyImport('ui/accordion/index.ts', 'accordion', ctx)).toEqual({
            kind: 'own',
        });
    });

    it('classifies an internal file of another component as a deep-import', () => {
        expect(classifyImport('ui/data-table/data-table.utils.ts', 'accordion', ctx)).toEqual({
            kind: 'deep-import',
            owner: 'data-table',
        });
    });

    it('classifies a file inside the current component folder as own', () => {
        expect(
            classifyImport('ui/accordion/sub/accordion-item.component.ts', 'accordion', ctx),
        ).toEqual({ kind: 'own' });
    });

    it('classifies a file in a directory with no single owner as own', () => {
        expect(classifyImport('lib/utils.ts', 'accordion', ctx)).toEqual({ kind: 'own' });
    });
});

// ---------------------------------------------------------------------------
// walkTree — end-to-end over the fixture tree
// ---------------------------------------------------------------------------

describe('walkTree', () => {
    function context(): BoundaryContext {
        const entryFileToComponent = new Map<string, string>([
            ['ui/accordion/index.ts', 'accordion'],
            ['ui/button/index.ts', 'button'],
            ['ui/gadget.component.ts', 'gadget'],
        ]);
        return { entryFileToComponent, dirOwners: buildDirOwners(entryFileToComponent) };
    }

    it('discovers templateUrl/styleUrl assets as own leaf files', () => {
        const { ownFiles } = walkTree('ui/accordion/index.ts', 'accordion', context(), root);
        expect(ownFiles.has('ui/accordion/accordion.component.html')).toBe(true);
        expect(ownFiles.has('ui/accordion/accordion.component.css')).toBe(true);
    });

    it('collects the barrel, entry file and sub-component into own files', () => {
        const { ownFiles } = walkTree('ui/accordion/index.ts', 'accordion', context(), root);
        expect(ownFiles.has('ui/accordion/index.ts')).toBe(true);
        expect(ownFiles.has('ui/accordion/accordion.component.ts')).toBe(true);
        expect(ownFiles.has('ui/accordion/sub/accordion-item.component.ts')).toBe(true);
    });

    it('stops at another component barrel and records it as a dependency', () => {
        const { discoveredDeps, ownFiles } =
            walkTree('ui/accordion/index.ts', 'accordion', context(), root);
        expect([...discoveredDeps]).toEqual(['button']);
        expect(ownFiles.has('ui/button/index.ts')).toBe(false);
    });

    it('reports no deep imports for a barrel-respecting component', () => {
        const { deepImports } = walkTree('ui/accordion/index.ts', 'accordion', context(), root);
        expect(deepImports).toEqual([]);
    });

    it('records a deep import that reaches into another component folder', () => {
        const { deepImports } = walkTree('ui/gadget.component.ts', 'gadget', context(), root);
        expect(deepImports).toHaveLength(1);
        expect(deepImports[0]).toEqual({
            fromFile: 'ui/gadget.component.ts',
            importedFile: 'ui/accordion/accordion.component.ts',
            owner: 'accordion',
        });
    });
});

// ---------------------------------------------------------------------------
// getEntryFile
// ---------------------------------------------------------------------------

describe('getEntryFile', () => {
    it('prefers the component own barrel index.ts', () => {
        expect(
            getEntryFile('accordion', ['accordion/accordion.component.ts', 'accordion/index.ts']),
        ).toBe('accordion/index.ts');
    });

    it('never treats a foreign component barrel as the entry file', () => {
        // Regression: a files[] polluted mid-migration with another
        // component's index.ts must not hijack the entry-file derivation.
        expect(
            getEntryFile('shortcut-bindings-dialog', [
                'accordion/index.ts',
                'shortcut-bindings-dialog.component.ts',
            ]),
        ).toBe('shortcut-bindings-dialog.component.ts');
    });

    it('falls back to the <name>.component.ts convention', () => {
        expect(getEntryFile('badge', ['badge.component.ts'])).toBe('badge.component.ts');
    });

    it('falls back to the <name>.directive.ts convention', () => {
        expect(getEntryFile('ripple', ['ripple.directive.ts'])).toBe('ripple.directive.ts');
    });

    it('falls back to the first file when no convention matches', () => {
        expect(getEntryFile('mystery', ['some-helper.ts'])).toBe('some-helper.ts');
    });
});
