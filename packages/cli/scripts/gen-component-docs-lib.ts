/**
 * Builder for `demo/public/component-docs.json` — the data behind the demo
 * app's docs surfaces.
 *
 * The demo app already owns a route per component and a working live preview.
 * What it lacked was the rest of a documentation page: the install command, the
 * canonical import, a copy-paste snippet, and an API table. All four are
 * derived here from sources that are already maintained for other reasons:
 *
 *   - `registry.json` — names, descriptions, categories, dependency closures.
 *   - `api-docs.json` — the compodoc extract: selectors, class names,
 *     inputs/outputs with types and JSDoc.
 *   - `demo/src/app/demo.routes.ts` + the demo component sources — which route
 *     previews which component, discovered by reading the classes each demo
 *     imports rather than by maintaining a route→component table by hand.
 *
 * That last point matters: 62 of the 153 components have no route named after
 * them (every chart shares `/charts`, every text effect shares `/animations`,
 * the rich-text addons share one page). A hand-written alias table would drift
 * the first time a demo moved. Reading the imports cannot.
 *
 * Pure — no IO. `gen-component-docs.ts` supplies the file contents.
 */
import {
    CLI_PACKAGE,
    importPathFor,
    indexDocClasses,
    primaryClassFor,
    snippetFor,
    corpusNames,
    type RegistryEntry,
    type RegistryJson,
} from './gen-llms-lib.js';
import type { ApiClass, ApiDocs, ApiMember } from './gen-api-docs-lib.js';

/** Repo the StackBlitz import links point at. */
export const REPO_SLUG = 'gilav21/shadcn-angular';

const UI_SOURCE_ROOT = 'packages/components/ui/';

/** One demo route, as parsed from `demo.routes.ts`. */
export interface DemoRoute {
    /** Route path (`''` for the introduction page). */
    readonly path: string;
    /** Module specifier the route lazy-loads, relative to `demo/src/app/`. */
    readonly module: string;
}

/** A demo route plus the library classes its component file imports. */
export interface DemoRouteSource extends DemoRoute {
    /** Repo-relative path of the demo component file. */
    readonly file: string;
    readonly importedClasses: readonly string[];
}

/** One row of a rendered API table. */
export type ApiTableRow = ApiMember;

/** The API surface of a single class inside a component's folder. */
export interface ApiTable {
    readonly className: string;
    /**
     * Repo-relative source file. Class names are NOT unique across the library
     * — `DataTableContextMenuDirective` exists both as a standalone directive
     * and as a data-table addon — so this is the only stable identity a table
     * has, and the only safe key for tracing a row back to the extract.
     */
    readonly file: string;
    readonly kind: 'component' | 'directive';
    readonly selector: string;
    readonly description: string;
    readonly inputs: readonly ApiTableRow[];
    readonly outputs: readonly ApiTableRow[];
}

/** Everything the demo app needs to render one component's documentation. */
export interface ComponentDoc {
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly install: string;
    readonly importStatement: string | null;
    readonly selector: string | null;
    readonly dependencies: readonly string[];
    readonly npmDependencies: readonly string[];
    readonly snippet: string | null;
    readonly snippetSkipReason: string;
    /** Demo route that previews this component, or null when none does. */
    readonly demoRoute: string | null;
    /** Repo-relative demo source file backing `demoRoute`. */
    readonly demoFile: string | null;
    /** StackBlitz import link for `demoFile`, or null when there is no demo. */
    readonly stackblitz: string | null;
    readonly api: readonly ApiTable[];
}

/** The committed payload the demo app fetches. */
export interface ComponentDocs {
    /** Bumped when the shape changes, so a stale fetch fails loudly. */
    readonly version: 1;
    readonly components: readonly ComponentDoc[];
}

// ---------------------------------------------------------------------------
// Parsing the demo app
// ---------------------------------------------------------------------------

const ROUTE_ENTRY = /path:\s*'([^']*)'[\s\S]{0,200}?import\('([^']+)'\)/g;

/** Every lazy route in `demo.routes.ts`, in file order. */
export function parseDemoRoutes(source: string): DemoRoute[] {
    return [...source.matchAll(ROUTE_ENTRY)].map(m => ({ path: m[1], module: m[2] }));
}

const CLASS_IMPORT = /import\s*(?:type\s*)?\{([^}]*)}\s*from\s*'([^']*)'/g;

/**
 * The EXPORTED name in one import specifier — that is what identifies the class
 * in the extract, so `Foo as Bar` yields `Foo`. Handles the inline type form
 * (`type Foo`) too. Split on whitespace rather than matching `as` with a
 * quantifier, which would backtrack on pathological input.
 */
function specifierName(raw: string): string | undefined {
    const parts = raw.trim().split(/\s+/).filter(part => part !== '');
    if (parts.length === 0) return undefined;
    return parts[0] === 'type' ? parts[1] : parts[0];
}

/**
 * Identifiers a demo file imports from the component library, whether through
 * the package barrel (`../../packages/components/ui`) or the consumer alias
 * (`@/components/ui/...`). Type-only imports count: a demo that imports a
 * component's data type is still previewing that component.
 */
