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

    /**
     * Greys the entry, blocks pointer events, and disables the underlying
     * native button — which also removes it from the parent's ArrowUp/ArrowDown
     * ring, since that query excludes `[disabled]`. Independent of the parent
     * `ui-split-button`'s own `disabled`, which only gates the two button
     * halves.
     */
    disabled = input(false, { transform: booleanAttribute });
    /**
     * Identifier carried on the `itemClick` payload the parent emits. It is the
     * only distinguishing field there — {@link onClick} sends `label: ''` — so
     * set it whenever the consumer needs to tell projected entries apart.
     */
    value = input<string>('');

    classes = computed(() => cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground',
        this.disabled() && 'pointer-events-none opacity-50'
    ));

    /**
     * Activates the entry: emits the parent's `itemClick` with
     * `{ label: '', value }` — the projected text is never read back, so
     * {@link value} is the only payload — and closes the parent's menu. Does
     * nothing while {@link disabled}. The event is not consumed, but the menu
     * closes here regardless.
     */
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
