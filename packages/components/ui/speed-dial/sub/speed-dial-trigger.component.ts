import {
    Component,
    ChangeDetectionStrategy,
    ElementRef,
    afterNextRender,
    input,
    computed,
    inject,
    signal,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { hasInteractiveContent } from '../../../lib/a11y';
import { SPEED_DIAL } from '../speed-dial.component';

@Component({
    selector: 'ui-speed-dial-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      [attr.tabindex]="wrapsInteractive() ? null : 0"
      [attr.role]="wrapsInteractive() ? null : 'button'"
      (click)="onClick($event)"
      (keydown.enter)="onKeydown($event)"
      (keydown.space)="onKeydown($event)"
      [class]="classes()"
      [attr.aria-label]="wrapsInteractive() ? null : ariaLabel()"
      [attr.data-slot]="'speed-dial-trigger'"
      [attr.data-state]="speedDial?.open() ? 'open' : 'closed'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class SpeedDialTriggerComponent {
    readonly speedDial = inject(SPEED_DIAL, { optional: true });
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    /**
     * Extra classes for the trigger wrapper, merged after the defaults — which
     * include a `rotate-45` applied while the speed dial is open (the usual
     * "+ turns into ×" effect). Add `[class]="'rotate-0'"` to opt out of the
     * rotation.
     */
    readonly class = input('');
    /**
     * Accessible name for the generated `role="button"` wrapper
     * (default `'Toggle speed dial'`). It is dropped — along with the role and
     * tabindex — when the projected content is already an interactive control,
     * since labelling a role-less span is an ARIA violation; in that case label
     * the projected button instead. See {@link wrapsInteractive}.
     */
    readonly ariaLabel = input('Toggle speed dial');

    /**
     * See `lib/a11y.ts`. When the projected content is already a control the
     * wrapper drops its role, tabindex *and* aria-label: `aria-label` on a
     * role-less generic span is itself an axe `aria-prohibited-attr` violation.
     */
    readonly wrapsInteractive = signal(false);

    readonly classes = computed(() =>
        cn(
            'inline-flex transition-transform duration-200',
            this.speedDial?.open() && 'rotate-45',
            this.class()
        )
    );

    constructor() {
        afterNextRender(() => {
            this.wrapsInteractive.set(hasInteractiveContent(this.host.nativeElement));
        });
    }

    /**
     * Toggles the speed dial open/closed. Stops propagation so the parent's
     * document-level outside-click listener does not immediately close what this
     * click just opened. Does nothing extra when the speed dial is `disabled` —
     * the parent's `toggle()` guards that.
     */
    onClick(event: Event): void {
        event.stopPropagation();
        this.speedDial?.toggle();
    }

    /**
     * Keyboard equivalent of {@link onClick}: Enter and Space toggle the menu.
     * Events that bubbled up from projected content are ignored so a real button
     * inside the trigger does not toggle twice; `preventDefault` stops Space from
     * scrolling the page. There is no Escape handling here — closing by keyboard
     * goes through `ui-speed-dial-mask`.
     */
    onKeydown(event: Event): void {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        this.onClick(event);
    }
}
