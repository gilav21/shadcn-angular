import {
    Component,
    ChangeDetectionStrategy,
    ElementRef,
    afterNextRender,
    inject,
    signal,
} from '@angular/core';
import { ALERT_DIALOG } from '../alert-dialog.component';
import { hasInteractiveContent } from '@/components/lib/a11y';

@Component({
    selector: 'ui-alert-dialog-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      (click)="onClick()"
      (keydown.enter)="onKeydown($event)"
      (keydown.space)="onKeydown($event)"
      [attr.data-slot]="'alert-dialog-trigger'"
      [attr.tabindex]="wrapsInteractive() ? null : 0"
      [attr.role]="wrapsInteractive() ? null : 'button'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class AlertDialogTriggerComponent {
    private readonly alertDialog = inject(ALERT_DIALOG, { optional: true });
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    /** See `lib/a11y.ts` — stays transparent when the projected content is already a control. */
    readonly wrapsInteractive = signal(false);

    constructor() {
        afterNextRender(() => {
            this.wrapsInteractive.set(hasInteractiveContent(this.host.nativeElement));
        });
    }

    onClick(): void {
        this.alertDialog?.toggle();
    }

    onKeydown(event: Event): void {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        this.onClick();
    }
}
