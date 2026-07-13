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
    walkBlockTree,
    analyzeAllEntries,
    analyzeBlock,
    analyzeComponent,
    applyUpdatesToSource,
    BASELINE_LIB_FILES,
    buildBoundaryMap,
    detectOrphanBlockFolders,
    diffEntry,
    formatAddonViolationReport,
    formatDeepImportReport,
    formatDriftLines,
    hasDrift,
    mergeLibFiles,
    parseRegistrySource,
    removeDependencies,
    replaceFilesArray,
    serializeRegistryJson,
    splitFiles,
    updateDependencies,
    updateLibFiles,
    validateBlockFiles,
    validateRegistryFiles,
    type BoundaryContext,
    type ComponentUpdate,
    type RegistryEntry,
    type SyncRoots,
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

    // Addon fixture: a base component (data-table) with an addons/ subtree.
    // The base's component file reaches into the addon (a one-directional
    // boundary violation), while the addon correctly depends on its parent
    // through the barrel.
    touch(
        'ui/data-table/index.ts',
        "export * from './data-table.component';\nexport * from './data-table.host';",
    );
    touch(
        'ui/data-table/data-table.component.ts',
        "import { DataTableExport } from './addons/export';\nexport class DataTableComponent {}",
    );
    touch('ui/data-table/data-table.host.ts', 'export abstract class DataTableAddonHost {}');
    touch('ui/data-table/addons/export/index.ts', "export * from './export.directive';");
    touch(
        'ui/data-table/addons/export/export.directive.ts',
        "import { DataTableAddonHost } from '../..';\nexport class DataTableExport {}",
    );

    // A base whose barrel index.ts DIRECTLY re-exports an addon — the
    // barrel-re-export form of the boundary violation.
    touch(
        'ui/widget/index.ts',
        "export * from './widget.component';\nexport * from './addons/foo';",
    );
    touch('ui/widget/widget.component.ts', 'export class WidgetComponent {}');
    touch('ui/widget/addons/foo/index.ts', "export * from './foo.directive';");
    touch('ui/widget/addons/foo/foo.directive.ts', 'export class WidgetFoo {}');

    // A consumer/compound component that USES an addon (imports its barrel).
    touch('ui/panel/index.ts', "export * from './panel.component';");
    touch(
        'ui/panel/panel.component.ts',
        "import { DataTableExport } from '../data-table/addons/export';\nexport class PanelComponent {}",
    );
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

        expect([...(owners.get('ui') ?? [])].sort((a, b) => a.localeCompare(b))).toEqual(['badge', 'button']);
        expect([...(owners.get('ui/data-table') ?? [])]).toEqual(['data-table']);
        expect([...(owners.get('ui/charts') ?? [])].sort((a, b) => a.localeCompare(b))).toEqual(['bar-chart', 'pie-chart']);
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

