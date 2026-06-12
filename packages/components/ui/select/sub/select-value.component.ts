import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
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
    displayValue = input<string | undefined>(undefined);

    /** Effective placeholder text: explicit input → parent select's placeholder/locale. */
    readonly effectivePlaceholder = computed(
        () => this.placeholder() ?? this.select?.resolvedPlaceholder() ?? 'Select...',
    );

    hasValue = computed(() => this.select?.internalValue() !== undefined && this.select?.internalValue() !== null);
    shownValue = computed(() => {
        const dv = this.displayValue();
        if (dv !== undefined) return dv;
        const val: unknown = this.select?.internalValue();
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    });

    hostClasses = computed(() =>
        cn(
            'flex-1 truncate ltr:text-left rtl:text-right'
        )
    );
}
