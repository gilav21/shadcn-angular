import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
