// demo/src/app/docs/docs-a11y.spec.ts
//
// T-14 from `specs/dx-distribution-spec.md` §2.1 — axe clean on the pages this
// bundle adds.
//
// The repo's existing axe pass runs over Storybook stories, which these pages
// have none of: they are demo-app routes, not library components. So axe runs
// here instead, against the real rendered DOM in the same Chromium the rest of
// the browser suite uses — a stricter check than a story snapshot, because the
// page is assembled from live generated data rather than fixed args.
import axe from 'axe-core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, type Type } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DEMO_ROUTES } from '../demo.routes';
import { COMPONENT_DOCS_URL, ComponentDocsService } from './component-docs.service';
import { DocsHeaderComponent } from './docs-header.component';
import { DocsPageComponent } from './docs-page.component';
import { RecipesComponent, RECIPES_URL } from './recipes.component';
import { ThemePlaygroundComponent } from './theme-playground.component';

const TEST_DOCS_URL = '/demo/public/component-docs.json';
const TEST_RECIPES_URL = '/demo/public/recipes.json';

function configure(): void {
    TestBed.configureTestingModule({
        providers: [
            provideZonelessChangeDetection(),
            provideRouter(DEMO_ROUTES),
            { provide: COMPONENT_DOCS_URL, useValue: TEST_DOCS_URL },
            { provide: RECIPES_URL, useValue: TEST_RECIPES_URL },
        ],
    });
}

/**
 * Library components that render their own scroll container. `ui-code-block`
 * and `ui-table` both do, and neither makes it keyboard-focusable, which axe
 * reports as `scrollable-region-focusable`.
 *
 * That is a real finding, but it belongs to those components — this bundle
 * documents and does not touch component source (spec §1.6). Excluding them
 * here keeps T-14 measuring the markup this bundle actually wrote; the
 * positive-control test below asserts the findings are still there, so the
 * exclusion turns into a failing test the moment they are fixed.
 */
const LIBRARY_OWNED = ['ui-code-block', 'ui-table'];

function isLibraryOwned(node: axe.NodeResult): boolean {
    const selector = node.target.join(' ');
    return LIBRARY_OWNED.some(tag => selector.includes(tag));
}

async function seriousViolations(host: HTMLElement): Promise<axe.Result[]> {
    const results = await axe.run(host, {
        // The fixture host is unstyled: the tokens that decide contrast come
        // from the app shell, so a contrast result here measures the harness.
        rules: { 'color-contrast': { enabled: false } },
    });
    return results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
}

/** Violations this bundle's own markup is responsible for. */
async function violations(host: HTMLElement): Promise<axe.Result[]> {
    const found = await seriousViolations(host);
    return found
        .map(v => ({ ...v, nodes: v.nodes.filter(n => !isLibraryOwned(n)) }))
        .filter(v => v.nodes.length > 0);
}

function describeViolations(found: readonly axe.Result[]): string {
    return found
        .map(v => `${v.id} (${v.impact}): ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
        .join('\n');
}

async function renderAndScan<T>(
    component: Type<T>, setInputs?: (ref: { setInput(name: string, value: unknown): void }) => void,
): Promise<axe.Result[]> {
    configure();
    await TestBed.inject(ComponentDocsService).load();
    const fixture = TestBed.createComponent(component);
    setInputs?.(fixture.componentRef);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    document.body.append(host);
    try {
        return await violations(host);
    } finally {
        host.remove();
    }
}

describe('T-14: axe on the new docs pages', () => {
    it('the docs block a demo page renders is clean', async () => {
        const found = await renderAndScan(DocsHeaderComponent, ref => {
            ref.setInput('route', 'buttons');
        });
        expect(describeViolations(found)).toBe('');
    });

    it('a generated component docs page is clean', async () => {
        const found = await renderAndScan(DocsPageComponent, ref => {
            ref.setInput('name', 'button');
        });
        expect(describeViolations(found)).toBe('');
    });

    it('a docs page for a component with no demo is clean', async () => {
        const found = await renderAndScan(DocsPageComponent, ref => {
            ref.setInput('name', 'data-table/pivot');
        });
        expect(describeViolations(found)).toBe('');
    });

    it('the recipes page is clean', async () => {
        expect(describeViolations(await renderAndScan(RecipesComponent))).toBe('');
    });

    it('the theme playground is clean', async () => {
        expect(describeViolations(await renderAndScan(ThemePlaygroundComponent))).toBe('');
    });

    it('still reports the library-owned findings, so the exclusion cannot hide a regression', async () => {
        configure();
        await TestBed.inject(ComponentDocsService).load();
        const fixture = TestBed.createComponent(DocsPageComponent);
        fixture.componentRef.setInput('name', 'button');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        document.body.append(host);
        try {
            const all = await seriousViolations(host);
            const scrollable = all.find(v => v.id === 'scrollable-region-focusable');
            // If this ever goes undefined, ui-code-block / ui-table have been
            // fixed — drop LIBRARY_OWNED and let T-14 assert the whole page.
            expect(scrollable).toBeDefined();
            expect(scrollable?.nodes.every(isLibraryOwned)).toBe(true);
        } finally {
            host.remove();
        }
    });

    it('the playground stays clean after the controls are used', async () => {
        configure();
        const fixture = TestBed.createComponent(ThemePlaygroundComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        host.querySelector<HTMLElement>('[data-theme-option="blue"] button')?.click();
        host.querySelector<HTMLElement>('[data-density-option="5"] button')?.click();
        fixture.componentInstance.dark.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        document.body.append(host);
        try {
            expect(describeViolations(await violations(host))).toBe('');
        } finally {
            host.remove();
        }
    });
});
