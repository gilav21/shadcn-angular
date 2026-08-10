import {
    Directive,
    input,
} from '@angular/core';
import { SpeedDialComponent } from '../speed-dial.component';

/**
 * SpeedDialContextTriggerDirective - Directive version for use on any element
 *
 * Usage:
 * <ui-speed-dial #contextMenu type="quarter-circle" direction="down-right">
 *   <ui-speed-dial-menu>
 *     <ui-speed-dial-item>...</ui-speed-dial-item>
 *   </ui-speed-dial-menu>
 * </ui-speed-dial>
 *
 * <div [uiSpeedDialContextTrigger]="contextMenu">
 *   Right-click anywhere here
 * </div>
 */
@Directive({
    selector: '[uiSpeedDialContextTrigger]',
    host: {
        '(contextmenu)': 'onContextMenu($event)',
        '(click)': 'onClick($event)',
    },
})
export class SpeedDialContextTriggerDirective {
    /**
     * The `ui-speed-dial` instance this element controls, normally passed as a
     * template reference variable. Required — the directive drives the speed dial
     * from the outside instead of through the `SPEED_DIAL` injection token, so
     * the speed dial can live anywhere in the template. The host element is also
     * what `showAt()` clamps against when it looks for its container.
     */
    uiSpeedDialContextTrigger = input.required<SpeedDialComponent>();

    /**
     * Suppresses the native context menu and opens the referenced speed dial at
     * the pointer, passing viewport coordinates (`clientX`/`clientY`) to
     * `showAt()`, which clamps them so the menu stays on screen.
     *
     * Right-click / two-finger-tap only — there is no long-press fallback, so
     * touch-only users cannot reach it; give them a `ui-speed-dial-trigger` too.
     */
    onContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const speedDial = this.uiSpeedDialContextTrigger();
        if (!speedDial) return;

        speedDial.showAt(event.clientX, event.clientY);
    }

    /**
     * Closes the referenced speed dial on any left-click on the host, matching
     * context-menu behaviour: {@link onContextMenu} opens, a plain click
     * dismisses. Does nothing when the menu is already closed.
     */
    onClick(_event: MouseEvent): void {
        const speedDial = this.uiSpeedDialContextTrigger();
        if (speedDial?.open()) {
            speedDial.hide();
        }
    }
}
