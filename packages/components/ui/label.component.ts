import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <label [class]="classes()" [attr.for]="for()" [attr.data-slot]="'label'">
      <ng-content />
    </label>
  `,
    host: {
        '[class]': '"contents"',
    },
})
export class LabelComponent {
    for = input<string>('');
    class = input('');

    classes = computed(() =>
        cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            this.class()
        )
    );
}
