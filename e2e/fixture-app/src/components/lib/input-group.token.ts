import { InjectionToken, type Signal } from '@angular/core';

/**
 * The contract an input group exposes to the controls it contains. Controls read
 * `disabled` so that disabling the group genuinely disables them — dimming the
 * wrapper alone left the inputs focusable and editable.
 */
export interface UiInputGroupContext {
    readonly disabled: Signal<boolean>;
}

export const UI_INPUT_GROUP = new InjectionToken<UiInputGroupContext>('UI_INPUT_GROUP');
