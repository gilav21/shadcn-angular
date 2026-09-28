import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { TOOLTIP } from '../tooltip.component';

@Component({
    selector: 'ui-tooltip-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tooltip-content.component.html',
    host: { class: 'contents' },
})
export class TooltipContentComponent {
    readonly tooltip = inject(TOOLTIP, { optional: true });
    /**
     * Extra classes merged onto the bubble, after the placement classes derived
     * from the parent's `side` — pass positioning utilities here only if you
     * mean to override that placement.
     */
    class = input('');

    classes = computed(() => {
        const side = this.tooltip?.side() ?? 'top';
        // Physical placement pairs with physical margins: a logical me-/ms- flips to the far edge in RTL.
        const sideClasses = {
            top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
            bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
            left: 'right-full top-1/2 -translate-y-1/2 mr-2',
            right: 'left-full top-1/2 -translate-y-1/2 ml-2',
        };
        return cn(
            'absolute z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground',
            sideClasses[side],
            this.class()
        );
    });
}
