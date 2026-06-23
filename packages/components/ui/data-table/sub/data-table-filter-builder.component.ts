import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../button';
import { IconComponent } from '../../icon';
import { FilterGroup, FilterOperator, FilterRule } from '../data-table.types';

/** {key,header} pairs the builder offers as filterable columns. */
export interface FilterBuilderColumn {
    key: string;
    header: string;
}

/** Localizable strings for the filter builder + its toolbar chrome (English defaults). */
export interface FilterBuilderLabels {
    and: string;
    or: string;
    matchAll: string;
    matchAny: string;
    addCondition: string;
    addGroup: string;
    removeGroup: string;
    removeCondition: string;
    valuePlaceholder: string;
    /** Toolbar trigger button label (rendered by the host data-table, not the builder). */
    filterButton: string;
    /** "Clear all filters" link below the builder (rendered by the host data-table). */
    clearFilters: string;
    operators: Record<FilterOperator, string>;
}

export const DEFAULT_FILTER_BUILDER_LABELS: FilterBuilderLabels = {
    and: 'AND',
    or: 'OR',
    matchAll: 'match all of the rules below',
    matchAny: 'match any of the rules below',
    addCondition: '+ Condition',
    addGroup: '+ Group',
    removeGroup: 'Remove group',
    removeCondition: 'Remove condition',
    valuePlaceholder: 'value',
    filterButton: 'Filter',
    clearFilters: 'Clear all filters',
    operators: {
        contains: 'contains',
        notContains: 'does not contain',
        equals: 'equals',
        notEquals: 'not equals',
        startsWith: 'starts with',
        endsWith: 'ends with',
        gt: 'greater than',
        gte: 'greater or equal',
        lt: 'less than',
        lte: 'less or equal',
        isEmpty: 'is empty',
        isNotEmpty: 'is not empty',
    },
};

const OPERATOR_ORDER: FilterOperator[] = [
    'contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'endsWith',
    'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty',
];

const VALUELESS: ReadonlySet<FilterOperator> = new Set(['isEmpty', 'isNotEmpty']);

/**
 * Recursive AND/OR filter-tree editor (A5). Standalone — it lists itself in
 * `imports` so nested groups render the same component.
 */
@Component({
    selector: 'ui-data-table-filter-builder',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, IconComponent, DataTableFilterBuilderComponent],
    template: `
        <div class="space-y-2 rounded-md border bg-background p-2" data-slot="filter-group">
            <div class="flex items-center gap-2">
                <div class="inline-flex shrink-0 overflow-hidden rounded-md border text-xs">
                    <button type="button" class="px-2 py-1" [class.bg-accent]="group().combinator === 'and'"
                        (click)="setCombinator('and')">{{ labels().and }}</button>
                    <button type="button" class="px-2 py-1 border-s" [class.bg-accent]="group().combinator === 'or'"
                        (click)="setCombinator('or')">{{ labels().or }}</button>
                </div>
                <span class="text-xs text-muted-foreground">
                    {{ group().combinator === 'and' ? labels().matchAll : labels().matchAny }}
                </span>
            </div>

            @for (rule of group().rules; track $index) {
                @if (rule.type === 'condition') {
                    <div class="flex items-center gap-1" data-slot="filter-condition">
                        <select class="h-8 w-24 shrink-0 rounded-md border bg-background px-1 text-sm"
                            [value]="rule.column" (change)="patch($index, { column: selectValue($event) })">
                            @for (c of columns(); track c.key) {
                                <option [value]="c.key">{{ c.header }}</option>
                            }
                        </select>
                        <select class="h-8 w-28 shrink-0 rounded-md border bg-background px-1 text-sm"
                            [value]="rule.operator" (change)="patchOperator($index, $event)">
                            @for (op of operatorOrder; track op) {
                                <option [value]="op">{{ labels().operators[op] }}</option>
                            }
                        </select>
                        @if (needsValue(rule.operator)) {
                            <input type="text" [placeholder]="labels().valuePlaceholder"
                                class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                                [value]="asText(rule.value)" (input)="patch($index, { value: selectValue($event) })" />
                        }
                        <button type="button" class="ms-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                            [attr.aria-label]="labels().removeCondition" (click)="removeRule($index)">
                            <ui-icon name="x" size="xs" />
                        </button>
                    </div>
                } @else {
                    <div class="border-s-2 ps-2" data-slot="filter-subgroup">
                        <ui-data-table-filter-builder [group]="rule" [columns]="columns()" [labels]="labels()"
                            (groupChange)="updateRule($index, $event)" />
                        <button type="button" class="mt-1 text-xs text-muted-foreground hover:text-destructive"
                            (click)="removeRule($index)">{{ labels().removeGroup }}</button>
                    </div>
                }
            }

            <div class="flex flex-wrap gap-2">
                <ui-button size="sm" variant="outline" (click)="addCondition()">{{ labels().addCondition }}</ui-button>
                <ui-button size="sm" variant="ghost" (click)="addGroup()">{{ labels().addGroup }}</ui-button>
            </div>
        </div>
    `,
    host: { class: 'block' },
})
export class DataTableFilterBuilderComponent {
    readonly group = input.required<FilterGroup>();
    readonly columns = input.required<FilterBuilderColumn[]>();
    readonly labels = input<FilterBuilderLabels>(DEFAULT_FILTER_BUILDER_LABELS);
    readonly groupChange = output<FilterGroup>();

    readonly operatorOrder = OPERATOR_ORDER;

    needsValue(operator: FilterOperator): boolean {
        return !VALUELESS.has(operator);
    }

    asText(value: unknown): string {
        return value == null ? '' : String(value);
    }

    selectValue(event: Event): string {
        return (event.target as HTMLInputElement | HTMLSelectElement).value;
    }

    private emit(rules: FilterRule[], combinator = this.group().combinator): void {
        this.groupChange.emit({ type: 'group', combinator, rules });
    }

    setCombinator(combinator: 'and' | 'or'): void {
        this.emit(this.group().rules, combinator);
    }

    addCondition(): void {
        const column = this.columns()[0]?.key ?? '';
        this.emit([
            ...this.group().rules,
            { type: 'condition', column, operator: 'contains', value: '' },
        ]);
    }

    addGroup(): void {
        this.emit([...this.group().rules, { type: 'group', combinator: 'and', rules: [] }]);
    }

    removeRule(index: number): void {
        this.emit(this.group().rules.filter((_, i) => i !== index));
    }

    updateRule(index: number, rule: FilterRule): void {
        this.emit(this.group().rules.map((r, i) => (i === index ? rule : r)));
    }

    patch(index: number, partial: { column?: string; value?: unknown }): void {
        const rule = this.group().rules[index];
        if (rule.type === 'condition') {
            this.updateRule(index, { ...rule, ...partial });
        }
    }

    patchOperator(index: number, event: Event): void {
        const rule = this.group().rules[index];
        if (rule.type === 'condition') {
            this.updateRule(index, { ...rule, operator: this.selectValue(event) as FilterOperator });
        }
    }
}
