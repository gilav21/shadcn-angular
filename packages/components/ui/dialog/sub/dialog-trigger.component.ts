import {
    Component,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import { DIALOG } from '../dialog.component';

@Component({
    selector: 'ui-dialog-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      tabindex="0"
      role="button"
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
        if (event.target === event.currentTarget) {
            event.preventDefault();
            this.onClick();
        }
    }
}
