import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './label.component.html',
    host: {
        '[class]': '"contents"',
    },
})
export class LabelComponent {
    /**
     * `id` of the control this label describes, forwarded to the native
     * `<label for>` attribute so clicking the text focuses/toggles that control.
     * Required for screen-reader association when the control is not nested
     * inside the label.
     */
    for = input<string>('');
    /**
     * Extra classes merged onto the inner `<label>`. Note the default styling
     * includes `peer-disabled:*` rules, which only apply when the associated
     * control is a preceding sibling marked `peer`.
     */
    class = input('');

    classes = computed(() =>
        cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            this.class()
        )
    );
}
