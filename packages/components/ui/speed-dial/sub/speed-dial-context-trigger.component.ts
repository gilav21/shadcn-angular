import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SPEED_DIAL } from '../speed-dial.component';

/**
 * SpeedDialContextTrigger - Shows the speed dial at mouse position on right-click
 *
 * Usage:
 * <ui-speed-dial type="quarter-circle" direction="down-right">
 *   <ui-speed-dial-context-trigger class="w-full h-48 border rounded">
 *     Right-click anywhere here
 *   </ui-speed-dial-context-trigger>
 *   <ui-speed-dial-menu>
 *     <ui-speed-dial-item>...</ui-speed-dial-item>
 *   </ui-speed-dial-menu>
 * </ui-speed-dial>
 */
@Component({
    selector: 'ui-speed-dial-context-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'hostClasses()',
        '(contextmenu)': 'onContextMenu($event)',
        '(click)': 'onClick($event)',
        '[attr.data-slot]': '"speed-dial-context-trigger"',
    },
})
export class SpeedDialContextTriggerComponent {
    readonly speedDial = inject(SPEED_DIAL, { optional: true });
    class = input('');

    hostClasses = computed(() =>
        cn(
            'relative block',
            this.class()
        )
    );

    onContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this.speedDial?.showAt(x, y);
    }

    onClick(_event: MouseEvent): void {
        if (this.speedDial?.open()) {
            this.speedDial.hide();
        }
    }
}
