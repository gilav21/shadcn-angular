import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * EmptyDescription - Description text
 */
@Component({
    selector: 'ui-empty-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <p [class]="classes()" [attr.data-slot]="'empty-description'">
      <ng-content />
    </p>
  `,
    host: { class: 'contents' },
})
export class EmptyDescriptionComponent {
    class = input('');

    classes = computed(() => cn(
        'text-muted-foreground text-sm/relaxed [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
        this.class()
    ));
}
