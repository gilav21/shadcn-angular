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
      <div class="space-y-4" data-slot="docs-api">
        <h4 class="text-sm font-semibold">{{ t().apiReference }}</h4>
        @for (table of tables(); track table.file + table.className) {
          <div class="space-y-2" data-slot="api-table">
            <div class="flex flex-wrap items-baseline gap-2">
              <h5 class="font-mono text-sm font-semibold">{{ table.className }}</h5>
              <code class="text-xs text-muted-foreground">{{ table.selector }}</code>
            </div>
            @if (table.inputs.length > 0) {
              <p class="text-xs font-semibold uppercase text-muted-foreground">{{ t().inputs }}</p>
              <div
                role="region"
                [attr.aria-label]="table.className + ' ' + t().inputs">
                <ui-table>
                  <ui-table-header>
                    <ui-table-row>
                      <ui-table-head>{{ t().name }}</ui-table-head>
                      <ui-table-head>{{ t().type }}</ui-table-head>
                      <ui-table-head>{{ t().defaultValue }}</ui-table-head>
                      <ui-table-head>{{ t().description }}</ui-table-head>
                    </ui-table-row>
                  </ui-table-header>
                  <ui-table-body>
                    @for (row of table.inputs; track row.name) {
                      <ui-table-row>
                        <ui-table-cell class="font-mono text-xs">
                          {{ row.name }}
                          @if (row.required) {
                            <ui-badge variant="outline" class="ms-1">{{ t().required }}</ui-badge>
                          }
                          @if (row.deprecated) {
                            <ui-badge variant="destructive" class="ms-1">{{ t().deprecated }}</ui-badge>
                          }
                        </ui-table-cell>
                        <ui-table-cell class="font-mono text-xs">{{ row.type }}</ui-table-cell>
                        <ui-table-cell class="font-mono text-xs">{{ defaultOf(row) }}</ui-table-cell>
                        <ui-table-cell class="text-xs">{{ row.description }}</ui-table-cell>
                      </ui-table-row>
                    }
                  </ui-table-body>
                </ui-table>
              </div>
            }
            @if (table.outputs.length > 0) {
              <p class="text-xs font-semibold uppercase text-muted-foreground">{{ t().outputs }}</p>
              <div
                role="region"
                [attr.aria-label]="table.className + ' ' + t().outputs">
                <ui-table>
                  <ui-table-header>
                    <ui-table-row>
                      <ui-table-head>{{ t().name }}</ui-table-head>
                      <ui-table-head>{{ t().type }}</ui-table-head>
                      <ui-table-head>{{ t().description }}</ui-table-head>
                    </ui-table-row>
                  </ui-table-header>
                  <ui-table-body>
                    @for (row of table.outputs; track row.name) {
                      <ui-table-row>
                        <ui-table-cell class="font-mono text-xs">{{ row.name }}</ui-table-cell>
                        <ui-table-cell class="font-mono text-xs">{{ row.type }}</ui-table-cell>
                        <ui-table-cell class="text-xs">{{ row.description }}</ui-table-cell>
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

    private readonly localeId = inject(UI_LOCALE_ID);
    readonly t = computed(() => DOCS_LOCALES[this.localeId()] ?? DOCS_LOCALES['en']);

    /** An input's default, or an em dash when it has none. */
    defaultOf(row: ApiMemberDoc): string {
        return row.default ?? '—';
    }
}
