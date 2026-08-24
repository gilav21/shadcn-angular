// demo/src/app/docs/component-docs.spec.ts
//
// T-4, T-7 and T-8 from `specs/dx-distribution-spec.md` §2.1, plus the guard
// that keeps the demo app's view of `component-docs.json` in step with the
// generator that writes it.
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, type Type } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideUiLocale } from '../../../../packages/components/lib/i18n';
import { DEMO_ROUTES } from '../demo.routes';
import { ComponentDocsService, COMPONENT_DOCS_URL } from './component-docs.service';
import { isComponentDocs, type ComponentDoc, type ComponentDocs } from './component-docs.types';
import { DocsHeaderComponent } from './docs-header.component';
import { DocsPageComponent } from './docs-page.component';
import { DocsPanelComponent } from './docs-panel.component';
import { ChartsDemoComponent } from '../demos/charts/charts-demo.component';
import { AnimationsDemoComponent } from '../demos/animations/animations-demo.component';
import { DataTableDemoComponent } from '../demos/data-display/data-table-demo.component';
import { RichTextEditorDemoComponent } from '../demos/inputs/rich-text-editor-demo.component';
import { DOCS_LOCALES } from './docs.locales';

/**
 * The real committed payload. Fetched rather than imported so the test
 * exercises the same path the app does, including the runtime shape guard.
 */
const TEST_DOCS_URL = '/demo/public/component-docs.json';

async function loadPayload(): Promise<ComponentDocs> {
    const response = await fetch(TEST_DOCS_URL);
    const payload: unknown = await response.json();
    if (!isComponentDocs(payload)) throw new Error('component-docs.json failed its own guard');
    return payload;
}

function docFor(payload: ComponentDocs, name: string): ComponentDoc {
    const found = payload.components.find(c => c.name === name);
    if (!found) throw new Error(`no generated docs for "${name}"`);
    return found;
}

function configure(): void {
    TestBed.configureTestingModule({
        providers: [
            provideZonelessChangeDetection(),
            provideRouter(DEMO_ROUTES),
            { provide: COMPONENT_DOCS_URL, useValue: TEST_DOCS_URL },
        ],
    });
}

