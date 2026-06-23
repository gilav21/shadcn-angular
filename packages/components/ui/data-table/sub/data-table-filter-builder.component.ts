import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../button';
import { IconComponent } from '../../icon';
import { FilterGroup, FilterOperator, FilterRule } from '../data-table.types';

/** {key,header} pairs the builder offers as filterable columns. */
export interface FilterBuilderColumn {
    key: string;
    header: string;
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
    { value: 'contains', label: 'contains' },
    { value: 'notContains', label: 'does not contain' },
    { value: 'equals', label: 'equals' },
    { value: 'notEquals', label: 'not equals' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'gt', label: 'greater than' },
    { value: 'gte', label: 'greater or equal' },
    { value: 'lt', label: 'less than' },
    { value: 'lte', label: 'less or equal' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
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
                <div class="inline-flex overflow-hidden rounded-md border text-xs">
                    <button type="button" class="px-2 py-1" [class.bg-accent]="group().combinator === 'and'"
                        (click)="setCombinator('and')">AND</button>
                    <button type="button" class="px-2 py-1 border-s" [class.bg-accent]="group().combinator === 'or'"
                        (click)="setCombinator('or')">OR</button>
                </div>
                <span class="text-xs text-muted-foreground">
                    match {{ group().combinator === 'and' ? 'all' : 'any' }} of the rules below
                </span>
            </div>

            @for (rule of group().rules; track $index) {
                @if (rule.type === 'condition') {
                    <div class="flex flex-wrap items-center gap-1" data-slot="filter-condition">
                        <select class="h-8 rounded-md border bg-background px-1 text-sm"
                            [value]="rule.column" (change)="patch($index, { column: selectValue($event) })">
                            @for (c of columns(); track c.key) {
                                <option [value]="c.key">{{ c.header }}</option>
                            }
                        </select>
                        <select class="h-8 rounded-md border bg-background px-1 text-sm"
                            [value]="rule.operator" (change)="patchOperator($index, $event)">
                            @for (op of operators; track op.value) {
                                <option [value]="op.value">{{ op.label }}</option>
                            }
                        </select>
                        @if (needsValue(rule.operator)) {
                            <input type="text" placeholder="value"
                                class="h-8 w-28 rounded-md border bg-background px-2 text-sm"
                                [value]="asText(rule.value)" (input)="patch($index, { value: selectValue($event) })" />
                        }
                        <button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                            [attr.aria-label]="'Remove condition'" (click)="removeRule($index)">
                            <ui-icon name="x" size="xs" />
                        </button>
                    </div>
                } @else {
                    <div class="border-s-2 ps-2" data-slot="filter-subgroup">
                        <ui-data-table-filter-builder [group]="rule" [columns]="columns()"
                            (groupChange)="updateRule($index, $event)" />
                        <button type="button" class="mt-1 text-xs text-muted-foreground hover:text-destructive"
                            (click)="removeRule($index)">Remove group</button>
                    </div>
                }
            }

            <div class="flex flex-wrap gap-2">
                <ui-button size="sm" variant="outline" (click)="addCondition()">+ Condition</ui-button>
                <ui-button size="sm" variant="ghost" (click)="addGroup()">+ Group</ui-button>
            </div>
        </div>
    `,
    host: { class: 'block' },
})
export class DataTableFilterBuilderComponent {
    readonly group = input.required<FilterGroup>();
    readonly columns = input.required<FilterBuilderColumn[]>();
    readonly groupChange = output<FilterGroup>();

    readonly operators = OPERATORS;

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
