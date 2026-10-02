// demo/src/app/docs/recipes.spec.ts
//
// The rendered half of T-12. The compile proof lives in
// `e2e/cli-specs/recipes.ts`, which builds every recipe in a pristine consumer
// app; this covers what the page does with the generated payload.
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideUiLocale } from '../../../../packages/components/lib/i18n';
import { DEMO_ROUTES } from '../demo.routes';
import { DOCS_LOCALES } from './docs.locales';
import { RecipesComponent, RECIPES_URL } from './recipes.component';
import { isRecipes, type Recipes } from './recipes.types';

const TEST_RECIPES_URL = '/demo/public/recipes.json';

async function loadPayload(): Promise<Recipes> {
    const response = await fetch(TEST_RECIPES_URL);
    const payload: unknown = await response.json();
    if (!isRecipes(payload)) throw new Error('recipes.json failed its own guard');
    return payload;
}

async function render(locale?: string) {
    TestBed.configureTestingModule({
        providers: [
            provideZonelessChangeDetection(),
            provideRouter(DEMO_ROUTES),
            { provide: RECIPES_URL, useValue: TEST_RECIPES_URL },
            ...(locale ? [provideUiLocale(locale)] : []),
        ],
    });
    const fixture = TestBed.createComponent(RecipesComponent);
    fixture.detectChanges();
    await fixture.componentInstance.ready;
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
}

describe('recipes.json', () => {
    it('is served and passes the app\'s own shape guard', async () => {
        const payload = await loadPayload();
        expect(payload.version).toBe(1);
        expect(payload.recipes.length).toBeGreaterThanOrEqual(4);
    });

    it('rejects a payload the generator did not write', () => {
        expect(isRecipes({ version: 2, recipes: [] })).toBe(false);
        expect(isRecipes({ version: 1, recipes: [{ id: 'x' }] })).toBe(false);
        expect(isRecipes(null)).toBe(false);
    });
});

describe('RecipesComponent', () => {
    it('renders every recipe with its title, summary, source, one install command and a copy control', async () => {
        const fixture = await render();
        const payload = await loadPayload();
        const host = fixture.nativeElement as HTMLElement;
        const text = host.textContent ?? '';

        expect(host.querySelectorAll('[data-slot="recipe"]')).toHaveLength(payload.recipes.length);
        const commands = [...host.querySelectorAll('[data-slot="recipe-install"]')]
            .map(node => node.textContent?.trim());
        for (const recipe of payload.recipes) {
            expect(text).toContain(recipe.title);
            expect(text).toContain(recipe.summary);
            // The source, not a paraphrase of it.
            expect(text).toContain(recipe.code.split('\n')[0]);
            // One command covering all of the recipe's components.
            expect(commands).toContain(recipe.install);
        }
        expect(host.querySelectorAll('[data-slot="copy-recipe-install"]')).toHaveLength(payload.recipes.length);
    });

    it('links each component badge to that component\'s docs page', async () => {
        const fixture = await render();
        const link = (fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="recipe"] a');
        expect(link?.getAttribute('href')).toMatch(/^\/docs\//);
    });

    it('translates its own labels', async () => {
        const fixture = await render('ja');
        expect((fixture.nativeElement as HTMLElement).textContent)
            .toContain(DOCS_LOCALES['ja'].recipesHeading);
    });

    it('shows a placeholder rather than an empty page when the payload is missing', async () => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideRouter(DEMO_ROUTES),
                { provide: RECIPES_URL, useValue: '/definitely-not-here.json' },
            ],
        });
        const fixture = TestBed.createComponent(RecipesComponent);
        fixture.detectChanges();
        await fixture.componentInstance.ready;
        await fixture.whenStable();
        fixture.detectChanges();

        expect((fixture.nativeElement as HTMLElement)
            .querySelector('[data-slot="recipes-empty"]')).not.toBeNull();
    });
});
