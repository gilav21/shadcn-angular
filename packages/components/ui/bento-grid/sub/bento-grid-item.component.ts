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
    /** Extra classes merged onto the card, after the built-in border/padding/hover utilities. */
    readonly class = input<string>('');
    /** How many grid columns the card spans (`grid-column: span N`). Static markup only — this item is not the one `ui-bento-grid` drags and resizes; that one is driven by {@link BentoGridComponent.items}. */
    readonly span = input<number>(1);
    /** How many grid rows the card spans (`grid-row: span N`). */
    readonly rowSpan = input<number>(1);

    readonly classes = computed(() => cn(
        'group/bento row-span-1 flex flex-col justify-between space-y-4 rounded-xl border bg-white p-4 shadow-input shadow-none transition duration-200 hover:shadow-xl dark:border-white/[0.2] dark:bg-black dark:shadow-none overflow-hidden',
        this.class()
    ));
}
