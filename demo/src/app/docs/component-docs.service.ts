import { InjectionToken, Injectable, inject, signal } from '@angular/core';
import { isComponentDocs, type ComponentDoc, type ComponentDocs } from './component-docs.types';

/** Where the generated payload is served from (demo `public/` is the site root). */
export const DEFAULT_COMPONENT_DOCS_URL = '/component-docs.json';

/**
 * URL the payload is fetched from. Overridable only so the test suite, whose
 * dev server has the repo root as its base, can point at the same file on disk.
 */
export const COMPONENT_DOCS_URL = new InjectionToken<string>('COMPONENT_DOCS_URL', {
    providedIn: 'root',
    factory: () => DEFAULT_COMPONENT_DOCS_URL,
});

/**
 * Loads `component-docs.json` once and indexes it.
 *
 * The payload is ~850 KB of generated API data, so it is fetched lazily rather
 * than bundled: a visitor who never opens a docs panel never downloads it. The
 * fetch is deduplicated, so the 113 demo routes and the `/docs/:name` pages all
 * share one request.
 */
@Injectable({ providedIn: 'root' })
export class ComponentDocsService {
    private readonly byName = signal<ReadonlyMap<string, ComponentDoc>>(new Map());
    private readonly byRoute = signal<ReadonlyMap<string, readonly ComponentDoc[]>>(new Map());
    private readonly failed = signal(false);
    private readonly settled = signal(false);
    private readonly url = inject(COMPONENT_DOCS_URL);
    private pending: Promise<void> | null = null;

    /** True once a load attempt finished without usable data. */
    readonly loadFailed = this.failed.asReadonly();

    /**
     * True once a load attempt has settled, successfully or not. Consumers use
     * it to tell "still loading" from "loaded, and this name is not a
     * component" — without keeping a duplicate flag of their own.
     */
    readonly loaded = this.settled.asReadonly();

    /** Every component, in generated (alphabetical) order. */
    readonly all = signal<readonly ComponentDoc[]>([]);

    /** Fetch the payload if it has not been fetched yet. Safe to call repeatedly. */
    load(): Promise<void> {
        this.pending ??= this.fetchOnce();
        return this.pending;
    }

    /** Documentation for a registry component name, once loaded. */
    forName(name: string): ComponentDoc | undefined {
        return this.byName().get(name);
    }

    /**
     * Components previewed by a demo route. A route can preview several (every
     * chart shares `/charts`), so this returns a list rather than one entry.
     */
    forRoute(route: string): readonly ComponentDoc[] {
        return this.byRoute().get(route) ?? [];
    }

    private async fetchOnce(): Promise<void> {
        try {
            const response = await fetch(this.url);
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            const payload: unknown = await response.json();
            if (!isComponentDocs(payload)) throw new Error('unexpected component-docs.json shape');
            this.index(payload);
        } catch {
            // A missing or malformed payload must not take the demo app down:
            // the docs panel simply does not render. The generator's `--check`
            // gate is where staleness is caught, not here.
            this.failed.set(true);
        } finally {
            this.settled.set(true);
        }
    }

    private index(payload: ComponentDocs): void {
        const names = new Map<string, ComponentDoc>();
        const routes = new Map<string, ComponentDoc[]>();
        for (const component of payload.components) {
            names.set(component.name, component);
            if (component.demoRoute === null) continue;
            const bucket = routes.get(component.demoRoute);
            if (bucket) bucket.push(component);
            else routes.set(component.demoRoute, [component]);
        }
        this.byName.set(names);
        this.byRoute.set(routes);
        this.all.set(payload.components);
        this.failed.set(false);
    }
}
