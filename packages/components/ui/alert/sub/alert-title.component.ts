import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-alert-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './alert-title.component.html',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"alert-title"',
    },
})
export class AlertTitleComponent {
    class = input('');

    classes = computed(() =>
        cn('mb-1 font-medium leading-none tracking-tight', this.class())
    );
}
