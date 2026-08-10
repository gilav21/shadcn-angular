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
    /**
     * Extra classes for the host, merged after the `relative block` defaults that
     * make it the positioning context for the menu. This is where the hit area is
     * sized — the element has no intrinsic size, so give it dimensions
     * (e.g. `w-full h-48`) or right-clicking has nothing to land on.
     */
    class = input('');

    hostClasses = computed(() =>
        cn(
            'relative block',
            this.class()
        )
    );

    /**
     * Replaces the native context menu: suppresses the browser menu, stops the
     * event, and opens the speed dial at the pointer via `showAt()`. Coordinates
     * are passed relative to this element's bounding box, not the viewport.
     *
     * Right-click / two-finger-tap only — there is no long-press fallback, so on
     * a touch-only device this trigger cannot be opened at all. Provide a normal
     * `ui-speed-dial-trigger` as well if touch users need access.
     */
    onContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this.speedDial?.showAt(x, y);
    }

    /**
     * Dismisses an open menu on any left-click inside the trigger area, so the
     * region behaves like a context menu: right-click to open (see
     * {@link onContextMenu}), click anywhere to dismiss. Clicks while closed do
     * nothing — it never opens the menu.
     */
    onClick(_event: MouseEvent): void {
        if (this.speedDial?.open()) {
            this.speedDial.hide();
        }
    }
}
