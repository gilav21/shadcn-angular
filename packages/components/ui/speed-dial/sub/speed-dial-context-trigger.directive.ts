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
    uiSpeedDialContextTrigger = input.required<SpeedDialComponent>();

    onContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const speedDial = this.uiSpeedDialContextTrigger();
        if (!speedDial) return;

        speedDial.showAt(event.clientX, event.clientY);
    }

    onClick(_event: MouseEvent): void {
        const speedDial = this.uiSpeedDialContextTrigger();
        if (speedDial?.open()) {
            speedDial.hide();
        }
    }
}
