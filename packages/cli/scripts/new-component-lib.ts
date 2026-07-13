/**
 * Pure helpers for `npm run new:component` — templates + source rewrites.
 *
 * Everything here is a string→string function so the generator's behaviour is
 * unit-testable without touching disk (see `new-component.spec.ts`). The fs /
 * child-process side lives in `new-component.ts`.
 *
 * Templates are module-level strings with `__PLACEHOLDER__` slots filled by
 * `fill()` — not nested template literals, which keeps both the generator and
 * the code it emits inside the project's lint budget.
 *
 * The emitted code is the project's component contract (`.claude/CLAUDE.md`):
 * OnPush, signal `input()`/`computed()`, a `class` input merged with `cn()`, a
 * `data-slot` hook, no `ViewEncapsulation.None`, `readonly` members, and — for
 * `--compound` — the documented dual-mode (inputs by default, content
 * projection overrides).
 */

export const CATEGORY_NAMES = [
    'form',
    'navigation',
    'layout',
    'overlay',
    'data-display',
    'feedback',
    'charts',
    'animation',
    'media',
    'editor',
    'utility',
] as const;

export type CategoryName = (typeof CATEGORY_NAMES)[number];

/** Where a category's demo page lives, and the section header it is filed under. */
interface DemoLocation {
    readonly folder: string;
    readonly section: string;
}

const DEMO_LOCATIONS: Readonly<Record<CategoryName, DemoLocation>> = {
    form: { folder: 'inputs', section: 'Inputs' },
    navigation: { folder: 'navigation', section: 'Navigation' },
    layout: { folder: 'layout', section: 'Layout' },
    overlay: { folder: 'overlay', section: 'Overlay' },
    'data-display': { folder: 'data-display', section: 'Data Display' },
    feedback: { folder: 'feedback', section: 'Feedback' },
    charts: { folder: 'charts', section: 'Charts' },
    animation: { folder: 'animations', section: 'Animations' },
    media: { folder: 'data-display', section: 'Data Display' },
    editor: { folder: 'patterns', section: 'Patterns' },
    utility: { folder: 'data-display', section: 'Data Display' },
};

export function demoLocation(category: CategoryName): DemoLocation {
    return DEMO_LOCATIONS[category];
}

