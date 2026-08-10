import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-tree-icon',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tree-icon.component.html',
    host: { class: 'contents' },
})
export class TreeIconComponent {
    /** Extra classes merged onto the icon wrapper, after the base `me-2 h-4 w-4 shrink-0` sizing. Host is `contents`, so put layout classes here rather than on the element. */
    class = input('');

    classes = computed(() =>
        cn(
            'me-2 h-4 w-4 shrink-0',
            this.class()
        )
    );
}
