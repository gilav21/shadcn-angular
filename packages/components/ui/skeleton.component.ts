import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-skeleton',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"skeleton"',
    },
})
export class SkeletonComponent {
    class = input('');

    classes = computed(() =>
        cn('animate-pulse rounded-md bg-primary/10', this.class())
    );
}
