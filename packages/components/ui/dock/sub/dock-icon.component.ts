import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-dock-icon',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './dock-icon.component.html',
    host: { class: 'contents' },
})
export class DockIconComponent {
    /** Extra classes merged onto the icon box. It fills the item, so the icon scales with the dock's hover magnification for free — leave the sizing to the parent. */
    class = input('');
    classes = computed(() => cn('size-full flex items-center justify-center', this.class()));
}
