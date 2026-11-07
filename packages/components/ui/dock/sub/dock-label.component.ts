import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-dock-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './dock-label.component.html',
    host: { class: 'contents' },
})
export class DockLabelComponent {
    /**
     * Extra classes merged onto the tooltip bubble. It sits on the side of the
     * icon facing away from the dock's edge (above a bottom dock, below a top
     * one, beside a left or right one) and is `hidden` until the enclosing
     * `ui-dock-item` (which carries `group`) is hovered or holds focus, so a
     * tapped button or link item shows it on touch too. Put the name in the
     * icon's accessible name as well.
     */
    class = input('');
    classes = computed(() => cn(
        'absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden whitespace-nowrap z-10 px-2 py-0.5 rounded-md border bg-popover text-popover-foreground text-xs shadow-md',
        'group-hover:block group-focus-within:block',
        // The dock stamps data-position on its bar; the defaults above are the bottom bar's.
        'in-data-[position=top]:bottom-auto in-data-[position=top]:mb-0 in-data-[position=top]:top-full in-data-[position=top]:mt-1',
        'in-data-[position=left]:bottom-auto in-data-[position=left]:mb-0 in-data-[position=left]:top-1/2 in-data-[position=left]:left-full in-data-[position=left]:ml-1 in-data-[position=left]:translate-x-0 in-data-[position=left]:-translate-y-1/2',
        'in-data-[position=right]:bottom-auto in-data-[position=right]:mb-0 in-data-[position=right]:top-1/2 in-data-[position=right]:left-auto in-data-[position=right]:right-full in-data-[position=right]:mr-1 in-data-[position=right]:translate-x-0 in-data-[position=right]:-translate-y-1/2',
        this.class()
    ));
}
