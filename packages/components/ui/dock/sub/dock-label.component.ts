import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-dock-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './dock-label.component.html',
    host: { class: 'contents' },
})
export class DockLabelComponent {
    class = input('');
    classes = computed(() => cn(
        'absolute -top-10 left-1/2 -translate-x-1/2 hidden px-2 py-0.5 rounded-md border bg-popover text-popover-foreground text-xs shadow-md',
        'group-hover:block',
        this.class()
    ));
}
