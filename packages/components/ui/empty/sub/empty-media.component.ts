import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * EmptyMedia - Container for icon or illustration
 */
@Component({
    selector: 'ui-empty-media',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'empty-media'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class EmptyMediaComponent {
    class = input('');
    variant = input<'default' | 'icon'>('default');

    classes = computed(() => cn(
        'flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        this.variant() === 'icon' && 'bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*="size-"])]:size-6',
        this.class()
    ));
}