describe('component-docs.json', () => {
    it('is served, well-formed, and passes the app\'s own shape guard', async () => {
        const payload = await loadPayload();
        expect(payload.version).toBe(2);
        expect(payload.components.length).toBeGreaterThan(100);
    });

    it('rejects a payload the generator did not write', () => {
        expect(isComponentDocs({ version: 9, components: [] })).toBe(false);
        expect(isComponentDocs({ version: 2, components: [{ name: 'x' }] })).toBe(false);
        expect(isComponentDocs(null)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// T-4
// ---------------------------------------------------------------------------

describe('T-4: every component has a docs page', () => {
    it('routes /docs/:name to the generated documentation page', () => {
        const route = DEMO_ROUTES.find(r => r.path === 'docs/:name');
        expect(route).toBeDefined();
        expect(route?.loadComponent).toBeDefined();
    });

    it('resolves documentation for every component in the payload', async () => {
        configure();
        const service = TestBed.inject(ComponentDocsService);
        await service.load();
        const payload = await loadPayload();

        for (const component of payload.components) {
            expect(service.forName(component.name)).toBeDefined();
        }
    });

    it('renders a page for a component that has no demo route of its own', async () => {
        configure();
        await TestBed.inject(ComponentDocsService).load();
        const fixture = TestBed.createComponent(DocsPageComponent);
        fixture.componentRef.setInput('name', 'line-chart');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelector('[data-slot="docs-panel"]')).not.toBeNull();
        expect(host.textContent).toContain('add line-chart');
    });

    it('links a component with a shared demo route to that route', async () => {
        configure();
        await TestBed.inject(ComponentDocsService).load();
        const fixture = TestBed.createComponent(DocsPageComponent);
        fixture.componentRef.setInput('name', 'line-chart');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const link = (fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="demo-link"]');
        expect(link?.getAttribute('href')).toBe('/charts');
    });

    it('says so plainly when a name is not a component', async () => {
        configure();
        await TestBed.inject(ComponentDocsService).load();
        const fixture = TestBed.createComponent(DocsPageComponent);
        fixture.componentRef.setInput('name', 'not-a-component');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelector('[data-slot="docs-not-found"]')).not.toBeNull();
        expect(host.querySelector('[data-slot="docs-panel"]')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// T-7
// ---------------------------------------------------------------------------

describe('T-7: every demo page renders its add command', () => {
    it('shows the exact npx command for the route\'s component', async () => {
        configure();
        await TestBed.inject(ComponentDocsService).load();
        const fixture = TestBed.createComponent(DocsHeaderComponent);
        fixture.componentRef.setInput('route', 'buttons');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        const command = host.querySelector('[data-slot="install-command"]');
        expect(command?.textContent?.trim())
            .toBe('npx @gilav21/shadcn-angular@latest add button');
    });

    it('offers a copy control for the command', async () => {
        configure();
        await TestBed.inject(ComponentDocsService).load();
        const fixture = TestBed.createComponent(DocsHeaderComponent);
        fixture.componentRef.setInput('route', 'buttons');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const copy = (fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="copy-install"]');
        expect(copy).not.toBeNull();
        // `ui-button` renders the accessible name onto its inner <button>.
        expect(copy?.querySelector('button')?.getAttribute('aria-label'))
            .toContain('add button');
    });

    it('covers every demo route that previews a component', async () => {
        configure();
        const service = TestBed.inject(ComponentDocsService);
        await service.load();
        const payload = await loadPayload();

        const routes = new Set(
            payload.components
                .map(c => c.demoRoute)
                .filter((route): route is string => route !== null),
        );
        expect(routes.size).toBeGreaterThan(50);
        for (const route of routes) {
            const docs = service.forRoute(route);
            expect(docs.length).toBeGreaterThan(0);
            for (const doc of docs) {
                expect(doc.install).toBe(
                    `npx @gilav21/shadcn-angular@latest add ${doc.name}`,
                );
            }
        }
    });

    it('lists every component a shared route previews', async () => {
        configure();
        const service = TestBed.inject(ComponentDocsService);
        await service.load();
        const names = service.forRoute('charts').map(d => d.name);
        expect(names).toContain('line-chart');
        expect(names).toContain('pie-chart');
    });

    /**
     * The shell's block covers single-component routes. Four routes preview
     * many components at once — `/charts` previews 28 — and stacking 28 install
     * commands above the first chart meant scrolling half the page before
     * seeing one. Those pages document each component in its own section
     * instead, and the shell stands down there.
     *
     * That hand-off is the risk this test exists for: the shell going quiet is
     * invisible, so a component whose section forgets its block would simply
     * lose its install command with nothing failing. Assert the per-section
     * blocks are present and complete, by name, against the real payload.
     */
    describe('multi-component routes document each component in its own section', () => {
        // Typed as Type<unknown>: these are four unrelated components, and
        // without the annotation TS infers their union and refuses to hand it
        // to createComponent, which wants one concrete type.
        const PAGES: readonly { route: string; type: Type<unknown> }[] = [
            { route: 'charts', type: ChartsDemoComponent },
            { route: 'animations', type: AnimationsDemoComponent },
            { route: 'data-table', type: DataTableDemoComponent },
            { route: 'rich-text-editor', type: RichTextEditorDemoComponent },
        ];

        function renderedNames(host: HTMLElement): string[] {
            return [...host.querySelectorAll('app-docs-for')]
                .map(el => el.getAttribute('name') ?? '')
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
        }

        for (const page of PAGES) {
            it(`/${page.route} carries a block for every component it previews`, async () => {
                configure();
                const payload = await loadPayload();
                const expected = payload.components
                    .filter(c => c.demoRoute === page.route)
                    .map(c => c.name)
                    .sort((a, b) => a.localeCompare(b));

                // Positive control: this route must actually be a multi-component
                // one, or the test would pass while asserting nothing.
                expect(expected.length).toBeGreaterThan(1);

                const fixture = TestBed.createComponent(page.type);
                fixture.detectChanges();

                expect(renderedNames(fixture.nativeElement as HTMLElement)).toEqual(expected);
            });
        }

        it('the shell renders no block of its own on those routes', async () => {
            configure();
            await TestBed.inject(ComponentDocsService).load();
            const fixture = TestBed.createComponent(DocsHeaderComponent);
            fixture.componentRef.setInput('route', 'charts');
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            expect((fixture.nativeElement as HTMLElement)
                .querySelector('[data-slot="docs-header"]')).toBeNull();
        });
    });

    it('renders nothing on a route that previews no component', async () => {
        configure();
        await TestBed.inject(ComponentDocsService).load();
        const fixture = TestBed.createComponent(DocsHeaderComponent);
        fixture.componentRef.setInput('route', 'introduction');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect((fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="docs-header"]')).toBeNull();
    });
});


// ---------------------------------------------------------------------------
// Panel rendering
// ---------------------------------------------------------------------------

describe('DocsPanelComponent', () => {
    async function renderPanel(name: string, locale?: string) {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideRouter(DEMO_ROUTES),
                { provide: COMPONENT_DOCS_URL, useValue: TEST_DOCS_URL },
                ...(locale ? [provideUiLocale(locale)] : []),
            ],
        });
        const payload = await loadPayload();
        const fixture = TestBed.createComponent(DocsPanelComponent);
        fixture.componentRef.setInput('doc', docFor(payload, name));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    it('renders one API table per class the component ships', async () => {
        const host = await renderPanel('accordion');
        const payload = await loadPayload();
        expect(host.querySelectorAll('[data-slot="api-table"]'))
            .toHaveLength(docFor(payload, 'accordion').api.length);
    });

    it('renders an input row with its type and default', async () => {
        const host = await renderPanel('button');
        expect(host.textContent).toContain('variant');
        expect(host.textContent).toContain('ButtonVariant');
    });

    it('explains a missing snippet instead of leaving a gap', async () => {
        const payload = await loadPayload();
        const skipped = payload.components.find(c => c.snippet === null);
        expect(skipped).toBeDefined();
        const host = await renderPanel((skipped as ComponentDoc).name);
        expect(host.querySelector('[data-slot="no-snippet"]')?.textContent)
            .toContain((skipped as ComponentDoc).snippetSkipReason);
    });

    it('translates its own labels', async () => {
        const host = await renderPanel('button', 'de');
        expect(host.textContent).toContain(DOCS_LOCALES['de'].install);
        expect(host.textContent).not.toContain(DOCS_LOCALES['en'].apiReference);
    });

    it('has a translation for every locale the app offers', () => {
        const byName = (a: string, b: string): number => a.localeCompare(b);
        const keys = [...Object.keys(DOCS_LOCALES['en'])].sort(byName);
        for (const locale of Object.values(DOCS_LOCALES)) {
            expect([...Object.keys(locale)].sort(byName)).toEqual(keys);
            for (const value of Object.values(locale)) {
                expect(typeof value).toBe('string');
                expect((value as string).length).toBeGreaterThan(0);
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Service behaviour
// ---------------------------------------------------------------------------

describe('ComponentDocsService', () => {
    it('fetches the payload only once no matter how many callers ask', async () => {
        configure();
        const service = TestBed.inject(ComponentDocsService);
        const spy = vi.spyOn(globalThis, 'fetch');
        await Promise.all([service.load(), service.load(), service.load()]);
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it('degrades to no docs rather than breaking the app when the fetch fails', async () => {
        configure();
        const service = TestBed.inject(ComponentDocsService);
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response('nope', { status: 404 }));

        await service.load();
        expect(service.loadFailed()).toBe(true);
        expect(service.forName('button')).toBeUndefined();
        spy.mockRestore();
    });

    it('rejects a payload whose shape it does not recognise', async () => {
        configure();
        const service = TestBed.inject(ComponentDocsService);
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response(JSON.stringify({ version: 7 }), { status: 200 }));

        await service.load();
        expect(service.loadFailed()).toBe(true);
        spy.mockRestore();
    });
});
