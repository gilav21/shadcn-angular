import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    copyScripts,
    createRepo,
    fixtureScript,
    removeRepo,
    runScript,
    write,
    type Run,
} from './repo-fixtures';
import {
    InsertError,
    demoLocation,
    escapeDescription,
    existingDestinations,
    insertDemoExport,
    insertRegistryEntry,
    insertRoute,
    isCategoryName,
    pascalCase,
    renderBarrel,
    renderComponentHtml,
    renderComponentTs,
    renderDemo,
    renderItemHtml,
    renderItemTs,
    renderSpec,
    renderStories,
    validateName,
    type ComponentMeta,
} from './new-component-lib';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPT = 'packages/cli/scripts/new-component.ts';

const meta: ComponentMeta = {
    name: 'test-widget',
    description: 'A widget for tests.',
    category: 'layout',
    tags: ['widget', 'test'],
    compound: false,
};

const compoundMeta: ComponentMeta = { ...meta, compound: true };

describe('validateName', () => {
    it.each(['button', 'data-table', 'input-otp', 'a1-b2'])('accepts %s', (name) => {
        expect(validateName(name)).toBeNull();
    });

    it.each(['', 'Button', 'my_widget', '-widget', 'widget-', 'my--widget', '1widget'])(
        'rejects %s',
        (name) => {
            expect(validateName(name)).toBeTypeOf('string');
        },
    );
});

describe('categories', () => {
    it('maps every category to a demo folder + section', () => {
        expect(demoLocation('form')).toEqual({ folder: 'inputs', section: 'Inputs' });
        expect(demoLocation('animation')).toEqual({ folder: 'animations', section: 'Animations' });
    });

    it('rejects a non-category', () => {
        expect(isCategoryName('layout')).toBe(true);
        expect(isCategoryName('nope')).toBe(false);
    });
});

describe('renderComponentTs', () => {
    it('emits the project conventions: OnPush, signal inputs, class input, cn(), no ViewEncapsulation', () => {
        const src = renderComponentTs(meta);
        expect(src).toContain('changeDetection: ChangeDetectionStrategy.OnPush');
        expect(src).toContain("readonly class = input('')");
        expect(src).toContain('readonly classes = computed(() => cn(');
        expect(src).toContain("selector: 'ui-test-widget'");
        expect(src).toContain('export class TestWidgetComponent');
        expect(src).not.toContain('ViewEncapsulation');
        expect(src).not.toContain('@Input');
        expect(src).not.toContain('styleUrl');
    });

    it('puts the data-slot hook on the template root', () => {
        expect(renderComponentHtml(meta)).toContain(`[attr.data-slot]="'test-widget'"`);
    });

    it('emits a dual-mode item + content sub-component under --compound', () => {
        const item = renderItemTs(compoundMeta);
        expect(item).toContain('contentChild(TestWidgetContentComponent)');
        expect(item).toContain('readonly hasCustomContent = computed(');
        expect(renderBarrel(compoundMeta)).toContain("export * from './sub/test-widget-item.component'");
        expect(renderBarrel(meta)).toBe("export * from './test-widget.component';\n");
    });

    // Angular fills the FIRST <ng-content> it instantiates; one per @if/@else
    // branch silently drops the projected nodes (caught by a real generated run).
    it('gives the dual-mode item exactly one <ng-content>', () => {
        const html = renderItemHtml(compoundMeta);
        expect(html.match(/<ng-content \/>/g)).toHaveLength(1);
        expect(html).toContain('@if (showDefaults())');
    });
});

describe('renderSpec', () => {
    it('asserts behaviour, not just creation', () => {
        const src = renderSpec(meta);
        expect(src).toContain('reacts to the variant input');
        expect(src).toContain('merges the class input');
        expect(src).not.toContain('should create');
    });

    it('covers both modes for a compound component', () => {
        const src = renderSpec(compoundMeta);
        expect(src).toContain('renders title and description in simple mode');
        expect(src).toContain('suppresses the simple-mode defaults when content is projected');
    });
});

describe('renderStories / renderDemo', () => {
    it('exports a Playground story', () => {
        expect(renderStories(meta)).toContain('export const Playground: Story');
        expect(renderStories(compoundMeta)).toContain('export const Playground: Story');
    });

    it('names the demo component the way demo.routes.ts expects', () => {
        expect(renderDemo(meta)).toContain('export class TestWidgetDemoComponent');
        expect(pascalCase('test-widget')).toBe('TestWidget');
    });
});

