import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * EmptyTitle - Title text
 */
@Component({
    selector: 'ui-empty-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'empty-title'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class EmptyTitleComponent {
    class = input('');

    classes = computed(() => cn(
        'text-lg font-medium tracking-tight',
        this.class()
    ));
}
