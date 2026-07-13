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
    readonly class = input('');
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

    onClick(event: Event): void {
        event.stopPropagation();
        this.speedDial?.toggle();
    }

    onKeydown(event: Event): void {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        this.onClick(event);
    }
}
