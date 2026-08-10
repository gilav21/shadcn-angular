import {
    Component,
    ChangeDetectionStrategy,
    ElementRef,
    afterNextRender,
    inject,
    signal,
} from '@angular/core';
import { DRAWER } from '../drawer.component';
import { hasInteractiveContent } from '../../../lib/a11y';

@Component({
    selector: 'ui-drawer-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      (click)="onClick()"
      (keydown.enter)="onKeydown($event)"
      (keydown.space)="onKeydown($event)"
      [attr.data-slot]="'drawer-trigger'"
      [attr.tabindex]="wrapsInteractive() ? null : 0"
      [attr.role]="wrapsInteractive() ? null : 'button'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DrawerTriggerComponent {
    private readonly drawer = inject(DRAWER, { optional: true });
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    /** See `lib/a11y.ts` — stays transparent when the projected content is already a control. */
    readonly wrapsInteractive = signal(false);

    constructor() {
        afterNextRender(() => {
            this.wrapsInteractive.set(hasInteractiveContent(this.host.nativeElement));
        });
    }

    /** Toggles the owning `ui-drawer`; a no-op when rendered outside one. */
    onClick(): void {
        this.drawer?.toggle();
    }

    /**
     * Only toggles from the wrapper's own keyboard activation. When the
     * projected content is itself focusable (e.g. a native `<button>`), its
     * Enter/Space already fires a click that bubbles here — handling the keydown
     * too would toggle twice (open then immediately close).
     */
    onKeydown(event: Event): void {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        this.onClick();
    }
}
