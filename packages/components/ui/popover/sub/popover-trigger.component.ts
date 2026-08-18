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
    selector: 'ui-popover-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      [attr.role]="wrapsInteractive() ? null : 'button'"
      [attr.tabindex]="wrapsInteractive() ? null : 0"
      (click)="onClick($event)"
      (keydown.enter)="onKeydown($event)"
      (keydown.space)="onKeydown($event)"
      [attr.data-slot]="'popover-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class PopoverTriggerComponent {
    private readonly popover = inject(POPOVER, { optional: true });
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    /**
     * True when the projected content is already an interactive control (a
     * `<ui-button>`, a native `<button>`, …). The wrapper then stays a
     * transparent event delegate instead of adding a second, nested
     * `role="button"` — see `lib/a11y.ts`.
     */
    readonly wrapsInteractive = signal(false);

    constructor() {
        afterNextRender(() => {
            this.wrapsInteractive.set(hasInteractiveContent(this.host.nativeElement));
        });
    }

    /** Toggles the popover and stops the click propagating, which is what keeps the document-level outside-click listener from immediately closing what this click just opened. */
    onClick(event: MouseEvent): void {
        event.stopPropagation();
        this.popover?.toggle();
    }

    /**
     * Only act on the wrapper's own keyboard activation. When the projected
     * content is focusable it already turns Enter/Space into a click that
     * bubbles here, and handling the keydown too would toggle twice.
     */
    onKeydown(event: Event): void {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        this.popover?.toggle();
    }
}
