import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-timeline-dot',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-dot'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TimelineDotComponent {
    class = input('');
    variant = input<'default' | 'filled' | 'outline' | 'success' | 'error' | 'warning'>('default');

    classes = computed(() =>
        cn(
            'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            {
                'border-border bg-background': this.variant() === 'default',
                'border-primary bg-primary text-primary-foreground': this.variant() === 'filled',
                'border-primary bg-background': this.variant() === 'outline',
                'border-green-500 bg-green-500 text-white': this.variant() === 'success',
                'border-destructive bg-destructive text-destructive-foreground': this.variant() === 'error',
                'border-yellow-500 bg-yellow-500 text-white': this.variant() === 'warning',
            },
            this.class()
        )
    );
}
