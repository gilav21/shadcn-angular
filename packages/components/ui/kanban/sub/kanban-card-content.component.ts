import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-kanban-card-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="classes()" [attr.data-slot]="'kanban-card-content'">
            <ng-content />
        </div>
    `,
    host: { class: 'contents' },
})
export class KanbanCardContentComponent {
    class = input('');
    classes = computed(() => cn('p-3', this.class()));
}
