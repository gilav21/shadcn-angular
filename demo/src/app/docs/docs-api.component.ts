import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
    BadgeComponent,
    TableBodyComponent,
    TableCellComponent,
    TableComponent,
    TableHeadComponent,
    TableHeaderComponent,
    TableRowComponent,
} from '../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../packages/components/lib/i18n';
import { DOCS_LOCALES } from './docs.locales';
import type { ApiMemberDoc, ApiTableDoc } from './component-docs.types';

/**
 * The generated API reference for one component: an inputs table and an outputs
 * table per class it ships, including sub-components.
 *
 * Every row comes from `api-docs.json`, which is compodoc's own output reduced
 * to the fields a table needs. Nothing here is written by hand, so an input
 * added to a component appears the next time the docs are regenerated.
 */
@Component({
    selector: 'app-docs-api',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        BadgeComponent, TableBodyComponent, TableCellComponent, TableComponent,
        TableHeadComponent, TableHeaderComponent, TableRowComponent,
    ],
    template: `
    @if (tables().length > 0) {
      <div class="w-full min-w-0 space-y-6 pt-3" data-slot="docs-api">
        @if (heading()) {
          <h4 class="text-sm font-semibold">{{ t().apiReference }}</h4>
        }
        @for (table of tables(); track table.file + table.className; let isFirst = $first) {
          <!--
            One class per block, and a rule between them. Without it a reader
            scrolling a component with several classes had no cue that
            PresetDialogComponent's table was a different class from the one
            above it — the transition was invisible.
          -->
          <div
            class="w-full min-w-0 space-y-3 border-t border-border pt-6"
            [class.border-t-0]="isFirst"
            [class.pt-0]="isFirst"
            data-slot="api-table">
            <div class="flex flex-wrap items-baseline gap-2">
              <h5 class="font-mono text-base font-semibold">{{ table.className }}</h5>
              <code class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{{ table.selector }}</code>
            </div>
            @if (table.inputs.length > 0) {
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t().inputs }}</p>
              <div
                class="w-full min-w-0 max-w-full overflow-x-auto"
                role="region"
                tabindex="0"
                [attr.aria-label]="table.className + ' ' + t().inputs">
                <ui-table>
                  <ui-table-header>
                    <ui-table-row style="min-width:0">
                      <ui-table-head class="w-28 sm:w-36 xl:w-40 2xl:w-44 flex-none">{{ t().name }}</ui-table-head>
                      <ui-table-head class="w-28 sm:w-40 xl:w-48 2xl:w-56 flex-none">{{ t().type }}</ui-table-head>
                      <ui-table-head class="w-16 sm:w-20 xl:w-28 2xl:w-32 flex-none">{{ t().defaultValue }}</ui-table-head>
                      <ui-table-head class="min-w-[14rem] flex-1 pe-4">{{ t().description }}</ui-table-head>
                    </ui-table-row>
                  </ui-table-header>
                  <ui-table-body>
                    @for (row of table.inputs; track row.name) {
                      <ui-table-row style="min-width:0">
                        <ui-table-cell class="w-28 sm:w-36 xl:w-40 2xl:w-44 flex-none [overflow-wrap:anywhere] font-mono text-xs">
                          {{ row.name }}
                          @if (row.required) {
                            <ui-badge variant="outline" class="ms-1">{{ t().required }}</ui-badge>
                          }
                          @if (row.deprecated) {
                            <ui-badge variant="destructive" class="ms-1">{{ t().deprecated }}</ui-badge>
                          }
                        </ui-table-cell>
                        <ui-table-cell class="w-28 sm:w-40 xl:w-48 2xl:w-56 flex-none [overflow-wrap:anywhere] font-mono text-xs">{{ row.type }}</ui-table-cell>
                        <ui-table-cell class="w-16 sm:w-20 xl:w-28 2xl:w-32 flex-none [overflow-wrap:anywhere] font-mono text-xs">{{ defaultOf(row) }}</ui-table-cell>
                        <ui-table-cell class="min-w-[14rem] flex-1 overflow-hidden pe-4 [overflow-wrap:anywhere] text-xs">{{ row.description }}</ui-table-cell>
                      </ui-table-row>
                    }
                  </ui-table-body>
                </ui-table>
              </div>
            }
            @if (table.outputs.length > 0) {
              <p
                class="border-t border-dashed border-border pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                [class.border-t-0]="table.inputs.length === 0"
                [class.pt-0]="table.inputs.length === 0">{{ t().outputs }}</p>
              <div
                class="w-full min-w-0 max-w-full overflow-x-auto"
                role="region"
                tabindex="0"
                [attr.aria-label]="table.className + ' ' + t().outputs">
                <ui-table>
                  <ui-table-header>
                    <ui-table-row style="min-width:0">
                      <ui-table-head class="w-28 sm:w-36 xl:w-40 2xl:w-44 flex-none">{{ t().name }}</ui-table-head>
                      <ui-table-head class="w-28 sm:w-40 xl:w-48 2xl:w-56 flex-none">{{ t().type }}</ui-table-head>
                      <ui-table-head class="min-w-[14rem] flex-1 pe-4">{{ t().description }}</ui-table-head>
                    </ui-table-row>
                  </ui-table-header>
                  <ui-table-body>
                    @for (row of table.outputs; track row.name) {
                      <ui-table-row style="min-width:0">
                        <ui-table-cell class="w-28 sm:w-36 xl:w-40 2xl:w-44 flex-none [overflow-wrap:anywhere] font-mono text-xs">{{ row.name }}</ui-table-cell>
                        <ui-table-cell class="w-28 sm:w-40 xl:w-48 2xl:w-56 flex-none [overflow-wrap:anywhere] font-mono text-xs">{{ row.type }}</ui-table-cell>
                        <ui-table-cell class="min-w-[14rem] flex-1 overflow-hidden pe-4 [overflow-wrap:anywhere] text-xs">{{ row.description }}</ui-table-cell>
                      </ui-table-row>
                    }
                  </ui-table-body>
                </ui-table>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class DocsApiComponent {
    /** Generated API tables, primary class first. */
    readonly tables = input.required<readonly ApiTableDoc[]>();

    /**
     * Whether to render the "API reference" heading.
     *
     * `false` when the caller already labels the block — `app-docs-for` puts
     * the same words on its collapsible trigger, so rendering both printed
     * "API reference" twice in a row the moment the section was expanded.
     */
    readonly heading = input(true);

    private readonly localeId = inject(UI_LOCALE_ID);
    readonly t = computed(() => DOCS_LOCALES[this.localeId()] ?? DOCS_LOCALES['en']);

    /** An input's default, or an em dash when it has none. */
    defaultOf(row: ApiMemberDoc): string {
        return row.default ?? '—';
    }
}
