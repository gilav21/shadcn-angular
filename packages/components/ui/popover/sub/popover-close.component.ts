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

    onClick(): void {
        this.popover?.hide();
    }

    onKeydown(event: Event): void {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        this.onClick();
    }
}
