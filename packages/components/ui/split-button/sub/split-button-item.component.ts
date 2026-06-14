import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    booleanAttribute,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SPLIT_BUTTON } from '../split-button.component';

@Component({
    selector: 'ui-split-button-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      [class]="classes()"
      [disabled]="disabled()"
      (click)="onClick($event)"
      role="menuitem"
      tabindex="-1"
    >
      <ng-content />
    </button>
  `,
    host: { class: 'contents' },
})
export class SplitButtonItemComponent {
    private readonly splitButton = inject(SPLIT_BUTTON);

    disabled = input(false, { transform: booleanAttribute });
    value = input<string>('');

    classes = computed(() => cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground',
        this.disabled() && 'pointer-events-none opacity-50'
    ));

    onClick(_event: MouseEvent): void {
        if (!this.disabled()) {
            this.splitButton.itemClick.emit({
                label: '',
                value: this.value()
            });
            this.splitButton.isOpen.set(false);
        }
    }
}
