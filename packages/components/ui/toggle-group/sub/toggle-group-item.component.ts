import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { TOGGLE_GROUP, toggleVariants } from '../toggle-group.component';

@Component({
    selector: 'ui-toggle-group-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './toggle-group-item.component.html',
    host: {
        class: 'contents',
        '[attr.aria-label]': 'null'
    },
})
export class ToggleGroupItemComponent {
    readonly group = inject(TOGGLE_GROUP, { optional: true });

    value = input.required<string>();
    disabled = input(false);
    class = input('');
    ariaLabel = input<string | undefined>(undefined);

    isSelected = computed(() => this.group?.isSelected(this.value()) ?? false);

    classes = computed(() => {
        const variant = this.group?.variant() ?? 'default';
        const size = this.group?.size() ?? 'default';

        return cn(
            toggleVariants({ variant, size }),
            'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10',
            'rounded-none shadow-none ltr:first:rounded-l-md ltr:last:rounded-r-md rtl:first:rounded-r-md rtl:last:rounded-l-md',
            variant === 'outline' && 'ltr:border-l-0 ltr:first:border-l rtl:border-r-0 rtl:first:border-r',
            this.class()
        );
    });

    onClick() {
        if (!this.disabled()) {
            this.group?.toggle(this.value());
        }
    }
}
