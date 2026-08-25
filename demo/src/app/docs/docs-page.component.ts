import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent, IconComponent } from '../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../packages/components/lib/i18n';
import { ComponentDocsService } from './component-docs.service';
import { DocsPanelComponent } from './docs-panel.component';
import { DOCS_LOCALES } from './docs.locales';

/**
 * `/docs/:name` — a documentation page for EVERY registry component.
 *
 * 62 of the 153 components have no route named after them (all the charts share
 * `/charts`, the text effects share `/animations`, the rich-text addons share
 * one editor page), so "each component has a docs page" cannot be satisfied by
 * the demo routes alone. This one route, driven entirely by generated data,
 * covers all of them and links to the live demo where one exists.
 */
@Component({
    selector: 'app-docs-page',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, DocsPanelComponent, IconComponent, RouterLink],
    template: `
    <section class="space-y-6" data-slot="docs-page">
      <header class="space-y-2">
        <h2 class="text-2xl font-semibold">{{ name() }}</h2>
        @if (doc(); as component) {
          @if (component.demoRoute; as demoRoute) {
            <a [routerLink]="['/', demoRoute]" data-slot="demo-link">
              <ui-button variant="outline" size="sm">
                <ui-icon name="eye" size="sm" class="me-1" />
                {{ t().viewDemo }}
              </ui-button>
            </a>
          } @else {
            <p class="text-sm text-muted-foreground" data-slot="no-demo">{{ t().noDemo }}</p>
          }
        }
      </header>

      @if (doc(); as component) {
        <app-docs-panel [doc]="component" />
      } @else if (ready()) {
        <p class="text-muted-foreground" data-slot="docs-not-found">{{ t().notFound }}</p>
      } @else {
        <p class="text-muted-foreground" data-slot="docs-loading">{{ t().loading }}</p>
      }
    </section>
  `,
})
export class DocsPageComponent {
    /** Registry component name, bound from the route parameter. */
    readonly name = input('');

    private readonly service = inject(ComponentDocsService);
    private readonly localeId = inject(UI_LOCALE_ID);

    readonly t = computed(() => DOCS_LOCALES[this.localeId()] ?? DOCS_LOCALES['en']);

    /** True once a load attempt has settled, so "not found" is not shown early. */
    readonly ready = this.service.loaded;

    readonly doc = computed(() => this.service.forName(this.name()));

    constructor() {
        effect(() => {
            if (this.name() === '') return;
            this.service.load().catch(() => undefined);
        });
    }
}
