import {
    Component,
    ChangeDetectionStrategy,
    ElementRef,
    afterNextRender,
    inject,
    signal,
} from '@angular/core';
import { POPOVER } from '../popover.component';
import { hasInteractiveContent } from '../../../lib/a11y';

@Component({
    selector: 'ui-popover-close',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      [attr.role]="wrapsInteractive() ? null : 'button'"
      [attr.tabindex]="wrapsInteractive() ? null : 0"
      (click)="onClick()"
      (keydown.enter)="onKeydown($event)"
      (keydown.space)="onKeydown($event)"
      [attr.data-slot]="'popover-close'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class PopoverCloseComponent {
    private readonly popover = inject(POPOVER, { optional: true });
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    /** See `lib/a11y.ts` — stays transparent when the projected content is already a control. */
    readonly wrapsInteractive = signal(false);

    constructor() {
        afterNextRender(() => {
            this.wrapsInteractive.set(hasInteractiveContent(this.host.nativeElement));
        });
    }

    /** Closes the popover. Fires for a click anywhere inside this wrapper, including on projected buttons, so it also swallows their own click intent — put a close button here only when closing is all it does. */
    onClick(): void {
        this.popover?.hide();
    }

    /**
     * Handles Enter/Space only when the wrapper itself is focused. Focusable
     * projected content already turns those keys into a click that bubbles to
     * {@link onClick}, and handling the keydown too would close twice.
     */
    onKeydown(event: Event): void {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        this.onClick();
    }
}
