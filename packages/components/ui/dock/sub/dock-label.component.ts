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
     * Extra classes merged onto the tooltip bubble above the icon.
     * It is `hidden` until the enclosing `ui-dock-item` (which carries `group`)
     * is hovered. Hover-driven, so it never appears on touch; put the name in the icon's accessible name too.
     */
    class = input('');
    classes = computed(() => cn(
        'absolute -top-10 left-1/2 -translate-x-1/2 hidden px-2 py-0.5 rounded-md border bg-popover text-popover-foreground text-xs shadow-md',
        'group-hover:block',
        this.class()
    ));
}
