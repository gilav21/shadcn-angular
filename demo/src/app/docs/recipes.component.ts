import {
    ChangeDetectionStrategy,
    Component,
    InjectionToken,
    computed,
    inject,
    signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
    BadgeComponent,
    ButtonComponent,
    CodeBlockComponent,
    IconComponent,
} from '../../../../packages/components/ui';
// Not re-exported by the `ui` barrel — the flat directives are imported by path.
import { CopyToDirective } from '../../../../packages/components/ui/directives/copy-to.directive';
import { UI_LOCALE_ID } from '../../../../packages/components/lib/i18n';
import { DOCS_LOCALES } from './docs.locales';
import { isRecipes, type Recipe } from './recipes.types';

/** Where the generated payload is served from (demo `public/` is the site root). */
export const DEFAULT_RECIPES_URL = '/recipes.json';

/**
 * URL the payload is fetched from. Overridable only so the test suite, whose
 * dev server has the repo root as its base, can point at the same file on disk.
 */
export const RECIPES_URL = new InjectionToken<string>('RECIPES_URL', {
    providedIn: 'root',
    factory: () => DEFAULT_RECIPES_URL,
});

/**
 * `/recipes` — the composed patterns, not the components.
 *
 * Developers copy patterns far more often than they copy a single component,
 * and a pattern that does not compile costs them more, because there is no
 * component of their own to blame. Every recipe shown here is a real file under
 * `e2e/recipes/` that the `recipes` e2e spec builds in a pristine consumer app
 * with `strictTemplates` on — the page renders those exact bytes.
 */
@Component({
    selector: 'app-recipes',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        BadgeComponent, ButtonComponent, CodeBlockComponent, CopyToDirective,
        IconComponent, RouterLink,
    ],
    template: `
    <section class="space-y-8" data-slot="recipes">
      <header class="space-y-1">
        <h2 class="text-2xl font-semibold">{{ t().recipesHeading }}</h2>
        <p class="text-muted-foreground">{{ t().recipesDescription }}</p>
      </header>

      @for (recipe of recipes(); track recipe.id) {
        <article class="space-y-3 rounded-lg border p-4" data-slot="recipe" [attr.data-recipe]="recipe.id">
          <h3 class="text-lg font-semibold">{{ recipe.title }}</h3>
          <p class="text-muted-foreground">{{ recipe.summary }}</p>

          <div class="flex flex-wrap items-center gap-2">
            @for (name of recipe.components; track name) {
              <a [routerLink]="['/docs', name]">
                <ui-badge variant="secondary">{{ name }}</ui-badge>
              </a>
            }
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <code
              class="min-w-0 flex-1 truncate rounded border bg-muted px-2 py-1 font-mono text-xs sm:text-sm"
              data-slot="recipe-install">{{ recipe.install }}</code>
            <ui-button
              variant="outline"
              size="sm"
              data-slot="copy-recipe-install"
              [uiCopyTo]="recipe.install"
              [ariaLabel]="t().copy + ': ' + recipe.install">
              <ui-icon name="copy" size="sm" />
            </ui-button>
          </div>

          <ui-code-block [code]="recipe.code" language="typescript" />
        </article>
      } @empty {
        <p class="text-muted-foreground" data-slot="recipes-empty">{{ t().loading }}</p>
      }
    </section>
  `,
})
export class RecipesComponent {
    private readonly url = inject(RECIPES_URL);
    private readonly localeId = inject(UI_LOCALE_ID);
    private readonly loaded = signal<readonly Recipe[]>([]);

    readonly t = computed(() => DOCS_LOCALES[this.localeId()] ?? DOCS_LOCALES['en']);
    readonly recipes = this.loaded.asReadonly();

    /**
     * Settles once the fetch has been attempted, successfully or not. Exposed
     * so a test can await the real network round trip instead of guessing at
     * how many change-detection passes it takes.
     */
    readonly ready: Promise<void> = this.load().catch(() => undefined);

    private async load(): Promise<void> {
        const response = await fetch(this.url);
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (isRecipes(payload)) this.loaded.set(payload.recipes);
    }
}
