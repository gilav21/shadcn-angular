import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SPEED_DIAL } from '../speed-dial.component';

@Component({
    selector: 'ui-speed-dial-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      (click)="onClick($event)"
      [class]="classes()"
      [attr.aria-label]="ariaLabel()"
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
    class = input('');
    ariaLabel = input('Toggle speed dial');

    classes = computed(() =>
        cn(
            'inline-flex transition-transform duration-200',
            this.speedDial?.open() && 'rotate-45',
            this.class()
        )
    );

    onClick(event: MouseEvent) {
        event.stopPropagation();
        this.speedDial?.toggle();
    }
}
