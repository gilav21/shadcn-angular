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
      <span class="text-muted-foreground truncate">{{ placeholder() }}</span>
    }
  `,
    host: {
        '[class]': 'hostClasses()',
        '[attr.data-slot]': '"select-value"'
    },
})
export class SelectValueComponent {
    private readonly select = inject(SELECT, { optional: true });
    placeholder = input('Select an option');
    displayValue = input<string | undefined>(undefined);

    hasValue = computed(() => this.select?.internalValue() !== undefined && this.select?.internalValue() !== null);
    shownValue = computed(() => {
        if (this.displayValue() !== undefined) return this.displayValue()!;
        const val = this.select?.internalValue();
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val as string | number | boolean);
    });

    hostClasses = computed(() =>
        cn(
            'flex-1 truncate ltr:text-left rtl:text-right'
        )
    );
}
