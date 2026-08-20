/**
 * T-5 / T-6 from `specs/dx-distribution-spec.md` §2.1.
 *
 * T-5 proves the API tables are *generated* from the compodoc extract rather
 * than hand-written — every row in the committed payload must be traceable back
 * to `api-docs.json`, and none may exist that the extract does not have.
 *
 * T-6 proves the consequence that matters day to day: adding an input to a
 * component makes it appear in the docs with no hand-editing anywhere.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    apiTablesFor,
    buildComponentDocs,
    classOwners,
    parseDemoRoutes,
    parseImportedClasses,
    resolveDemoRoutes,
    scoreRoute,
    serializeComponentDocs,
    stackblitzUrl,
    type ComponentDocs,
    type DemoRouteSource,
} from './gen-component-docs-lib.js';
import { indexDocClasses, type RegistryEntry, type RegistryJson } from './gen-llms-lib.js';
import type { ApiClass, ApiDocs, ApiMember } from './gen-api-docs-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readJson<T>(relative: string): T {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), 'utf-8')) as T;
}

const registry = readJson<RegistryJson>('packages/components/registry.json');
const apiDocs = readJson<ApiDocs>('packages/components/api-docs.json');
const committed = readJson<ComponentDocs>('demo/public/component-docs.json');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function member(over: Partial<ApiMember> & { name: string }): ApiMember {
    return { type: 'unknown', description: '', ...over };
}

function apiClass(over: Partial<ApiClass> & { name: string; file: string }): ApiClass {
    return {
        kind: 'component',
        selector: '',
        description: '',
        projectsContent: false,
        inputs: [],
        outputs: [],
        ...over,
    };
}

function entry(over: Partial<RegistryEntry> & { name: string }): RegistryEntry {
    return { files: [], ...over };
}

const FIXTURE_REGISTRY: RegistryJson = {
    box: entry({
        name: 'box',
        files: ['box/index.ts', 'box/box.component.ts', 'box/sub/box-item.component.ts'],
        description: 'A box.', category: 'layout',
    }),
    dot: entry({ name: 'dot', files: ['dot/index.ts', 'dot/dot.component.ts'] }),
};

const FIXTURE_DOCS: ApiDocs = {
    version: 1,
    classes: [
        apiClass({
            name: 'BoxComponent',
            file: 'packages/components/ui/box/box.component.ts',
            selector: 'ui-box',
            description: 'The box.',
            inputs: [member({ name: 'size', type: 'number', default: '1' })],
            outputs: [member({ name: 'closed', type: 'void' })],
        }),
        apiClass({
            name: 'BoxItemComponent',
            file: 'packages/components/ui/box/sub/box-item.component.ts',
            selector: 'ui-box-item',
        }),
        apiClass({
            name: 'BoxHelper',
            file: 'packages/components/ui/box/box.utils.ts',
        }),
        apiClass({
            name: 'DotComponent',
            file: 'packages/components/ui/dot/dot.component.ts',
            selector: 'ui-dot',
        }),
    ],
};

const FIXTURE_ROUTES: readonly DemoRouteSource[] = [
    {
        path: 'dot', module: './demos/dot-demo.component',
        file: 'demo/src/app/demos/dot-demo.component.ts',
        importedClasses: ['BoxComponent', 'DotComponent'],
    },
    {
        path: 'boxes', module: './demos/box-demo.component',
        file: 'demo/src/app/demos/box-demo.component.ts',
        importedClasses: ['BoxComponent'],
    },
];

// ---------------------------------------------------------------------------
// T-5
// ---------------------------------------------------------------------------

describe('T-5: API tables are generated from documentation.json', () => {
    // Keyed by file, not class name: `DataTableContextMenuDirective` exists
    // twice in the library under two different files.
    const extractByFile = new Map(apiDocs.classes.map(c => [`${c.file}::${c.name}`, c]));

    it('has an entry for every component the registry ships', () => {
        expect(committed.components).toHaveLength(
            Object.keys(registry).filter(n => registry[n].type !== 'block').length,
        );
    });

    it('sources every API row from the extract, with identical types and defaults', () => {
        for (const component of committed.components) {
            for (const table of component.api) {
                const source = extractByFile.get(`${table.file}::${table.className}`);
                expect(source, `${component.name} → ${table.file}`).toBeDefined();
                expect(table.inputs).toEqual(source?.inputs);
                expect(table.outputs).toEqual(source?.outputs);
                expect(table.selector).toBe(source?.selector);
            }
        }
    });

    it('invents no class the extract does not have', () => {
        const claimed = new Set(
            committed.components.flatMap(c => c.api.map(t => `${t.file}::${t.className}`)),
        );
        for (const key of claimed) expect(extractByFile.has(key), key).toBe(true);
    });

    it('regenerates byte-for-byte from the committed inputs', () => {
        const routes = readRealRoutes();
        expect(serializeComponentDocs(buildComponentDocs(registry, apiDocs, routes)))
            .toBe(fs.readFileSync(path.join(REPO_ROOT, 'demo/public/component-docs.json'), 'utf-8'));
    });

    it('documents the sub-components a compound component ships, not just the entry class', () => {
        const accordion = committed.components.find(c => c.name === 'accordion');
        expect(accordion?.api.length).toBeGreaterThan(1);
        expect(accordion?.api[0].className).toBe('AccordionComponent');
    });
});

// ---------------------------------------------------------------------------
// T-6
// ---------------------------------------------------------------------------

describe('T-6: a component with a new input shows it without hand-editing', () => {
    it('surfaces an input added to the extract', () => {
        const before = buildComponentDocs(FIXTURE_REGISTRY, FIXTURE_DOCS, FIXTURE_ROUTES);
        expect(before.components[0].api[0].inputs.map(i => i.name)).toEqual(['size']);

        const grown: ApiDocs = {
            version: 1,
            classes: FIXTURE_DOCS.classes.map(cls => cls.name === 'BoxComponent'
                ? { ...cls, inputs: [...cls.inputs, member({ name: 'tone', type: "'a' | 'b'" })] }
                : cls),
        };
        const after = buildComponentDocs(FIXTURE_REGISTRY, grown, FIXTURE_ROUTES);
        expect(after.components[0].api[0].inputs.map(i => i.name)).toEqual(['size', 'tone']);
    });

    it('surfaces a newly required input in the snippet too', () => {
        const grown: ApiDocs = {
            version: 1,
            classes: FIXTURE_DOCS.classes.map(cls => cls.name === 'BoxComponent'
                ? { ...cls, inputs: [member({ name: 'items', type: 'Item[]', required: true })] }
                : cls),
        };
        const after = buildComponentDocs(FIXTURE_REGISTRY, grown, FIXTURE_ROUTES);
        expect(after.components[0].snippet).toBe('<ui-box [items]="[]" />');
    });

    it('drops a removed input without anyone editing a page', () => {
        const shrunk: ApiDocs = {
            version: 1,
            classes: FIXTURE_DOCS.classes.map(cls => cls.name === 'BoxComponent'
                ? { ...cls, inputs: [] }
                : cls),
        };
        const after = buildComponentDocs(FIXTURE_REGISTRY, shrunk, FIXTURE_ROUTES);
        expect(after.components[0].api[0].inputs).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Parsing the demo app
// ---------------------------------------------------------------------------

function readRealRoutes(): DemoRouteSource[] {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'demo/src/app/demo.routes.ts'), 'utf-8');
    return parseDemoRoutes(source).flatMap(route => {
        const relative = `demo/src/app/${route.module.replace(/^\.\//, '')}.ts`;
        const absolute = path.join(REPO_ROOT, relative);
        if (!fs.existsSync(absolute)) return [];
        return [{
            ...route,
            file: relative,
            importedClasses: parseImportedClasses(fs.readFileSync(absolute, 'utf-8')),
        }];
    });
}

describe('parseDemoRoutes', () => {
    it('reads path and lazy module from a route entry', () => {
        const source = `
  { path: 'alert', loadComponent: () => import('./demos/feedback/alert-demo.component').then(m => m.A) },
  { path: '', loadComponent: () => import('./demos/introduction.component').then(m => m.I) },
`;
        expect(parseDemoRoutes(source)).toEqual([
            { path: 'alert', module: './demos/feedback/alert-demo.component' },
            { path: '', module: './demos/introduction.component' },
        ]);
    });

    it('finds every route in the real demo app', () => {
        const source = fs.readFileSync(path.join(REPO_ROOT, 'demo/src/app/demo.routes.ts'), 'utf-8');
        expect(parseDemoRoutes(source).length).toBeGreaterThan(100);
    });
});

describe('parseImportedClasses', () => {
    it('reads classes imported through the package barrel', () => {
        const source = `import { A, B as C } from '../../../../../packages/components/ui';`;
        expect(parseImportedClasses(source)).toEqual(['A', 'B']);
    });

    it('reads classes imported through the consumer alias', () => {
        const source = `import { ButtonComponent } from '@/components/ui/button';`;
        expect(parseImportedClasses(source)).toEqual(['ButtonComponent']);
    });

    it('counts type-only imports — a demo using a component\'s data type previews it', () => {
        const source = `import type { ChartSeries } from '../../packages/components/ui';`;
        expect(parseImportedClasses(source)).toEqual(['ChartSeries']);
    });

    it('reads the inline type form', () => {
        const source = `import { type ChartSeries, BarChartComponent } from '@/components/ui/bar-chart';`;
        expect(parseImportedClasses(source)).toEqual(['BarChartComponent', 'ChartSeries']);
    });

    it('ignores imports from anywhere else', () => {
        const source = `import { Component } from '@angular/core';\nimport { x } from './local';`;
        expect(parseImportedClasses(source)).toEqual([]);
    });
});

describe('T-8: StackBlitz links point at files that exist', () => {
    it('references a real demo source for every linked component', () => {
        const linked = committed.components.filter(c => c.stackblitz !== null);
        expect(linked.length).toBeGreaterThan(100);
        for (const component of linked) {
            const file = component.demoFile as string;
            expect(fs.existsSync(path.join(REPO_ROOT, file))).toBe(true);
            expect(component.stackblitz).toContain(encodeURIComponent(file));
        }
    });

    it('links exactly the components that resolved to a demo route', () => {
        for (const component of committed.components) {
            expect(component.stackblitz === null).toBe(component.demoRoute === null);
        }
    });
});

describe('stackblitzUrl', () => {
    it('points StackBlitz at this repo, opened on the demo file', () => {
        expect(stackblitzUrl('demo/src/app/demos/inputs/button-demo.component.ts'))
            .toBe('https://stackblitz.com/github/gilav21/shadcn-angular/tree/master' +
                '?file=demo%2Fsrc%2Fapp%2Fdemos%2Finputs%2Fbutton-demo.component.ts');
    });

    it('honours a branch override', () => {
        expect(stackblitzUrl('demo/x.ts', 'next')).toContain('/tree/next?file=');
    });
});

// ---------------------------------------------------------------------------
// Route resolution
// ---------------------------------------------------------------------------

describe('scoreRoute', () => {
    const route = (path: string, module: string) => ({ path, module });

    it('ranks the component\'s own route first', () => {
        expect(scoreRoute(route('button', './demos/x'), 'button')).toBe(0);
    });

    it('then a demo file named after the component', () => {
        expect(scoreRoute(route('buttons', './demos/inputs/button-demo.component'), 'button')).toBe(1);
    });

    it('resolves an addon by its last name segment', () => {
        expect(scoreRoute(route('x', './demos/export-demo.component'), 'data-table/export')).toBe(1);
    });

    it('then a pluralised route path', () => {
        expect(scoreRoute(route('buttons', './demos/x'), 'button')).toBe(2);
    });

    it('then a route prefixed with the component name', () => {
        expect(scoreRoute(route('tree-view', './demos/x'), 'tree')).toBe(3);
    });

    it('and finally any route that merely imports it', () => {
        expect(scoreRoute(route('spinner', './demos/x'), 'button')).toBe(4);
    });
});

describe('resolveDemoRoutes', () => {
    it('prefers the component\'s own demo over an earlier route that imports it', () => {
        const resolved = resolveDemoRoutes(FIXTURE_REGISTRY, FIXTURE_DOCS, FIXTURE_ROUTES);
        expect(resolved.get('box')?.path).toBe('boxes');
        expect(resolved.get('dot')?.path).toBe('dot');
    });

    it('leaves a component with no demo unresolved rather than guessing', () => {
        const resolved = resolveDemoRoutes(FIXTURE_REGISTRY, FIXTURE_DOCS, [FIXTURE_ROUTES[1]]);
        expect(resolved.has('dot')).toBe(false);
    });

    it('documents the button on the button page, not on the spinner page', () => {
        const resolved = resolveDemoRoutes(registry, apiDocs, readRealRoutes());
        expect(resolved.get('button')?.path).toBe('buttons');
    });

    it('routes every chart to the shared charts page', () => {
        const resolved = resolveDemoRoutes(registry, apiDocs, readRealRoutes());
        expect(resolved.get('line-chart')?.path).toBe('charts');
        expect(resolved.get('pie-chart')?.path).toBe('charts');
    });
});

describe('classOwners', () => {
    it('maps each exported class to the component that ships it', () => {
        const owners = classOwners(FIXTURE_REGISTRY, FIXTURE_DOCS);
        expect(owners.get('BoxComponent')).toBe('box');
        expect(owners.get('BoxItemComponent')).toBe('box');
        expect(owners.get('DotComponent')).toBe('dot');
    });

    it('ignores a class from a file no registry entry claims', () => {
        const stray: ApiDocs = {
            version: 1,
            classes: [apiClass({ name: 'Stray', file: 'packages/components/ui/stray.ts' })],
        };
        expect(classOwners(FIXTURE_REGISTRY, stray).size).toBe(0);
    });
});

describe('apiTablesFor', () => {
    const byFile = indexDocClasses(FIXTURE_DOCS);

    it('lists the primary class first, then sub-components', () => {
        const primary = FIXTURE_DOCS.classes[0];
        const tables = apiTablesFor(FIXTURE_REGISTRY['box'], byFile, primary);
        expect(tables.map(t => t.className)).toEqual(['BoxComponent', 'BoxItemComponent']);
    });

    it('omits classes with no selector — they are not template API', () => {
        const tables = apiTablesFor(
            entry({ name: 'box', files: ['box/box.utils.ts'] }), byFile, null,
        );
        expect(tables).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Payload shape
// ---------------------------------------------------------------------------

describe('buildComponentDocs', () => {
    const built = buildComponentDocs(FIXTURE_REGISTRY, FIXTURE_DOCS, FIXTURE_ROUTES);

    it('states the install command for each component', () => {
        expect(built.components[0].install)
            .toBe('npx @gilav21/shadcn-angular@latest add box');
    });

    it('states the canonical import', () => {
        expect(built.components[0].importStatement)
            .toBe("import { BoxComponent } from '@/components/ui/box';");
    });

    it('links StackBlitz at the resolved demo file', () => {
        expect(built.components[0].stackblitz)
            .toContain('box-demo.component.ts');
    });

    it('leaves the StackBlitz link null when there is no demo', () => {
        const noRoutes = buildComponentDocs(FIXTURE_REGISTRY, FIXTURE_DOCS, []);
        expect(noRoutes.components[0].stackblitz).toBeNull();
        expect(noRoutes.components[0].demoRoute).toBeNull();
    });

    it('is deterministic', () => {
        expect(serializeComponentDocs(built))
            .toBe(serializeComponentDocs(buildComponentDocs(FIXTURE_REGISTRY, FIXTURE_DOCS, FIXTURE_ROUTES)));
    });
});
