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
import type { ComponentDoc } from './component-docs.types';

/**
 * The install command, StackBlitz link and generated API tables for whatever
 * the current demo route previews — rendered once in the app shell rather than
 * pasted into 113 demo pages, which is the only way this stays correct as demos
 * move around.
 *
 * The install command is always visible: it is the reason the block exists. The
 * API tables are long, so they sit behind a collapsible so they do not push the
 * live demo below the fold.
 *
 * A route can preview several components (every chart shares `/charts`), so all
 * of them are listed and each gets its own block.
 */
@Component({
    selector: 'app-docs-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CollapsibleComponent, CollapsibleContentComponent, CollapsibleTriggerComponent,
        DocsApiComponent, DocsInstallComponent, IconComponent, RouterLink,
    ],
    template: `
    @if (docs().length > 0) {
      <div class="space-y-4 rounded-lg border bg-card p-3 sm:p-4" data-slot="docs-header">
        @for (doc of docs(); track doc.name) {
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-mono text-base font-semibold">{{ doc.name }}</h3>
              <a class="text-xs underline" [routerLink]="['/docs', doc.name]">
                {{ t().docsFor }}
              </a>
            </div>

            <app-docs-install [doc]="doc" />

            @if (doc.api.length > 0) {
              <ui-collapsible (openChange)="onOpenChange(doc.name, $event)" class="block">
                <ui-collapsible-trigger class="w-full">
                  <div class="flex w-full items-center gap-2 border-t pt-2 text-sm font-semibold">
                    <span>{{ t().apiReference }}</span>
                    <ui-icon
                      class="ms-auto"
                      [name]="isOpen(doc.name) ? 'chevron-up' : 'chevron-down'"
                      size="sm" />
                  </div>
                </ui-collapsible-trigger>
                <ui-collapsible-content>
                  <app-docs-api [tables]="doc.api" />
                </ui-collapsible-content>
              </ui-collapsible>
            }
          </div>
        }
      </div>
    }
  `,
})
export class DocsHeaderComponent {
    /** Current demo route path, e.g. `buttons`. */
    readonly route = input.required<string>();

    private readonly service = inject(ComponentDocsService);
    private readonly localeId = inject(UI_LOCALE_ID);
    private readonly openNames = signal<ReadonlySet<string>>(new Set());

    readonly t = computed(() => DOCS_LOCALES[this.localeId()] ?? DOCS_LOCALES['en']);

    /**
     * Components previewed by the current route. Reactive without any local
     * "loaded" flag: the service's index is a signal, so the block appears by
     * itself the moment the payload lands.
     */
    readonly docs = computed<readonly ComponentDoc[]>(() => this.service.forRoute(this.route()));

    constructor() {
        // The payload is ~850 KB, so it is fetched only once a route is known —
        // and only once for the whole session (the service deduplicates).
        effect(() => {
            if (this.route() === '') return;
            this.service.load().catch(() => undefined);
        });
    }

    /** Whether one component's API table section is expanded. */
    isOpen(name: string): boolean {
        return this.openNames().has(name);
    }

    /** Track expansion per component, since a route can list several. */
    onOpenChange(name: string, open: boolean): void {
        this.openNames.update(current => {
            const next = new Set(current);
            if (open) next.add(name);
            else next.delete(name);
            return next;
        });
    }
}
