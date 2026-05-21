import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-table',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'table'" role="table">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TableComponent {
    class = input('');

    classes = computed(() => cn('flex flex-col w-full min-h-0', this.class()));
}
