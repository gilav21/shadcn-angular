import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-bento-grid-item',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './bento-grid-item.component.html',
    host: {
        class: 'contents',
    }
})
export class BentoGridItemComponent {
    readonly class = input<string>('');
    readonly span = input<number>(1);
    readonly rowSpan = input<number>(1);

    readonly classes = computed(() => cn(
        'group/bento row-span-1 flex flex-col justify-between space-y-4 rounded-xl border bg-white p-4 shadow-input shadow-none transition duration-200 hover:shadow-xl dark:border-white/[0.2] dark:bg-black dark:shadow-none overflow-hidden',
        this.class()
    ));
}