export function parseImportedClasses(source: string): string[] {
    const names = new Set<string>();
    for (const match of source.matchAll(CLASS_IMPORT)) {
        const specifier = match[2];
        const isLibrary = specifier.includes('packages/components/ui')
            || specifier.includes('@/components/ui');
        if (!isLibrary) continue;
        for (const raw of match[1].split(',')) {
            const name = specifierName(raw);
            if (name !== undefined) names.add(name);
        }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * A StackBlitz import of this repository, opened on the demo source file.
 * Deliberately a plain URL: adding the StackBlitz SDK would mean a new runtime
 * dependency, which this library does not take.
 */
export function stackblitzUrl(demoFile: string, branch = 'master'): string {
    return `https://stackblitz.com/github/${REPO_SLUG}/tree/${branch}` +
        `?file=${encodeURIComponent(demoFile)}`;
}

// ---------------------------------------------------------------------------
// Route ↔ component resolution
// ---------------------------------------------------------------------------

/** Map every exported library class name to the registry entry that ships it. */
export function classOwners(
    registry: RegistryJson, docs: ApiDocs,
): ReadonlyMap<string, string> {
    const fileOwner = new Map<string, string>();
    for (const name of corpusNames(registry)) {
        for (const file of registry[name].files) {
            fileOwner.set(UI_SOURCE_ROOT + file, name);
        }
    }
    const owners = new Map<string, string>();
    for (const cls of docs.classes) {
        const owner = fileOwner.get(cls.file);
        if (owner !== undefined && !owners.has(cls.name)) owners.set(cls.name, owner);
    }
    return owners;
}

/**
 * How well a route represents a component. Lower is better.
 *
 * Import-based discovery alone picks the wrong page surprisingly often: the
 * spinner demo imports `ButtonComponent` and appears earlier in the route list
 * than the button demo, so plain "first importer wins" documents the button on
 * the spinner page. These tiers put the component's own page first, and they
 * are all derived from names already on disk — there is no alias table to
 * maintain.
 */
export function scoreRoute(route: DemoRoute, name: string): number {
    if (route.path === name) return 0;
    const base = route.module.split('/').pop() ?? '';
    const stem = name.split('/').pop() as string;
    if (base === `${name}-demo.component` || base === `${stem}-demo.component`) return 1;
    if (route.path === `${name}s` || `${route.path}s` === name) return 2;
    if (route.path.startsWith(`${name}-`)) return 3;
    return 4;
}

/**
 * The route that previews each component: the best-scoring route among those
 * whose demo file imports one of the component's classes, ties broken by
 * `demo.routes.ts` order so the result is stable.
 */
export function resolveDemoRoutes(
    registry: RegistryJson,
    docs: ApiDocs,
    routes: readonly DemoRouteSource[],
): ReadonlyMap<string, DemoRouteSource> {
    const owners = classOwners(registry, docs);
    const best = new Map<string, { route: DemoRouteSource; score: number }>();

    routes.forEach(route => {
        const owned = new Set<string>();
        for (const className of route.importedClasses) {
            const owner = owners.get(className);
            if (owner !== undefined) owned.add(owner);
        }
        if (route.path !== '' && registry[route.path] !== undefined) owned.add(route.path);

        for (const name of owned) {
            const score = scoreRoute(route, name);
            const current = best.get(name);
            if (!current || score < current.score) best.set(name, { route, score });
        }
    });

    return new Map([...best].map(([name, { route }]) => [name, route]));
}

// ---------------------------------------------------------------------------
// API tables
// ---------------------------------------------------------------------------

/**
 * Every documented class the component ships, sorted with the primary class
 * first so the page leads with the component the developer came for.
 */
export function apiTablesFor(
    entry: RegistryEntry,
    byFile: ReadonlyMap<string, readonly ApiClass[]>,
    primary: ApiClass | null,
): ApiTable[] {
    const classes = [...entry.files]
        .filter(f => f.endsWith('.ts'))
        .sort((a, b) => a.localeCompare(b))
        .flatMap(f => byFile.get(UI_SOURCE_ROOT + f) ?? [])
        .filter(cls => cls.selector !== '');

    const tables = classes.map(cls => ({
        className: cls.name,
        file: cls.file,
        kind: cls.kind,
        selector: cls.selector,
        description: cls.description,
        inputs: cls.inputs,
        outputs: cls.outputs,
    }));
    if (!primary) return tables;
    const isPrimary = (t: ApiTable): boolean =>
        t.file === primary.file && t.className === primary.name;
    return [...tables.filter(isPrimary), ...tables.filter(t => !isPrimary(t))];
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/** Build the whole payload. Deterministic: sorted by name, no clock, no IO. */
export function buildComponentDocs(
    registry: RegistryJson,
    docs: ApiDocs,
    routes: readonly DemoRouteSource[],
): ComponentDocs {
    const byFile = indexDocClasses(docs);
    const demoRoutes = resolveDemoRoutes(registry, docs, routes);

    const components = corpusNames(registry).map<ComponentDoc>(name => {
        const entry = registry[name];
        const primary = primaryClassFor(entry, byFile);
        const { snippet, reason } = snippetFor(primary);
        const route = demoRoutes.get(name);
        return {
            name,
            description: entry.description ?? '',
            category: entry.category ?? 'utility',
            install: `npx ${CLI_PACKAGE}@latest add ${name}`,
            importStatement: primary
                ? `import { ${primary.name} } from '${importPathFor(entry)}';`
                : null,
            selector: primary?.selector ?? null,
            dependencies: [...(entry.dependencies ?? [])].sort((a, b) => a.localeCompare(b)),
            npmDependencies: [...(entry.npmDependencies ?? [])].sort((a, b) => a.localeCompare(b)),
            snippet,
            snippetSkipReason: reason,
            demoRoute: route?.path ?? null,
            demoFile: route?.file ?? null,
            stackblitz: route ? stackblitzUrl(route.file) : null,
            api: apiTablesFor(entry, byFile, primary),
        };
    });

    return { version: 1, components };
}

/** Serialize exactly as committed (stable, newline-terminated). */
export function serializeComponentDocs(docs: ComponentDocs): string {
    return JSON.stringify(docs, null, 2) + '\n';
}