describe('classifyImport — addons', () => {
    const entryFileToComponent = new Map<string, string>([
        ['ui/data-table/index.ts', 'data-table'],
        ['ui/data-table/addons/export/index.ts', 'data-table/export'],
    ]);
    const ctx: BoundaryContext = {
        entryFileToComponent,
        dirOwners: buildDirOwners(entryFileToComponent),
    };

    it('flags a base reaching into its own addon barrel as an addon-boundary', () => {
        expect(
            classifyImport('ui/data-table/addons/export/index.ts', 'data-table', ctx),
        ).toEqual({ kind: 'addon-boundary', owner: 'data-table/export' });
    });

    it('flags a base reaching into a deep addon file as an addon-boundary', () => {
        expect(
            classifyImport('ui/data-table/addons/export/export.directive.ts', 'data-table', ctx),
        ).toEqual({ kind: 'addon-boundary', owner: 'data-table/export' });
    });

    it('classifies an addon importing its parent barrel as a dependency', () => {
        expect(classifyImport('ui/data-table/index.ts', 'data-table/export', ctx)).toEqual({
            kind: 'dependency',
            owner: 'data-table',
        });
    });

    it('classifies an addon own file as own', () => {
        expect(
            classifyImport(
                'ui/data-table/addons/export/export.directive.ts',
                'data-table/export',
                ctx,
            ),
        ).toEqual({ kind: 'own' });
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

describe('walkTree — addons', () => {
    function context(): BoundaryContext {
        const entryFileToComponent = new Map<string, string>([
            ['ui/data-table/index.ts', 'data-table'],
            ['ui/data-table/addons/export/index.ts', 'data-table/export'],
        ]);
        return { entryFileToComponent, dirOwners: buildDirOwners(entryFileToComponent) };
    }

    it('records an addon-boundary violation when a base reaches into its addons/', () => {
        const { addonViolations, ownFiles } = walkTree(
            'ui/data-table/index.ts',
            'data-table',
            context(),
            root,
        );
        expect(addonViolations).toHaveLength(1);
        expect(addonViolations[0]).toEqual({
            fromFile: 'ui/data-table/data-table.component.ts',
            importedFile: 'ui/data-table/addons/export/index.ts',
            addon: 'data-table/export',
        });
        // The base must NOT absorb the addon's files.
        expect(ownFiles.has('ui/data-table/addons/export/index.ts')).toBe(false);
        expect(ownFiles.has('ui/data-table/addons/export/export.directive.ts')).toBe(false);
    });

    it('flags a base barrel that directly re-exports an addon', () => {
        const entryFileToComponent = new Map<string, string>([
            ['ui/widget/index.ts', 'widget'],
            ['ui/widget/addons/foo/index.ts', 'widget/foo'],
        ]);
        const ctx: BoundaryContext = {
            entryFileToComponent,
            dirOwners: buildDirOwners(entryFileToComponent),
        };
        const { addonViolations, ownFiles } = walkTree('ui/widget/index.ts', 'widget', ctx, root);
        expect(addonViolations).toHaveLength(1);
        expect(addonViolations[0]).toEqual({
            fromFile: 'ui/widget/index.ts',
            importedFile: 'ui/widget/addons/foo/index.ts',
            addon: 'widget/foo',
        });
        expect(ownFiles.has('ui/widget/addons/foo/index.ts')).toBe(false);
        expect(ownFiles.has('ui/widget/widget.component.ts')).toBe(true);
    });

    it('records a component that USES an addon (imports its barrel) as depending on it', () => {
        const entryFileToComponent = new Map<string, string>([
            ['ui/panel/index.ts', 'panel'],
            ['ui/data-table/index.ts', 'data-table'],
            ['ui/data-table/addons/export/index.ts', 'data-table/export'],
        ]);
        const ctx: BoundaryContext = {
            entryFileToComponent,
            dirOwners: buildDirOwners(entryFileToComponent),
        };
        const { discoveredDeps, addonViolations } = walkTree('ui/panel/index.ts', 'panel', ctx, root);
        expect([...discoveredDeps]).toContain('data-table/export');
        expect(addonViolations).toEqual([]); // a third-party consumer is NOT a boundary violation
    });

    it('walks an addon and records its parent as a dependency, not own', () => {
        const { ownFiles, discoveredDeps, addonViolations } = walkTree(
            'ui/data-table/addons/export/index.ts',
            'data-table/export',
            context(),
            root,
        );
        expect(ownFiles.has('ui/data-table/addons/export/index.ts')).toBe(true);
        expect(ownFiles.has('ui/data-table/addons/export/export.directive.ts')).toBe(true);
        expect([...discoveredDeps]).toEqual(['data-table']);
        expect(ownFiles.has('ui/data-table/index.ts')).toBe(false);
        expect(addonViolations).toEqual([]);
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

    it('resolves an addon name to its addons/<addon>/index.ts barrel', () => {
        expect(
            getEntryFile('data-table/export', [
                'data-table/addons/export/export.directive.ts',
                'data-table/addons/export/index.ts',
            ]),
        ).toBe('data-table/addons/export/index.ts');
    });
});

// ---------------------------------------------------------------------------
// walkBlockTree — a block lives under blocksRoot and imports across into
// componentsRoot. Build a base/{components,blocks} layout so the real
// ../../components/ui/* specifiers resolve.
// ---------------------------------------------------------------------------

describe('walkBlockTree', () => {
    let base: string;
    let blocksRoot: string;
    let componentsRoot: string;
    let ctx: BoundaryContext;

    function write(rel: string, content = ''): void {
        const full = path.join(base, rel);
        mkdirSync(path.dirname(full), { recursive: true });
        writeFileSync(full, content);
    }

    beforeAll(() => {
        base = mkdtempSync(path.join(tmpdir(), 'block-walk-'));
        blocksRoot = path.join(base, 'blocks');
        componentsRoot = path.join(base, 'components');

        write('components/ui/button/index.ts', "export * from './button.component';");
        write('components/ui/button/button.component.ts', 'export class ButtonComponent {}');
        write('components/ui/input/index.ts', "export * from './input.component';");
        write('components/ui/input/input.component.ts', 'export class InputComponent {}');
        write('components/ui/card/index.ts', "export * from './card.component';");
        write('components/ui/card/card.component.ts', 'export class CardComponent {}');
        write('components/lib/utils.ts', 'export function cn() {}');

        write('blocks/login/index.ts', "export * from './login.component';");
        write(
            'blocks/login/login.component.ts',
            [
                "import { ButtonComponent } from '../../components/ui/button';",
                "import { InputComponent } from '../../components/ui/input';",
                "import { cn } from '../../components/lib/utils';",
                '@Component({',
                "  templateUrl: './login.component.html',",
                '})',
                'export class LoginBlockComponent {}',
            ].join('\n'),
        );
        write('blocks/login/login.component.html', '<form></form>');

        // Deep import: a block reaching into card's folder, bypassing its barrel.
        write(
            'blocks/deep/index.ts',
            "import { CardComponent } from '../../components/ui/card/card.component';\nexport class DeepBlockComponent {}",
        );

        const entryFileToComponent = new Map<string, string>([
            ['ui/button/index.ts', 'button'],
            ['ui/input/index.ts', 'input'],
            ['ui/card/index.ts', 'card'],
        ]);
        ctx = { entryFileToComponent, dirOwners: buildDirOwners(entryFileToComponent) };
    });

    afterAll(() => {
        rmSync(base, { recursive: true, force: true });
    });

    it('collects the block own files (entry, component, templateUrl asset)', () => {
        const result = walkBlockTree('login/index.ts', blocksRoot, componentsRoot, ctx);
        expect([...result.ownFiles].sort((a, b) => a.localeCompare(b))).toEqual([
            'login/index.ts',
            'login/login.component.html',
            'login/login.component.ts',
        ]);
    });

    it('records imported ui components as dependencies and does not recurse into them', () => {
        const result = walkBlockTree('login/index.ts', blocksRoot, componentsRoot, ctx);
        expect([...result.dependencies].sort((a, b) => a.localeCompare(b))).toEqual(['button', 'input']);
        // button.component.ts must NOT be pulled into the block's own files.
        expect([...result.ownFiles].some(f => f.includes('button'))).toBe(false);
    });

    it('records a direct lib import as a libFile (unfiltered — baseline filtering is the caller’s job)', () => {
        const result = walkBlockTree('login/index.ts', blocksRoot, componentsRoot, ctx);
        expect([...result.libFiles]).toEqual(['utils.ts']);
    });

    it('flags a deep import that bypasses a component barrel', () => {
        const result = walkBlockTree('deep/index.ts', blocksRoot, componentsRoot, ctx);
        expect(result.dependencies.has('card')).toBe(true);
        expect(result.deepImports).toHaveLength(1);
        expect(result.deepImports[0].owner).toBe('card');
    });
});

// ===========================================================================
// Registry sync core — the logic that used to live (untested, and invisible to
// coverage) inside sync-registry.ts. A component/block fixture pair is built on
// disk so analyze/validate run against real files, exactly as the gate does.
// ===========================================================================

let syncBase: string;
let syncRoots: SyncRoots;

function syncWrite(rel: string, content = ''): void {
    const full = path.join(syncBase, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
}

function entry(overrides: Partial<RegistryEntry> & { name: string }): RegistryEntry {
    return {
        files: [],
        libFiles: [],
        dependencies: [],
        isBlock: false,
        ...overrides,
    };
}

/** Registry entry for `button` as the fixture's disk state actually derives it. */
function buttonEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
    return entry({
        name: 'button',
        files: ['button/button.component.ts', 'button/index.ts'],
        libFiles: ['format.ts'],
        ...overrides,
    });
}

/** Registry entry for `card` as the fixture's disk state actually derives it. */
function cardEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
    return entry({
        name: 'card',
        files: ['card/card.component.html', 'card/card.component.ts', 'card/index.ts'],
        dependencies: ['button'],
        ...overrides,
    });
}

/** Registry entry for the `login` block as the fixture's disk state derives it. */
function loginBlockEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
    return entry({
        name: 'login',
        isBlock: true,
        files: ['login/index.ts', 'login/login.component.ts'],
        libFiles: ['format.ts'],
        dependencies: ['button'],
        ...overrides,
    });
}

function syncCtx(entries: readonly RegistryEntry[]): BoundaryContext {
    const entryFileToComponent = buildBoundaryMap(entries);
    return { entryFileToComponent, dirOwners: buildDirOwners(entryFileToComponent) };
}

beforeAll(() => {
    syncBase = mkdtempSync(path.join(tmpdir(), 'sync-core-'));
    syncRoots = {
        componentsRoot: path.join(syncBase, 'components'),
        blocksRoot: path.join(syncBase, 'blocks'),
    };

    syncWrite('components/lib/utils.ts', 'export function cn() {}');
    syncWrite('components/lib/format.ts', 'export function fmt() {}');

    // button — pulls in one baseline lib file (utils, dropped) and one real one.
    syncWrite('components/ui/button/index.ts', "export * from './button.component';");
    syncWrite(
        'components/ui/button/button.component.ts',
        [
            "import { cn } from '../../lib/utils';",
            "import { fmt } from '../../lib/format';",
            'export class ButtonComponent {}',
        ].join('\n'),
    );

    // card — depends on button through its barrel, and has a templateUrl asset.
    syncWrite('components/ui/card/index.ts', "export * from './card.component';");
    syncWrite(
        'components/ui/card/card.component.ts',
        [
            "import { ButtonComponent } from '../button';",
            '@Component({',
            "  templateUrl: './card.component.html',",
            '})',
            'export class CardComponent {}',
        ].join('\n'),
    );
    syncWrite('components/ui/card/card.component.html', '<div></div>');

    // base — reaches into its own addons/ subtree: a hard boundary violation.
    syncWrite('components/ui/base/index.ts', "export * from './base.component';");
    syncWrite(
        'components/ui/base/base.component.ts',
        "import { BaseExtra } from './addons/extra';\nexport class BaseComponent {}",
    );
    syncWrite('components/ui/base/addons/extra/index.ts', 'export class BaseExtra {}');

    // login block — imports a ui component and a lib file across the roots.
    syncWrite('blocks/login/index.ts', "export * from './login.component';");
    syncWrite(
        'blocks/login/login.component.ts',
        [
            "import { ButtonComponent } from '../../components/ui/button';",
            "import { fmt } from '../../components/lib/format';",
            "import { cn } from '../../components/lib/utils';",
            'export class LoginComponent {}',
        ].join('\n'),
    );

    // A block folder on disk that no registry entry claims.
    mkdirSync(path.join(syncBase, 'blocks/orphan'), { recursive: true });
});

afterAll(() => {
    rmSync(syncBase, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// splitFiles
// ---------------------------------------------------------------------------

describe('splitFiles', () => {
    it('splits ui/ and lib/ files, stripping the prefixes', () => {
        expect(splitFiles(['ui/button/index.ts', 'lib/format.ts'])).toEqual({
            uiFiles: ['button/index.ts'],
            libFiles: ['format.ts'],
        });
    });

    it('drops the baseline lib files that init always installs', () => {
        expect(BASELINE_LIB_FILES.has('utils.ts')).toBe(true);
        expect(splitFiles(['lib/utils.ts', 'lib/format.ts']).libFiles).toEqual(['format.ts']);
    });

    it('sorts each half', () => {
        const { uiFiles, libFiles } = splitFiles([
            'ui/z/index.ts',
            'ui/a/index.ts',
            'lib/z.ts',
            'lib/a.ts',
        ]);
        expect(uiFiles).toEqual(['a/index.ts', 'z/index.ts']);
        expect(libFiles).toEqual(['a.ts', 'z.ts']);
    });

    it('discards files under neither prefix — the registry does not own them', () => {
        expect(splitFiles(['blocks/login/index.ts', 'ui/a.ts'])).toEqual({
            uiFiles: ['a.ts'],
            libFiles: [],
        });
    });
});

// ---------------------------------------------------------------------------
// buildBoundaryMap
// ---------------------------------------------------------------------------

describe('buildBoundaryMap', () => {
    it('maps each entry ui/-relative entry file to its component name', () => {
        const map = buildBoundaryMap([buttonEntry(), cardEntry()]);
        expect(map.get('ui/button/index.ts')).toBe('button');
        expect(map.get('ui/card/index.ts')).toBe('card');
    });

    it('keys an addon entry by its addons/<addon>/index.ts barrel', () => {
        const map = buildBoundaryMap([
            entry({
                name: 'data-table/export',
                files: ['data-table/addons/export/index.ts', 'data-table/addons/export/x.ts'],
            }),
        ]);
        expect(map.get('ui/data-table/addons/export/index.ts')).toBe('data-table/export');
    });
});

// ---------------------------------------------------------------------------
// mergeLibFiles / diffEntry / hasDrift — the drift semantics
// ---------------------------------------------------------------------------

describe('mergeLibFiles', () => {
    it('unions declared and discovered, deduped and sorted', () => {
        expect(mergeLibFiles(['b.ts'], ['a.ts', 'b.ts'])).toEqual(['a.ts', 'b.ts']);
    });

    it('KEEPS a declared libFile the walk no longer discovers (merge, never replace)', () => {
        // This is the known subtlety: the sync merges libFiles rather than
        // replacing them, so a libFile that has fallen out of the import tree
        // is never auto-pruned. It survives --fix untouched.
        expect(mergeLibFiles(['stale.ts'], ['format.ts'])).toEqual(['format.ts', 'stale.ts']);
    });
});

describe('diffEntry', () => {
    const declared = entry({
        name: 'x',
        files: ['x/old.ts', 'x/index.ts'],
        libFiles: ['keep.ts'],
        dependencies: ['gone'],
    });

    it('reports added and removed files', () => {
        const diff = diffEntry(declared, ['x/index.ts', 'x/new.ts'], ['keep.ts'], ['gone']);
        expect(diff.addedFiles).toEqual(['x/new.ts']);
        expect(diff.removedFiles).toEqual(['x/old.ts']);
    });

    it('reports added and removed dependencies', () => {
        const diff = diffEntry(declared, declared.files, ['keep.ts'], ['fresh']);
        expect(diff.addedDeps).toEqual(['fresh']);
        expect(diff.removedDeps).toEqual(['gone']);
    });

    it('reports a newly discovered libFile as added', () => {
        const diff = diffEntry(declared, declared.files, ['keep.ts', 'extra.ts'], ['gone']);
        expect(diff.addedLibs).toEqual(['extra.ts']);
    });

    it('does NOT report a declared-but-undiscovered libFile — there is no removedLibs', () => {
        // The counterpart of the merge semantics above: a stale libFile is
        // invisible to drift detection, so `sync-registry` reports the tree as
        // "in sync" while the registry still ships the dead entry. Only
        // validateRegistryFiles catches it, and only once the file leaves disk.
        const diff = diffEntry(declared, declared.files, [], ['gone']);
        expect(diff.addedLibs).toEqual([]);
        expect(hasDrift(diff)).toBe(false);
    });
});

describe('hasDrift', () => {
    const clean = { addedFiles: [], removedFiles: [], addedLibs: [], addedDeps: [], removedDeps: [] };

    it('is false for an empty diff', () => {
        expect(hasDrift(clean)).toBe(false);
    });

    it.each([
        ['addedFiles'],
        ['removedFiles'],
        ['addedLibs'],
        ['addedDeps'],
        ['removedDeps'],
    ] as const)('is true when %s is non-empty', key => {
        expect(hasDrift({ ...clean, [key]: ['x'] })).toBe(true);
    });
});

describe('formatDriftLines', () => {
    it('renders every drift kind under the component name', () => {
        expect(
            formatDriftLines('button', {
                addedFiles: ['a.ts'],
                removedFiles: ['b.ts'],
                addedLibs: ['c.ts'],
                addedDeps: ['d'],
                removedDeps: ['e'],
            }),
        ).toEqual([
            '  button:',
            '    + files: a.ts',
            '    - files: b.ts',
            '    + libFiles: c.ts',
            '    + dependencies: d',
            '    - dependencies: e',
        ]);
    });

    it('tags a block with the (block) suffix', () => {
        const lines = formatDriftLines(
            'login',
            { addedFiles: ['x.ts'], removedFiles: [], addedLibs: [], addedDeps: [], removedDeps: [] },
            true,
        );
        expect(lines[0]).toBe('  login (block):');
    });
});

// ---------------------------------------------------------------------------
// analyzeComponent — derivation against the real fixture tree
// ---------------------------------------------------------------------------

describe('analyzeComponent', () => {
    it('reports no drift for an entry that matches disk', () => {
        const entries = [buttonEntry(), cardEntry()];
        const result = analyzeComponent(cardEntry(), syncCtx(entries), syncRoots);
        expect(hasDrift(result.diff)).toBe(false);
        expect(result.update.files).toEqual([
            'card/card.component.html',
            'card/card.component.ts',
            'card/index.ts',
        ]);
    });

    it('derives the templateUrl asset and the cross-component dependency', () => {
        const result = analyzeComponent(cardEntry(), syncCtx([buttonEntry(), cardEntry()]), syncRoots);
        expect(result.update.files).toContain('card/card.component.html');
        expect(result.update.dependencies).toEqual(['button']);
    });

    it('drops the baseline lib file and keeps the real one', () => {
        const result = analyzeComponent(buttonEntry(), syncCtx([buttonEntry(), cardEntry()]), syncRoots);
        expect(result.update.libFiles).toEqual(['format.ts']);
    });

    it('detects a file the registry declares but the import tree no longer reaches', () => {
        const stale = buttonEntry({ files: ['button/index.ts', 'button/button.component.ts', 'button/dead.ts'] });
        const result = analyzeComponent(stale, syncCtx([stale, cardEntry()]), syncRoots);
        expect(result.diff.removedFiles).toEqual(['button/dead.ts']);
        expect(hasDrift(result.diff)).toBe(true);
        expect(result.update.files).not.toContain('button/dead.ts');
    });

    it('detects a file on disk that the registry does not declare', () => {
        const thin = buttonEntry({ files: ['button/index.ts'] });
        const result = analyzeComponent(thin, syncCtx([thin, cardEntry()]), syncRoots);
        expect(result.diff.addedFiles).toEqual(['button/button.component.ts']);
    });

    it('detects a dependency the registry is missing', () => {
        const noDeps = cardEntry({ dependencies: [] });
        const result = analyzeComponent(noDeps, syncCtx([buttonEntry(), noDeps]), syncRoots);
        expect(result.diff.addedDeps).toEqual(['button']);
    });

    it('detects a dependency the registry declares but the tree does not import', () => {
        const extraDep = cardEntry({ dependencies: ['button', 'ghost'] });
        const result = analyzeComponent(extraDep, syncCtx([buttonEntry(), extraDep]), syncRoots);
        expect(result.diff.removedDeps).toEqual(['ghost']);
        expect(result.update.dependencies).toEqual(['button']);
    });

    it('detects a newly discovered libFile', () => {
        const noLibs = buttonEntry({ libFiles: [] });
        const result = analyzeComponent(noLibs, syncCtx([noLibs, cardEntry()]), syncRoots);
        expect(result.diff.addedLibs).toEqual(['format.ts']);
    });

    it('MERGES libFiles: a stale one survives and is not reported as drift', () => {
        // The load-bearing subtlety, end to end on a real tree: `dead.ts` is not
        // reachable from button's imports, yet --fix would write it straight
        // back out, and the gate would still call the tree "in sync".
        const withStale = buttonEntry({ libFiles: ['format.ts', 'dead.ts'] });
        const result = analyzeComponent(withStale, syncCtx([withStale, cardEntry()]), syncRoots);
        expect(result.update.libFiles).toEqual(['dead.ts', 'format.ts']);
        expect(hasDrift(result.diff)).toBe(false);
    });

    it('surfaces an addon-boundary violation from a base that reaches into addons/', () => {
        const base = entry({ name: 'base', files: ['base/index.ts', 'base/base.component.ts'] });
        const addon = entry({ name: 'base/extra', files: ['base/addons/extra/index.ts'] });
        const result = analyzeComponent(base, syncCtx([base, addon]), syncRoots);
        expect(result.addonViolations).toHaveLength(1);
        expect(result.addonViolations[0].addon).toBe('base/extra');
        // The base must not absorb the addon's opt-in file.
        expect(result.update.files).not.toContain('base/addons/extra/index.ts');
    });
});

// ---------------------------------------------------------------------------
// analyzeBlock
// ---------------------------------------------------------------------------

describe('analyzeBlock', () => {
    it('derives a block files, dependencies and libFiles across the roots', () => {
        const ctx = syncCtx([buttonEntry(), cardEntry()]);
        const result = analyzeBlock(loginBlockEntry(), ctx, syncRoots);
        expect(result.update.files).toEqual(['login/index.ts', 'login/login.component.ts']);
        expect(result.update.dependencies).toEqual(['button']);
        expect(result.update.libFiles).toEqual(['format.ts']);
        expect(hasDrift(result.diff)).toBe(false);
    });

    it('drops the baseline lib file from a block too', () => {
        const ctx = syncCtx([buttonEntry(), cardEntry()]);
        const result = analyzeBlock(loginBlockEntry({ libFiles: [] }), ctx, syncRoots);
        expect(result.update.libFiles).toEqual(['format.ts']);
        expect(result.diff.addedLibs).toEqual(['format.ts']);
    });

    it('detects block drift in files and dependencies', () => {
        const ctx = syncCtx([buttonEntry(), cardEntry()]);
        const drifted = loginBlockEntry({ files: ['login/index.ts', 'login/gone.ts'], dependencies: [] });
        const result = analyzeBlock(drifted, ctx, syncRoots);
        expect(result.diff.removedFiles).toEqual(['login/gone.ts']);
        expect(result.diff.addedFiles).toEqual(['login/login.component.ts']);
        expect(result.diff.addedDeps).toEqual(['button']);
    });
});

// ---------------------------------------------------------------------------
// analyzeAllEntries
// ---------------------------------------------------------------------------

describe('analyzeAllEntries', () => {
    it('reports no changes and no drift lines for a registry that matches disk', () => {
        const entries = [buttonEntry(), cardEntry()];
        const result = analyzeAllEntries(entries, [loginBlockEntry()], syncCtx(entries), syncRoots);
        expect(result.hasChanges).toBe(false);
        expect(result.driftLines).toEqual([]);
        expect(result.updates).toHaveLength(2);
        expect(result.blockUpdates).toHaveLength(1);
    });

    it('accumulates drift lines from components and blocks alike', () => {
        const entries = [buttonEntry({ libFiles: [] }), cardEntry()];
        const blocks = [loginBlockEntry({ dependencies: [] })];
        const result = analyzeAllEntries(entries, blocks, syncCtx(entries), syncRoots);
        expect(result.hasChanges).toBe(true);
        expect(result.driftLines).toContain('  button:');
        expect(result.driftLines).toContain('    + libFiles: format.ts');
        expect(result.driftLines).toContain('  login (block):');
        expect(result.driftLines).toContain('    + dependencies: button');
    });

    it('bubbles addon-boundary violations up from a component walk', () => {
        const base = entry({ name: 'base', files: ['base/index.ts', 'base/base.component.ts'] });
        const addon = entry({ name: 'base/extra', files: ['base/addons/extra/index.ts'] });
        const result = analyzeAllEntries([base, addon], [], syncCtx([base, addon]), syncRoots);
        expect(result.addonViolations).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Boundary-violation reports
// ---------------------------------------------------------------------------

describe('formatDeepImportReport', () => {
    it('is empty when there is nothing to warn about', () => {
        expect(formatDeepImportReport([])).toEqual([]);
    });

    it('dedupes the same offender rediscovered by several walks', () => {
        const di = { fromFile: 'ui/a.ts', importedFile: 'ui/b/b.component.ts', owner: 'b' };
        const lines = formatDeepImportReport([di, { ...di }]);
        expect(lines.filter(l => l === '  ui/a.ts')).toHaveLength(1);
        expect(lines.some(l => l.includes("reaches into the 'b' component folder"))).toBe(true);
    });

    it('keeps two distinct offenders', () => {
        const lines = formatDeepImportReport([
            { fromFile: 'ui/a.ts', importedFile: 'ui/b/b.component.ts', owner: 'b' },
            { fromFile: 'ui/c.ts', importedFile: 'ui/b/b.component.ts', owner: 'b' },
        ]);
        expect(lines.filter(l => l.startsWith('  ui/'))).toEqual(['  ui/a.ts', '  ui/c.ts']);
    });
});

describe('formatAddonViolationReport', () => {
    it('is empty when there are no violations', () => {
        expect(formatAddonViolationReport([])).toEqual([]);
    });

    it('dedupes and names the addon that was reached into', () => {
        const v = {
            fromFile: 'ui/base/base.component.ts',
            importedFile: 'ui/base/addons/extra/index.ts',
            addon: 'base/extra',
        };
        const lines = formatAddonViolationReport([v, { ...v }]);
        expect(lines.filter(l => l === '  ui/base/base.component.ts')).toHaveLength(1);
        expect(lines.some(l => l.includes("reaches into the 'base/extra' addon"))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Registry source rewriting
// ---------------------------------------------------------------------------

const SOURCE_FILES_ONLY = `export const registry = {
  button: {
    name: 'button',
    files: ['button/index.ts'],
  },
};`;

const SOURCE_FULL = `export const registry = {
  card: {
    name: 'card',
    files: ['card/index.ts'],
    libFiles: ['old.ts'],
    dependencies: ['button'],
  },
};`;

describe('replaceFilesArray', () => {
    it('rewrites the files array of the named entry', () => {
        const out = replaceFilesArray(SOURCE_FILES_ONLY, 'button', "'a.ts', 'b.ts'");
        expect(out).toContain("files: ['a.ts', 'b.ts']");
    });

    it('matches a double-quoted name too', () => {
        const source = `{ x: { name: "x", files: ['old.ts'] } };`;
        expect(replaceFilesArray(source, 'x', "'new.ts'")).toContain("files: ['new.ts']");
    });

    it('is a no-op for an unknown entry name', () => {
        expect(replaceFilesArray(SOURCE_FILES_ONLY, 'nope', "'a.ts'")).toBe(SOURCE_FILES_ONLY);
    });
});

describe('updateLibFiles', () => {
    it('rewrites an existing libFiles array', () => {
        expect(updateLibFiles(SOURCE_FULL, 'card', "'new.ts'")).toContain("libFiles: ['new.ts']");
    });

    it('inserts a libFiles key after files when the entry has none', () => {
        const out = updateLibFiles(SOURCE_FILES_ONLY, 'button', "'fmt.ts'");
        expect(out).toContain("files: ['button/index.ts'],\n    libFiles: ['fmt.ts']");
    });

    it('is a no-op for an unknown entry name', () => {
        expect(updateLibFiles(SOURCE_FULL, 'nope', "'x.ts'")).toBe(SOURCE_FULL);
    });
});

describe('updateDependencies', () => {
    it('rewrites an existing dependencies array', () => {
        expect(updateDependencies(SOURCE_FULL, 'card', "'input'")).toContain("dependencies: ['input']");
    });

    it('inserts dependencies after libFiles when the entry has libFiles but no deps', () => {
        const source = `{ card: { name: 'card', files: ['c.ts'], libFiles: ['l.ts'] } };`;
        const out = updateDependencies(source, 'card', "'button'");
        expect(out).toContain("libFiles: ['l.ts'],\n    dependencies: ['button']");
    });

    it('inserts dependencies after files when the entry has neither', () => {
        const out = updateDependencies(SOURCE_FILES_ONLY, 'button', "'ripple'");
        expect(out).toContain("files: ['button/index.ts'],\n    dependencies: ['ripple']");
    });

    it('is a no-op for an unknown entry name', () => {
        expect(updateDependencies(SOURCE_FULL, 'nope', "'x'")).toBe(SOURCE_FULL);
    });
});

describe('removeDependencies', () => {
    it('drops the dependencies key entirely', () => {
        const out = removeDependencies(SOURCE_FULL, 'card');
        expect(out).not.toContain('dependencies');
        expect(out).toContain("libFiles: ['old.ts']");
    });

    it('is a no-op when the entry has no dependencies', () => {
        expect(removeDependencies(SOURCE_FILES_ONLY, 'button')).toBe(SOURCE_FILES_ONLY);
    });

    it('is a no-op for an unknown entry name', () => {
        expect(removeDependencies(SOURCE_FULL, 'nope')).toBe(SOURCE_FULL);
    });
});

describe('applyUpdatesToSource', () => {
    it('round-trips through parseRegistrySource — what is written is what is parsed back', () => {
        const updates: ComponentUpdate[] = [
            {
                name: 'card',
                files: ['card/card.component.ts', 'card/index.ts'],
                libFiles: ['fmt.ts'],
                dependencies: ['button', 'input'],
            },
        ];
        const parsed = parseRegistrySource(applyUpdatesToSource(SOURCE_FULL, updates));
        const card = parsed.find(e => e.name === 'card');
        expect(card?.files).toEqual(['card/card.component.ts', 'card/index.ts']);
        expect(card?.libFiles).toEqual(['fmt.ts']);
        expect(card?.dependencies).toEqual(['button', 'input']);
    });

    it('removes the dependencies key when an update derives to none', () => {
        const out = applyUpdatesToSource(SOURCE_FULL, [
            { name: 'card', files: ['card/index.ts'], libFiles: ['old.ts'], dependencies: [] },
        ]);
        expect(out).not.toContain('dependencies');
        expect(parseRegistrySource(out).find(e => e.name === 'card')?.dependencies).toEqual([]);
    });

    it('leaves libFiles untouched when an update carries none', () => {
        const out = applyUpdatesToSource(SOURCE_FILES_ONLY, [
            { name: 'button', files: ['button/index.ts'], libFiles: [], dependencies: [] },
        ]);
        expect(out).not.toContain('libFiles');
    });

    it('applies several updates in one pass', () => {
        const source = `export const registry = {
  button: {
    name: 'button',
    files: ['button/index.ts'],
  },
  card: {
    name: 'card',
    files: ['card/index.ts'],
    dependencies: ['button'],
  },
};`;
        const out = applyUpdatesToSource(source, [
            { name: 'button', files: ['button/b.ts', 'button/index.ts'], libFiles: [], dependencies: [] },
            { name: 'card', files: ['card/index.ts'], libFiles: [], dependencies: ['button', 'badge'] },
        ]);
        const parsed = parseRegistrySource(out);
        expect(parsed.find(e => e.name === 'button')?.files).toEqual(['button/b.ts', 'button/index.ts']);
        expect(parsed.find(e => e.name === 'card')?.dependencies).toEqual(['button', 'badge']);
    });
});

// ---------------------------------------------------------------------------
// Validation against disk
// ---------------------------------------------------------------------------

describe('validateRegistryFiles', () => {
    it('reports nothing when every path resolves', () => {
        const update: ComponentUpdate = {
            name: 'button',
            files: ['button/index.ts', 'button/button.component.ts'],
            libFiles: ['format.ts'],
            dependencies: [],
        };
        expect(validateRegistryFiles([update], syncRoots)).toEqual([]);
    });

    it('reports a files entry that is not on disk', () => {
        const update: ComponentUpdate = {
            name: 'button',
            files: ['button/ghost.ts'],
            libFiles: [],
            dependencies: [],
        };
        const problems = validateRegistryFiles([update], syncRoots);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain("button: files entry 'button/ghost.ts'");
        expect(problems[0]).toContain('does not exist');
    });

    it('catches the stale libFile that the merge semantics let through', () => {
        // The only backstop for a merged-but-dead libFile: once the file is
        // gone from disk, validation refuses the write.
        const update: ComponentUpdate = {
            name: 'button',
            files: [],
            libFiles: ['format.ts', 'dead.ts'],
            dependencies: [],
        };
        const problems = validateRegistryFiles([update], syncRoots);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain("button: libFiles entry 'dead.ts'");
    });
});

describe('validateBlockFiles', () => {
    it('resolves block files against the blocks root, not the components root', () => {
        const update: ComponentUpdate = {
            name: 'login',
            files: ['login/index.ts', 'login/login.component.ts'],
            libFiles: ['format.ts'],
            dependencies: [],
        };
        expect(validateBlockFiles([update], syncRoots)).toEqual([]);
    });

    it('reports a missing block file and a missing block libFile', () => {
        const update: ComponentUpdate = {
            name: 'login',
            files: ['login/ghost.ts'],
            libFiles: ['dead.ts'],
            dependencies: [],
        };
        const problems = validateBlockFiles([update], syncRoots);
        expect(problems).toHaveLength(2);
        expect(problems[0]).toContain("login: block file entry 'login/ghost.ts'");
        expect(problems[1]).toContain("login: libFiles entry 'dead.ts'");
    });
});

// ---------------------------------------------------------------------------
// Orphan blocks / manifest serialization
// ---------------------------------------------------------------------------

describe('detectOrphanBlockFolders', () => {
    it('finds a block folder on disk that no registry entry claims', () => {
        expect(detectOrphanBlockFolders([loginBlockEntry()], syncRoots.blocksRoot)).toEqual(['orphan']);
    });

    it('claims a folder from the first path segment of the entry files', () => {
        const claimed = detectOrphanBlockFolders(
            [loginBlockEntry(), entry({ name: 'orphan', isBlock: true, files: ['orphan/index.ts'] })],
            syncRoots.blocksRoot,
        );
        expect(claimed).toEqual([]);
    });

    it('returns nothing when the blocks root does not exist', () => {
        expect(detectOrphanBlockFolders([], path.join(syncBase, 'no-such-root'))).toEqual([]);
    });
});

describe('serializeRegistryJson', () => {
    it('writes 2-space JSON with a trailing newline', () => {
        expect(serializeRegistryJson({ a: 1 })).toBe('{\n  "a": 1\n}\n');
    });
});
