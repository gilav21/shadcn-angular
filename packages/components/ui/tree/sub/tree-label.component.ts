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
    class = input('');

    classes = computed(() =>
        cn(
            'flex-1 truncate',
            this.class()
        )
    );
}