describe('insertRoute', () => {
    const routes = `import { Routes } from '@angular/router';

export const DEMO_ROUTES: Routes = [
  // Layout
  { path: 'card', loadComponent: () => import('./demos/layout/card-demo.component').then(m => m.CardDemoComponent) },

  // Charts
  { path: 'bar-chart', loadComponent: () => import('./demos/charts/bar-chart-demo.component').then(m => m.BarChartDemoComponent) },

  // Wildcard
  { path: '**', redirectTo: '' },
];
`;

    it('appends the route to the end of its category section', () => {
        const out = insertRoute(routes, meta);
        const lines = out.split('\n');
        const idx = lines.findIndex(l => l.includes("path: 'test-widget'"));
        expect(idx).toBeGreaterThan(lines.findIndex(l => l.includes("path: 'card'")));
        expect(lines[idx + 1].trim()).toBe('');
        expect(lines[idx]).toContain("import('./demos/layout/test-widget-demo.component')");
        expect(lines[idx]).toContain('m.TestWidgetDemoComponent');
    });

    it('refuses to double-register', () => {
        const once = insertRoute(routes, meta);
        expect(() => insertRoute(once, meta)).toThrow(InsertError);
    });

    it('throws when the section header is missing', () => {
        expect(() => insertRoute(routes, { ...meta, category: 'overlay' })).toThrow(InsertError);
    });

    it('appends the matching demos/index.ts export', () => {
        const index = `// Layout\nexport { CardDemoComponent } from './layout/card-demo.component';\n`;
        expect(insertDemoExport(index, meta)).toContain(
            "export { TestWidgetDemoComponent } from './layout/test-widget-demo.component';",
        );
    });
});

describe('insertRegistryEntry', () => {
    const registry = `export const registry = defineRegistry({
  badge: {
    name: 'badge',
    files: ['badge/badge.component.ts'],
  },
  'tree-select': {
    name: 'tree-select',
    files: ['tree-select/tree-select.component.ts'],
  },
});
`;

    it('inserts alphabetically with the human fields sync-registry cannot derive', () => {
        const out = insertRegistryEntry(registry, meta);
        expect(out).toContain("  'test-widget': {");
        expect(out).toContain("    category: 'layout',");
        expect(out).toContain("    description: 'A widget for tests.',");
        expect(out).toContain("    tags: ['widget', 'test'],");

        const lines = out.split('\n');
        const badge = lines.findIndex(l => l.trim() === 'badge: {');
        const widget = lines.findIndex(l => l.trim() === "'test-widget': {");
        const tree = lines.findIndex(l => l.trim() === "'tree-select': {");
        expect(badge).toBeLessThan(widget);
        expect(widget).toBeLessThan(tree);
    });

    it('seeds the sub/ files for a compound component', () => {
        const out = insertRegistryEntry(registry, compoundMeta);
        expect(out).toContain('test-widget/sub/test-widget-item.component.ts');
    });

    it('escapes a quote in the description', () => {
        const out = insertRegistryEntry(registry, { ...meta, description: "A user's widget." });
        expect(out).toContain("description: 'A user\\'s widget.',");
    });

    it('refuses to duplicate an existing entry', () => {
        expect(() => insertRegistryEntry(registry, { ...meta, name: 'badge' })).toThrow(InsertError);
    });

    it('appends before the closing brace when the name sorts last', () => {
        const out = insertRegistryEntry(registry, { ...meta, name: 'zebra' });
        const lines = out.split('\n');
        expect(lines.findIndex(l => l.trim() === 'zebra: {'))
            .toBeLessThan(lines.findIndex(l => l.startsWith('});')));
    });
});

