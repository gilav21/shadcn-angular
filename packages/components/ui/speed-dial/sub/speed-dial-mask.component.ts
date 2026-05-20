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
    selector: 'ui-speed-dial-mask',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (speedDial?.open()) {
      <div
        [class]="classes()"
        (click)="onClick()"
        [attr.data-slot]="'speed-dial-mask'"
      ></div>
    }
  `,
    host: { class: 'contents' },
})
export class SpeedDialMaskComponent {
    readonly speedDial = inject(SPEED_DIAL, { optional: true });
    class = input('');

    classes = computed(() =>
        cn(
            'fixed inset-0 z-40 bg-background/80 backdrop-blur-sm',
            'animate-in fade-in-0',
            this.class()
        )
    );

    onClick() {
        this.speedDial?.hide();
    }
}
