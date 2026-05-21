import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-kanban-column-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="classes()" [attr.data-slot]="'kanban-column-header'">
            <ng-content />
        </div>
    `,
    host: { class: 'contents' },
})
export class KanbanColumnHeaderComponent {
    class = input('');
    classes = computed(() => cn('flex items-center justify-between p-3', this.class()));
}
