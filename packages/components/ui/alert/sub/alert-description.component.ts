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
    /** Extra classes merged onto the description host, a block under the title that keeps the leading-icon indent on every wrapped line. Any nested `<p>` already gets relaxed leading, so multi-paragraph bodies need no extra styling. */
    class = input('');

    classes = computed(() => cn('block text-sm [&_p]:leading-relaxed', this.class()));
}
