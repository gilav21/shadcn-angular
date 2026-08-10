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
    /** Extra classes merged onto the title. Renders as a styled `<div>`, not a heading element — project your own `<h2>`/`<h3>` inside if it must appear in the document outline. */
    class = input('');

    classes = computed(() => cn(
        'text-lg font-medium tracking-tight',
        this.class()
    ));
}
