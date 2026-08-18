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
    /** Extra classes merged onto the header row (`flex items-center justify-between p-3`). Projecting this component replaces the built-in header entirely, so the card count badge, add button and collapse toggle are yours to reproduce. */
    class = input('');
    classes = computed(() => cn('flex items-center justify-between p-3', this.class()));
}
