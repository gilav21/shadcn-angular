import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-card-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-description"',
    },
})
export class CardDescriptionComponent {
    /** Extra classes merged onto the muted subtitle. Belongs inside `ui-card-header`, where the header grid places it on the row below the title. */
    class = input('');

    classes = computed(() => cn('text-muted-foreground text-sm', this.class()));
}