// The CLI surface: these run the real script against the real repo, so they must
// not write anything (--dry-run) or must fail before writing (existing name).
describe('new-component CLI', () => {
    function run(args: readonly string[]): { status: number; out: string } {
        try {
            const out = execFileSync('npx', ['tsx', SCRIPT, ...args], {
                cwd: REPO_ROOT,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: process.platform === 'win32',
            });
            return { status: 0, out };
        } catch (error: unknown) {
            const e = error as { status?: number; stdout?: string; stderr?: string };
            return { status: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
        }
    }

    it('--dry-run writes nothing', () => {
        const before = readFileSync(path.join(REPO_ROOT, 'demo/src/app/demo.routes.ts'), 'utf-8');
        const { status, out } = run([
            'dry-run-probe', '--dry-run', '--category', 'layout',
            '--description', 'probe', '--tags', 'probe',
        ]);
        expect(status).toBe(0);
        expect(out).toContain('nothing written');
        expect(out).toContain('packages/components/ui/dry-run-probe/dry-run-probe.component.ts');
        expect(existsSync(path.join(REPO_ROOT, 'packages/components/ui/dry-run-probe'))).toBe(false);
        expect(readFileSync(path.join(REPO_ROOT, 'demo/src/app/demo.routes.ts'), 'utf-8')).toBe(before);
    }, 60_000);

    it('refuses to overwrite an existing component', () => {
        const { status, out } = run(['button', '--category', 'layout', '--description', 'x', '--tags', 'x']);
        expect(status).toBe(1);
        expect(out).toContain('already exists');
    }, 60_000);

    it('rejects a non-kebab-case name', () => {
        const { status, out } = run(['MyWidget', '--category', 'layout', '--description', 'x', '--tags', 'x']);
        expect(status).toBe(1);
        expect(out).toContain('kebab-case');
    }, 60_000);

    // Regression (review finding #9): `confetti` has a demo page but NO
    // packages/components/ui/confetti/ folder, so the old ui/-only guard let the
    // generator silently overwrite the existing demo page.
    it('refuses to overwrite an existing demo page whose ui/ folder does not exist', () => {
        expect(existsSync(path.join(REPO_ROOT, 'packages/components/ui/confetti'))).toBe(false);
        const demoPage = path.join(REPO_ROOT, 'demo/src/app/demos/animations/confetti-demo.component.ts');
        const before = readFileSync(demoPage, 'utf-8');

        const { status, out } = run([
            'confetti', '--category', 'animation', '--description', 'x', '--tags', 'x',
        ]);

        expect(status).toBe(1);
        expect(out).toContain('refusing to overwrite');
        expect(out).toContain('demo/src/app/demos/animations/confetti-demo.component.ts');
        expect(readFileSync(demoPage, 'utf-8')).toBe(before);
    }, 60_000);
});

// Regression (review finding #5): the description is free text and every slot it
// lands in is INSIDE a TS template literal in the emitted file. An unescaped
// backtick or `${` there closed the literal / opened an interpolation, and the
// generated demo + stories did not compile.
describe('description escaping (template-literal context)', () => {
    const tricky: ComponentMeta = {
        ...meta,
        description: 'Renders `code` inline, ${interpolated} & <tagged>.',
    };

    it('escapes backticks and ${ on top of the HTML escaping', () => {
        expect(escapeDescription('Renders `code` inline')).toBe('Renders \\`code\\` inline');
        expect(escapeDescription('a ${x} b')).toBe('a \\${x} b');
        expect(escapeDescription('<b> & </b>')).toBe('&lt;b&gt; &amp; &lt;/b&gt;');
    });

    // The stories template does not interpolate the description; the demo and the
    // component's JSDoc do.
    it.each([
        ['demo', renderDemo],
        ['component', renderComponentTs],
    ] as const)('emits an escaped description into the %s file', (_label, render) => {
        const source = render(tricky);
        expect(source).toContain('\\`code\\`');
        expect(source).toContain('\\${interpolated}');
        // No raw backtick from the description survives: every one of them is
        // preceded by a backslash (the file's own template-literal delimiters are
        // in the templates, not in the description slot).
        expect(source).not.toMatch(/[^\\]`code/);
    });

    it('keeps the emitted demo a single, unterminated-free template literal', () => {
        const source = renderDemo(tricky);
        const body = source.slice(source.indexOf('template: `') + 'template: `'.length);
        const unescaped = [...body].filter((ch, i) => ch === '`' && body[i - 1] !== '\\');
        // Exactly one unescaped backtick left: the one closing `template:`.
        expect(unescaped).toHaveLength(1);
    });

    it('escapes the description for the single-quoted registry entry too', () => {
        const entry = insertRegistryEntry(
            'export const registry = defineRegistry({\nzzz: {},\n});\n',
            { ...meta, description: "it's a trap \\" },
        );
        expect(entry).toContain("description: 'it\\'s a trap \\\\',");
    });
});

// Regression (review finding #9): the generator only refused when
// packages/components/ui/<name>/ existed — the demo page lives in another tree,
// so an existing (possibly orphan) demo page for the same name was silently
// overwritten.
describe('existingDestinations', () => {
    const planned = [
        'packages/components/ui/tour/tour.component.ts',
        'demo/src/app/demos/layout/tour-demo.component.ts',
    ];

    it('reports an existing demo page even when the ui/ folder is absent', () => {
        const exists = (f: string): boolean => f.startsWith('demo/');
        expect(existingDestinations(planned, exists))
            .toEqual(['demo/src/app/demos/layout/tour-demo.component.ts']);
    });

    it('reports nothing when every destination is free', () => {
        expect(existingDestinations(planned, () => false)).toEqual([]);
    });
});

// ── The entry script, end to end (subprocess, fixture repo) ──────────────
//
// The CLI tests above drive the REAL repo, so they can only exercise the paths
// that refuse to write (bad name, existing destination, --dry-run). The happy
// path writes six files, edits three sources and chains two scripts — against
// whatever repo the script itself lives in. Driving it for real therefore means
// copying it into a throwaway repo (see repo-fixtures.ts) whose registry, demo
// routes and demo barrel are miniature versions of the real ones.
//
// `sync-registry.ts` is chained for real (keeping the registry in step with the
// files it just wrote IS this script's contract); `e2e/orchestrator/scaffold.ts`
// — tested elsewhere, and far heavier — is stubbed with a script that records
// the argv it was handed, which is exactly what this test needs to assert.

const FIXTURE_REGISTRY = `import { defineRegistry } from './define';

export const registry = defineRegistry({
  alpha: {
    name: 'alpha',
    category: 'utility',
    description: 'Alpha.',
    tags: ['alpha'],
    files: ['alpha/alpha.component.ts', 'alpha/index.ts'],
  },
});
`;

const FIXTURE_ROUTES = `export const routes = [
  // Data Display
  { path: 'alpha', loadComponent: () => import('./demos/data-display/alpha-demo.component').then(m => m.AlphaDemoComponent) },

  // Layout
  { path: 'box', loadComponent: () => import('./demos/layout/box-demo.component').then(m => m.BoxDemoComponent) },

  // Wildcard
  { path: '**', redirectTo: '' },
];
`;

const FIXTURE_DEMO_INDEX = `// Data Display
export { AlphaDemoComponent } from './data-display/alpha-demo.component';

// Layout
export { BoxDemoComponent } from './layout/box-demo.component';
`;

/** Records the argv it was chained with, so the test can assert the hand-off. */
const SCAFFOLD_STUB = `import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
writeFileSync(path.join(dir, 'scaffolded.txt'), process.argv.slice(2).join(' '));
`;

function seedFixture(): string {
    const root = createRepo('new-component');
    copyScripts(root, [
        'new-component.ts',
        'new-component-lib.ts',
        'sync-registry.ts',
        'sync-registry-lib.ts',
    ]);
    write(root, 'packages/cli/src/registry/define.ts',
        'export function defineRegistry<T>(r: T): T { return r; }\n');
    write(root, 'packages/cli/src/registry/index.ts', FIXTURE_REGISTRY);
    write(root, 'packages/components/ui/alpha/index.ts', "export * from './alpha.component';\n");
    write(root, 'packages/components/ui/alpha/alpha.component.ts', 'export const Alpha = 1;\n');
    // The generated component imports `cn` from ../../lib/utils, and the chained
    // sync-registry validates every derived libFile against disk before writing.
    write(root, 'packages/components/lib/utils.ts', 'export const cn = (s: string) => s;\n');
    write(root, 'demo/src/app/demo.routes.ts', FIXTURE_ROUTES);
    write(root, 'demo/src/app/demos/index.ts', FIXTURE_DEMO_INDEX);
    write(root, 'demo/src/app/demos/data-display/alpha-demo.component.ts',
        'export class AlphaDemoComponent {}\n');
    write(root, 'demo/src/app/demos/layout/box-demo.component.ts', 'export class BoxDemoComponent {}\n');
    write(root, 'e2e/orchestrator/scaffold.ts', SCAFFOLD_STUB);
    return root;
}

describe('new-component entry (fixture repo)', () => {
    let root = '';

    afterEach(() => {
        if (root) removeRepo(root);
        root = '';
    });

    function fixtureRun(args: readonly string[]): Run {
        root = seedFixture();
        return runScript(fixtureScript(root, 'new-component.ts'), args);
    }

    function read(rel: string): string {
        return readFileSync(path.join(root, rel), 'utf-8');
    }

    function exists(rel: string): boolean {
        return existsSync(path.join(root, rel));
    }

    it('scaffolds the component, wires the demo, and chains sync-registry + e2e:scaffold', () => {
        const { status, stdout } = fixtureRun([
            'widget', '--category', 'utility', '--description', 'A widget.', '--tags', 'widget,demo',
        ]);

        expect(status).toBe(0);
        expect(stdout).toContain('Done.');

        const component = read('packages/components/ui/widget/widget.component.ts');
        expect(component).toContain("selector: 'ui-widget'");
        expect(component).toContain('ChangeDetectionStrategy.OnPush');
        expect(read('packages/components/ui/widget/widget.component.html')).toContain('data-slot');
        expect(read('packages/components/ui/widget/index.ts')).toContain('./widget.component');
        expect(exists('packages/components/ui/widget/widget.component.spec.ts')).toBe(true);
        expect(exists('packages/components/ui/widget/widget.stories.ts')).toBe(true);

        // The demo page exists AND is reachable — an unrouted page is exactly what
        // check-completeness calls an orphan.
        expect(read('demo/src/app/demos/data-display/widget-demo.component.ts'))
            .toContain('export class WidgetDemoComponent');
        expect(read('demo/src/app/demo.routes.ts')).toContain("{ path: 'widget'");
        expect(read('demo/src/app/demos/index.ts'))
            .toContain("export { WidgetDemoComponent } from './data-display/widget-demo.component';");

        // The chained sync-registry --fix re-derived `files` from disk.
        const registry = read('packages/cli/src/registry/index.ts');
        expect(registry).toContain("name: 'widget'");
        expect(registry).toContain('widget/widget.component.html');
        expect(exists('packages/components/registry.json')).toBe(true);

        // The chained e2e scaffolder, with the component name.
        expect(read('e2e/orchestrator/scaffolded.txt')).toBe('widget');
    }, 120_000);

    it('emits the dual-mode sub-components under --compound', () => {
        const { status } = fixtureRun([
            'stack', '--compound', '--category', 'layout', '--description', 'A stack.', '--tags', 'stack',
        ]);

        expect(status).toBe(0);
        expect(read('packages/components/ui/stack/sub/stack-item.component.ts'))
            .toContain("selector: 'ui-stack-item'");
        expect(read('packages/components/ui/stack/sub/stack-content.component.ts'))
            .toContain("selector: 'ui-stack-content'");
        expect(read('packages/components/ui/stack/index.ts')).toContain('./sub/stack-item.component');
        expect(read('demo/src/app/demo.routes.ts')).toContain("{ path: 'stack'");
    }, 120_000);

    it('exits 1 with a usage line when no name is given, and writes nothing', () => {
        const { status, output } = fixtureRun([]);

        expect(status).toBe(1);
        expect(output).toContain('a component name is required');
        expect(output).toContain('Usage: npm run new:component -- <name>');
        expect(read('packages/cli/src/registry/index.ts')).toBe(FIXTURE_REGISTRY);
    }, 60_000);

    it('exits 1 on an unknown category, listing the valid ones, and writes nothing', () => {
        const { status, output } = fixtureRun([
            'widget', '--category', 'nonsense', '--description', 'x', '--tags', 'x',
        ]);

        expect(status).toBe(1);
        expect(output).toContain('unknown category "nonsense"');
        expect(output).toContain('data-display');
        expect(exists('packages/components/ui/widget')).toBe(false);
        expect(read('packages/cli/src/registry/index.ts')).toBe(FIXTURE_REGISTRY);
    }, 60_000);
});
