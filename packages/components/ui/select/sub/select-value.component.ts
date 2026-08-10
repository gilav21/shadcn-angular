import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    inject,
} from '@angular/core';
import { cn, stringifyValue } from '../../../lib/utils';
import { SELECT } from '../select.component';

@Component({
    selector: 'ui-select-value',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (hasValue()) {
      <span class="truncate">{{ shownValue() }}</span>
    } @else {
      <span class="text-muted-foreground truncate">{{ effectivePlaceholder() }}</span>
    }
  `,
    host: {
        '[class]': 'hostClasses()',
        '[attr.data-slot]': '"select-value"'
    },
})
export class SelectValueComponent {
    private readonly select = inject(SELECT, { optional: true });
    /**
     * Override for the empty-state placeholder. When unset, falls back to the
     * parent `<ui-select>`'s resolved placeholder (which itself falls back to
     * the locale's `selectPlaceholder` string).
     */
    placeholder = input<string>();
    /**
     * Renders this text instead of the parent select's raw value — use it to
     * show a label for a value that stringifies badly (an id, an object).
     * Overrides the value but not the empty state: when nothing is selected the
     * placeholder still shows.
     */
    displayValue = input<string | undefined>(undefined);

    /** Effective placeholder text: explicit input → parent select's placeholder/locale. */
    readonly effectivePlaceholder = computed(
        () => this.placeholder() ?? this.select?.resolvedPlaceholder() ?? 'Select...',
    );

    hasValue = computed(() => this.select?.internalValue() !== undefined && this.select?.internalValue() !== null);
    shownValue = computed(() => {
        const dv = this.displayValue();
        if (dv !== undefined) return dv;
        const val = this.select?.internalValue();
        if (val === undefined || val === null) return '';
        return stringifyValue(val);
    });

    hostClasses = computed(() =>
        cn(
            'flex-1 truncate ltr:text-left rtl:text-right'
        )
    );
}
