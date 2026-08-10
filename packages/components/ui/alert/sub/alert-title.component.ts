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
    /** Extra classes merged onto the title host. Renders as a plain styled `<div>`, not a heading element — add your own `<h2>`/`<h3>` inside if the alert needs to appear in the document outline. */
    class = input('');

    classes = computed(() =>
        cn('mb-1 font-medium leading-none tracking-tight', this.class())
    );
}
