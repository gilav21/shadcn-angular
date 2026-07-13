import {
    Component,
    ChangeDetectionStrategy,
    ElementRef,
    afterNextRender,
    inject,
    signal,
} from '@angular/core';
import { DIALOG } from '../dialog.component';
import { hasInteractiveContent } from '../../../lib/a11y';

@Component({
    selector: 'ui-dialog-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      [attr.tabindex]="wrapsInteractive() ? null : 0"
      [attr.role]="wrapsInteractive() ? null : 'button'"
      [attr.data-slot]="'dialog-trigger'"
      (click)="onClick()"
      (keydown.enter)="onKeydown($event)"
      (keydown.space)="onKeydown($event)"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DialogTriggerComponent {
    private readonly dialog = inject(DIALOG, { optional: true });
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    /** See `lib/a11y.ts` — stays transparent when the projected content is already a control. */
    readonly wrapsInteractive = signal(false);

    constructor() {
        afterNextRender(() => {
            this.wrapsInteractive.set(hasInteractiveContent(this.host.nativeElement));
        });
    }

    onClick(): void {
        this.dialog?.toggle();
    }

    /**
     * Only toggle from the wrapper's own keyboard activation. When the projected
     * content is itself focusable (e.g. a native <button>), its Enter/Space
     * already fires a click that bubbles here — handling the keydown too would
     * toggle twice (open then immediately close).
     */
    onKeydown(event: Event): void {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        this.onClick();
    }
}
