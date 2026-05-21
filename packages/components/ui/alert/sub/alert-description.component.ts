import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-alert-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './alert-description.component.html',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"alert-description"',
    },
})
export class AlertDescriptionComponent {
    class = input('');

    classes = computed(() => cn('text-sm [&_p]:leading-relaxed', this.class()));
}
