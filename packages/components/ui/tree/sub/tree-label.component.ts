import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-tree-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tree-label.component.html',
    host: { class: 'contents' },
})
export class TreeLabelComponent {
    /** Extra classes merged onto the label, after the base `flex-1 truncate` — override `truncate` here if long labels should wrap instead of clip. Host is `contents`, so put layout classes here rather than on the element. */
    class = input('');

    classes = computed(() =>
        cn(
            'flex-1 truncate',
            this.class()
        )
    );
}