export function isCategoryName(value: string): value is CategoryName {
    return (CATEGORY_NAMES as readonly string[]).includes(value);
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Returns an error message, or null when the name is a usable component name. */
export function validateName(name: string): string | null {
    if (!name) return 'a component name is required';
    if (!KEBAB.test(name)) {
        return `"${name}" is not kebab-case — use lowercase letters, digits and single hyphens (e.g. "my-widget")`;
    }
    return null;
}

export function pascalCase(name: string): string {
    return name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

export function titleCase(name: string): string {
    return name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function camelCase(name: string): string {
    const pascal = pascalCase(name);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export interface ComponentMeta {
    readonly name: string;
    readonly description: string;
    readonly category: CategoryName;
    readonly tags: readonly string[];
    readonly compound: boolean;
}

function escapeHtml(s: string): string {
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * The description is free text (`--description "…"`) and every slot it lands in
 * is INSIDE a TS template literal in the emitted file (the demo's and stories'
 * `template: \`…\``, the component's JSDoc). A backtick or a `${` there closes
 * the literal / opens an interpolation and the generated file does not compile,
 * so both are backslash-escaped for that context on top of the HTML escaping.
 */
export function escapeDescription(s: string): string {
    return escapeHtml(s)
        .replaceAll('\\', '\\\\')
        .replaceAll('`', '\\`')
        .replaceAll('${', '\\${');
}

/** Substitutes every `__SLOT__` in a template. */
function fill(template: string, meta: ComponentMeta): string {
    return template
        .replaceAll('__NAME__', meta.name)
        .replaceAll('__PASCAL__', pascalCase(meta.name))
        .replaceAll('__CAMEL__', camelCase(meta.name))
        .replaceAll('__TITLE__', titleCase(meta.name))
        .replaceAll('__DESCRIPTION__', escapeDescription(meta.description));
}

// ── Templates: component ────────────────────────────────────────────────

const COMPONENT_TS_SIMPLE = `import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const __CAMEL__Variants = cva(
    'flex w-full flex-wrap items-center gap-2 rounded-md border p-3 sm:p-4 text-sm',
    {
        variants: {
            variant: {
                default: 'border-border bg-card text-card-foreground',
                muted: 'border-transparent bg-muted text-muted-foreground',
                outline: 'border-border bg-transparent text-foreground',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export type __PASCAL__Variant = NonNullable<VariantProps<typeof __CAMEL__Variants>['variant']>;

/**
 * __TITLE__ — __DESCRIPTION__
 *
 * Usage: <ui-__NAME__ label="__TITLE__" /> or project content into it.
 */
@Component({
    selector: 'ui-__NAME__',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './__NAME__.component.html',
    host: { class: 'contents' },
})
export class __PASCAL__Component {
    readonly variant = input<__PASCAL__Variant>('default');
    /** Text rendered when no content is projected. */
    readonly label = input('');
    readonly class = input('');

    readonly classes = computed(() => cn(
        __CAMEL__Variants({ variant: this.variant() }),
        this.class(),
    ));
}

export { __CAMEL__Variants };
`;

const COMPONENT_TS_COMPOUND = `import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

/**
 * __TITLE__ — __DESCRIPTION__
 *
 * Container for <ui-__NAME__-item> children.
 */
@Component({
    selector: 'ui-__NAME__',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './__NAME__.component.html',
    host: { class: 'contents' },
})
export class __PASCAL__Component {
    readonly class = input('');

    readonly classes = computed(() => cn(
        'flex w-full flex-col gap-3 sm:gap-4',
        this.class(),
    ));
}
`;

const COMPONENT_HTML_SIMPLE = `<div [class]="classes()" [attr.data-slot]="'__NAME__'">
    @if (label()) {
        <span class="max-w-[180px] truncate sm:max-w-none">{{ label() }}</span>
    }
    <ng-content />
</div>
`;

const COMPONENT_HTML_COMPOUND = `<div [class]="classes()" [attr.data-slot]="'__NAME__'">
    <ng-content />
</div>
`;

const ITEM_TS = `import {
    Component,
    ChangeDetectionStrategy,
    contentChild,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { __PASCAL__ContentComponent } from './__NAME__-content.component';

/**
 * A single __TITLE__ entry. Dual-mode: renders \`title\`/\`description\` by
 * default, and steps aside entirely when a <ui-__NAME__-content> is projected
 * into it.
 */
@Component({
    selector: 'ui-__NAME__-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './__NAME__-item.component.html',
    host: { class: 'contents' },
})
export class __PASCAL__ItemComponent {
    readonly title = input('');
    readonly description = input('');
    readonly class = input('');

    private readonly customContent = contentChild(__PASCAL__ContentComponent);

    readonly hasCustomContent = computed(() => this.customContent() !== undefined);

    /** Simple mode: the input-driven defaults are rendered only when nothing is projected. */
    readonly showDefaults = computed(() => !this.hasCustomContent());

    readonly classes = computed(() => cn(
        'flex w-full flex-col gap-1 rounded-md border border-border p-3 sm:p-4',
        this.class(),
    ));
}
`;

// A single <ng-content> that is always rendered: Angular projects content into
// the first slot instantiated, so putting one <ng-content> in each branch of an
// @if/@else silently drops the projected nodes. The defaults are what toggles.
const ITEM_HTML = `<div [class]="classes()" [attr.data-slot]="'__NAME__-item'">
    @if (showDefaults()) {
        @if (title()) {
            <span class="text-sm font-medium text-foreground">{{ title() }}</span>
        }
        @if (description()) {
            <span class="text-sm text-muted-foreground">{{ description() }}</span>
        }
    }
    <ng-content />
</div>
`;

const CONTENT_TS = `import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/** Projection slot that switches its parent \`ui-__NAME__-item\` into custom mode. */
@Component({
    selector: 'ui-__NAME__-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './__NAME__-content.component.html',
    host: { class: 'contents' },
})
export class __PASCAL__ContentComponent {
    readonly class = input('');

    readonly classes = computed(() => cn('flex w-full flex-col gap-1', this.class()));
}
`;

const CONTENT_HTML = `<div [class]="classes()" [attr.data-slot]="'__NAME__-content'">
    <ng-content />
</div>
`;

const BARREL_SIMPLE = `export * from './__NAME__.component';
`;

const BARREL_COMPOUND = `export * from './__NAME__.component';
export * from './sub/__NAME__-item.component';
export * from './sub/__NAME__-content.component';
`;

export function renderComponentTs(meta: ComponentMeta): string {
    return fill(meta.compound ? COMPONENT_TS_COMPOUND : COMPONENT_TS_SIMPLE, meta);
}

export function renderComponentHtml(meta: ComponentMeta): string {
    return fill(meta.compound ? COMPONENT_HTML_COMPOUND : COMPONENT_HTML_SIMPLE, meta);
}

export function renderItemTs(meta: ComponentMeta): string {
    return fill(ITEM_TS, meta);
}

export function renderItemHtml(meta: ComponentMeta): string {
    return fill(ITEM_HTML, meta);
}

export function renderContentTs(meta: ComponentMeta): string {
    return fill(CONTENT_TS, meta);
}

export function renderContentHtml(meta: ComponentMeta): string {
    return fill(CONTENT_HTML, meta);
}

export function renderBarrel(meta: ComponentMeta): string {
    return fill(meta.compound ? BARREL_COMPOUND : BARREL_SIMPLE, meta);
}

// ── Templates: spec ─────────────────────────────────────────────────────

const SPEC_SIMPLE = `import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { __PASCAL__Component, type __PASCAL__Variant } from './__NAME__.component';

@Component({
    template: \`
        <ui-__NAME__ [variant]="variant()" [label]="label()" [class]="'custom-class'" />
        <ui-__NAME__><span class="projected">Projected</span></ui-__NAME__>
    \`,
    imports: [__PASCAL__Component],
})
class TestHostComponent {
    readonly variant = signal<__PASCAL__Variant>('default');
    readonly label = signal('Hello');
}

describe('__PASCAL__Component', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    function firstRoot(): HTMLElement {
        return fixture.debugElement.queryAll(By.css('[data-slot="__NAME__"]'))[0].nativeElement as HTMLElement;
    }

    it('renders the label and merges the class input onto the data-slot element', () => {
        const root = firstRoot();
        expect(root.textContent).toContain('Hello');
        expect(root.className).toContain('custom-class');
    });

    it('reacts to the variant input', () => {
        expect(firstRoot().className).toContain('bg-card');

        fixture.componentInstance.variant.set('muted');
        fixture.detectChanges();

        const root = firstRoot();
        expect(root.className).toContain('bg-muted');
        expect(root.className).not.toContain('bg-card');
    });

    it('projects content', () => {
        const roots = fixture.debugElement.queryAll(By.css('[data-slot="__NAME__"]'));
        expect((roots[1].nativeElement as HTMLElement).querySelector('.projected')).toBeTruthy();
    });
});
`;

const SPEC_COMPOUND = `import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { __PASCAL__Component } from './__NAME__.component';
import { __PASCAL__ItemComponent } from './sub/__NAME__-item.component';
import { __PASCAL__ContentComponent } from './sub/__NAME__-content.component';

@Component({
    template: \`
        <ui-__NAME__ [class]="'custom-root'">
            <ui-__NAME__-item title="Simple title" description="Simple description" />
            <ui-__NAME__-item title="Ignored title">
                <ui-__NAME__-content>
                    <p class="projected">Projected body</p>
                </ui-__NAME__-content>
            </ui-__NAME__-item>
        </ui-__NAME__>
    \`,
    imports: [__PASCAL__Component, __PASCAL__ItemComponent, __PASCAL__ContentComponent],
})
class TestHostComponent {}

describe('__PASCAL__Component', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('exposes a data-slot hook and merges the class input', () => {
        const root = fixture.debugElement.query(By.css('[data-slot="__NAME__"]'));
        expect(root).toBeTruthy();
        expect(root.nativeElement.className).toContain('custom-root');
    });

    it('renders title and description in simple mode', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="__NAME__-item"]'));
        expect(items[0].nativeElement.textContent).toContain('Simple title');
        expect(items[0].nativeElement.textContent).toContain('Simple description');
    });

    it('suppresses the simple-mode defaults when content is projected', () => {
        const items = fixture.debugElement.queryAll(By.directive(__PASCAL__ItemComponent));
        expect(items[1].componentInstance.hasCustomContent()).toBe(true);
        const host = items[1].nativeElement as HTMLElement;
        expect(host.querySelector('.projected')).toBeTruthy();
        expect(host.textContent).not.toContain('Ignored title');
    });
});
`;

export function renderSpec(meta: ComponentMeta): string {
    return fill(meta.compound ? SPEC_COMPOUND : SPEC_SIMPLE, meta);
}

// ── Templates: stories ──────────────────────────────────────────────────

const STORIES_SIMPLE = `import { Meta, StoryObj } from '@storybook/angular';
import { __PASCAL__Component } from './__NAME__.component';

// Every input is an interactive control (argTypes) with a sensible default
// (args); the Playground binds all of them so the Controls panel drives the
// live component. Dedicated stories capture each distinct visual mode.
const meta: Meta<__PASCAL__Component> = {
    title: 'UI/__TITLE__',
    component: __PASCAL__Component,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'muted', 'outline'],
            description: 'Visual style.',
        },
        label: { control: 'text', description: 'Text rendered when no content is projected.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        variant: 'default',
        label: '__TITLE__',
        class: '',
    },
};

export default meta;
type Story = StoryObj<__PASCAL__Component>;

const TEMPLATE = \`
    <ui-__NAME__ [variant]="variant" [label]="label" [class]="class" />\`;

const render: NonNullable<Story['render']> = (args) => ({ props: args, template: TEMPLATE });

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Variants: Story = {
    render: (args) => ({
        props: args,
        template: \`
            <div class="flex flex-col gap-3">
                <ui-__NAME__ variant="default" label="Default" />
                <ui-__NAME__ variant="muted" label="Muted" />
                <ui-__NAME__ variant="outline" label="Outline" />
            </div>\`,
    }),
};

export const ProjectedContent: Story = {
    render: (args) => ({
        props: args,
        template: \`
            <ui-__NAME__ [variant]="variant" [class]="class">
                <strong class="text-primary">Projected content</strong>
            </ui-__NAME__>\`,
    }),
};
`;

const STORIES_COMPOUND = `import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { __PASCAL__Component } from './__NAME__.component';
import { __PASCAL__ItemComponent } from './sub/__NAME__-item.component';
import { __PASCAL__ContentComponent } from './sub/__NAME__-content.component';

// Every input is an interactive control (argTypes) with a sensible default
// (args); the Playground binds all of them so the Controls panel drives the
// live component.
const meta: Meta<__PASCAL__Component> = {
    title: 'UI/__TITLE__',
    component: __PASCAL__Component,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({ imports: [__PASCAL__ItemComponent, __PASCAL__ContentComponent] }),
    ],
    argTypes: {
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        class: '',
    },
};

export default meta;
type Story = StoryObj<__PASCAL__Component>;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: \`
            <ui-__NAME__ [class]="class">
                <ui-__NAME__-item title="First" description="Simple mode — driven by inputs." />
                <ui-__NAME__-item title="Second" description="Another input-driven item." />
            </ui-__NAME__>\`,
    }),
};

/** Custom mode — a projected ui-__NAME__-content overrides the defaults. */
export const CustomContent: Story = {
    render: (args) => ({
        props: args,
        template: \`
            <ui-__NAME__ [class]="class">
                <ui-__NAME__-item title="Simple" description="Input-driven." />
                <ui-__NAME__-item>
                    <ui-__NAME__-content>
                        <strong class="text-primary">Fully custom</strong>
                        <p class="text-sm text-muted-foreground">Anything can go here.</p>
                    </ui-__NAME__-content>
                </ui-__NAME__-item>
            </ui-__NAME__>\`,
    }),
};
`;

export function renderStories(meta: ComponentMeta): string {
    return fill(meta.compound ? STORIES_COMPOUND : STORIES_SIMPLE, meta);
}

// ── Templates: demo page ────────────────────────────────────────────────

const DEMO_SIMPLE = `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { __PASCAL__Component } from '../../../../../packages/components/ui/__NAME__';

@Component({
  selector: 'app-__NAME__-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [__PASCAL__Component],
  template: \`
    <section class="space-y-4">
      <h2 id="__NAME__" class="text-2xl font-semibold scroll-m-20">__TITLE__</h2>
      <p class="text-muted-foreground">__DESCRIPTION__</p>

      <div class="flex flex-col gap-3">
        <ui-__NAME__ variant="default" label="Default" />
        <ui-__NAME__ variant="muted" label="Muted" />
        <ui-__NAME__ variant="outline" label="Outline" />
        <ui-__NAME__ variant="default">
          <strong class="text-primary">Projected content</strong>
        </ui-__NAME__>
      </div>
    </section>
  \`,
})
export class __PASCAL__DemoComponent {}
`;

const DEMO_COMPOUND = `import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  __PASCAL__Component,
  __PASCAL__ItemComponent,
  __PASCAL__ContentComponent,
} from '../../../../../packages/components/ui/__NAME__';

@Component({
  selector: 'app-__NAME__-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [__PASCAL__Component, __PASCAL__ItemComponent, __PASCAL__ContentComponent],
  template: \`
    <section class="space-y-4">
      <h2 id="__NAME__" class="text-2xl font-semibold scroll-m-20">__TITLE__</h2>
      <p class="text-muted-foreground">__DESCRIPTION__</p>

      <ui-__NAME__>
        <ui-__NAME__-item title="Simple mode" description="Driven entirely by inputs." />
        <ui-__NAME__-item>
          <ui-__NAME__-content>
            <strong class="text-primary">Custom mode</strong>
            <p class="text-sm text-muted-foreground">Projected content takes over.</p>
          </ui-__NAME__-content>
        </ui-__NAME__-item>
      </ui-__NAME__>
    </section>
  \`,
})
export class __PASCAL__DemoComponent {}
`;

export function renderDemo(meta: ComponentMeta): string {
    return fill(meta.compound ? DEMO_COMPOUND : DEMO_SIMPLE, meta);
}

// ── Overwrite guard ─────────────────────────────────────────────────────

/**
 * Every planned destination that already exists on disk. Guarding only
 * `ui/<name>/` is not enough: the demo page lives in a different tree
 * (`demo/src/app/demos/**`) and 51 ORPHAN demo pages exist today, so a name
 * whose demo page exists but whose ui/ folder does not would be silently
 * overwritten.
 *
 * @param destinations every file the generator would write
 * @param exists       filesystem probe (injected so this stays unit-testable)
 */
export function existingDestinations(
    destinations: readonly string[],
    exists: (file: string) => boolean,
): string[] {
    return destinations.filter(exists);
}

// ── Source rewrites ─────────────────────────────────────────────────────

export class InsertError extends Error {}

/**
 * Appends a lazy route to the section matching the component's category. The
 * hand-registration this replaces is the step that got skipped 51 times.
 */
export function insertRoute(source: string, meta: ComponentMeta): string {
    const { folder, section } = demoLocation(meta.category);
    const modulePath = `./demos/${folder}/${meta.name}-demo.component`;
    if (source.includes(modulePath)) {
        throw new InsertError(`demo.routes.ts already routes ${meta.name}`);
    }
    const symbol = `${pascalCase(meta.name)}DemoComponent`;
    const line = `  { path: '${meta.name}', loadComponent: () => import('${modulePath}').then(m => m.${symbol}) },`;
    return insertIntoSection(source, `// ${section}`, line, 'demo.routes.ts');
}

/** Keeps `demos/index.ts` in step with the routes file. */
export function insertDemoExport(source: string, meta: ComponentMeta): string {
    const { folder, section } = demoLocation(meta.category);
    const modulePath = `./${folder}/${meta.name}-demo.component`;
    if (source.includes(modulePath)) {
        throw new InsertError(`demos/index.ts already exports ${meta.name}`);
    }
    const line = `export { ${pascalCase(meta.name)}DemoComponent } from '${modulePath}';`;
    return insertIntoSection(source, `// ${section}`, line, 'demos/index.ts');
}

/**
 * Inserts `line` at the end of the block of consecutive non-blank lines that
 * follows the `// <Section>` header.
 */
function insertIntoSection(source: string, header: string, line: string, file: string): string {
    const lines = source.split('\n');
    const start = lines.findIndex(l => l.trim() === header);
    if (start < 0) throw new InsertError(`section "${header}" not found in ${file}`);

    let end = start + 1;
    while (end < lines.length && lines[end].trim() !== '' && !lines[end].trim().startsWith('//')) {
        end++;
    }
    lines.splice(end, 0, line);
    return lines.join('\n');
}

const ENTRY_KEY = /^ {2}(?:'([a-z0-9-]+)'|([a-z][A-Za-z0-9]*)): \{$/;

/**
 * Inserts a registry entry (name + human fields + a seed `files` array) in
 * alphabetical order. `sync-registry --fix`, chained right after, re-derives
 * `files` / `libFiles` / `dependencies` — it never invents the human fields,
 * which is exactly why they are written here.
 */
export function insertRegistryEntry(source: string, meta: ComponentMeta): string {
    const lines = source.split('\n');
    if (lines.some(l => keyOf(l) === meta.name)) {
        throw new InsertError(`registry already has an entry for "${meta.name}"`);
    }
    const insertAt = findAlphabeticalSlot(lines, meta.name);
    if (insertAt < 0) throw new InsertError('could not locate the registry object literal');

    const key = meta.name.includes('-') ? `'${meta.name}'` : meta.name;
    const tags = meta.tags.map(quote).join(', ');
    const files = seedFiles(meta).map(quote).join(', ');
    const description = meta.description.replaceAll('\\', String.raw`\\`).replaceAll("'", String.raw`\'`);
    const entry = [
        `  ${key}: {`,
        `    name: '${meta.name}',`,
        `    category: '${meta.category}',`,
        `    description: '${description}',`,
        `    tags: [${tags}],`,
        `    files: [${files}],`,
        '  },',
    ];
    lines.splice(insertAt, 0, ...entry);
    return lines.join('\n');
}

function quote(value: string): string {
    return `'${value}'`;
}

function seedFiles(meta: ComponentMeta): string[] {
    const files = [
        `${meta.name}/index.ts`,
        `${meta.name}/${meta.name}.component.html`,
        `${meta.name}/${meta.name}.component.ts`,
    ];
    if (meta.compound) {
        files.push(
            `${meta.name}/sub/${meta.name}-content.component.html`,
            `${meta.name}/sub/${meta.name}-content.component.ts`,
            `${meta.name}/sub/${meta.name}-item.component.html`,
            `${meta.name}/sub/${meta.name}-item.component.ts`,
        );
    }
    return files.sort((a, b) => a.localeCompare(b));
}

function keyOf(line: string): string | null {
    const m = ENTRY_KEY.exec(line);
    if (!m) return null;
    return m[1] ?? m[2];
}

/**
 * The line index the new entry should be spliced at: before the first top-level
 * key that sorts after `name`, or before the registry object's closing `});`.
 */
function findAlphabeticalSlot(lines: readonly string[], name: string): number {
    const start = lines.findIndex(l => l.startsWith('export const registry = defineRegistry({'));
    if (start < 0) return -1;

    for (let i = start + 1; i < lines.length; i++) {
        if (lines[i].startsWith('});')) return i;
        const key = keyOf(lines[i]);
        if (key && key.localeCompare(name) > 0) return i;
    }
    return -1;
}
