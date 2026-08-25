import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
    CollapsibleComponent,
    CollapsibleContentComponent,
    CollapsibleTriggerComponent,
    IconComponent,
} from '../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../packages/components/lib/i18n';
import { ComponentDocsService } from './component-docs.service';
import { DocsApiComponent } from './docs-api.component';
import { DocsInstallComponent } from './docs-install.component';
import { DOCS_LOCALES } from './docs.locales';

/**
 * The install command and generated API tables for **one** named component,
 * placed directly beneath the live demo of that component.
 *
 * Most demo routes preview a single component, and for those the app shell
 * renders {@link DocsHeaderComponent} once — no page needs to do anything. But
 * four routes preview many components at once (`/charts` alone has 28), and
 * there the shell's single block degraded badly: every install command stacked
 * at the top, so the reader scrolled past 28 of them before reaching the first
 * chart. Details that describe a specific demo belong next to that demo.
 *
 * So those pages drop one of these into each section instead. The block is
 * identical to the one the shell renders — same install command, same
 * collapsible API — it is simply positioned per component rather than per page.
 *
 * ```html
 * <h3>Histogram</h3>
 * <ui-histogram [values]="samples" />
 * <app-docs-for name="histogram" />
 * ```
 *
 * The name is the registry key, and an unknown one renders nothing rather than
 * an error placeholder — a demo for an unregistered component is a registry
 * problem, and `component-docs.spec.ts` fails on it by name.
 */
@Component({
    selector: 'app-docs-for',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CollapsibleComponent, CollapsibleContentComponent, CollapsibleTriggerComponent,
        DocsApiComponent, DocsInstallComponent, IconComponent, RouterLink,
    ],
    // Same reason as DocsHeaderComponent: an inline host cannot take the
    // vertical margin its container hands out.
    host: { class: 'block' },
    template: `
    @if (doc(); as component) {
      <div
        class="space-y-3 rounded-lg border bg-card p-3 sm:p-4"
        data-slot="docs-for"
        [attr.data-component]="component.name"
      >
        <app-docs-install [doc]="component" />

        <div class="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-t pt-4">
          @if (component.api.length > 0) {
            <ui-collapsible (openChange)="open.set($event)" class="block min-w-0 flex-1">
              <ui-collapsible-trigger class="w-full">
                <div class="flex w-full items-center gap-2 py-1 text-sm font-semibold">
                  <span>{{ t().apiReference }}</span>
                  <ui-icon class="ms-auto" [name]="open() ? 'chevron-up' : 'chevron-down'" size="sm" />
                </div>
              </ui-collapsible-trigger>
              <ui-collapsible-content>
                <app-docs-api [tables]="component.api" [heading]="false" />
              </ui-collapsible-content>
            </ui-collapsible>
          }
          <a class="text-xs underline" [routerLink]="['/docs', component.name]">
            {{ t().docsFor }}
          </a>
        </div>
      </div>
    }
  `,
})
export class DocsForComponent {
    /** Registry key of the component this block documents, e.g. `histogram`. */
    readonly name = input.required<string>();

    private readonly service = inject(ComponentDocsService);
    private readonly localeId = inject(UI_LOCALE_ID);

    protected readonly open = signal(false);

    readonly t = computed(() => DOCS_LOCALES[this.localeId()] ?? DOCS_LOCALES['en']);

    readonly doc = computed(() => this.service.forName(this.name()));

    constructor() {
        // Same deduplicated fetch the shell uses; the service loads once per
        // session however many of these a page renders.
        effect(() => {
            if (this.name() === '') return;
            this.service.load().catch(() => undefined);
        });
    }
}
