import { InjectionToken, type Signal } from '@angular/core';

/**
 * The contract an input group exposes to the controls it contains. Controls read
 * `disabled` so that disabling the group genuinely disables them — dimming the
 * wrapper alone left the inputs focusable and editable.
 */
export interface UiInputGroupContext {
    readonly disabled: Signal<boolean>;
    /**
     * The group's shell style. Controls read it to know whether the group draws a
     * frame on their start and end edges (`outline`) or not (`underline`, `ghost`).
     * Optional so a group that does not report one is treated as `outline`.
     */
    readonly variant?: Signal<'outline' | 'underline' | 'ghost' | null | undefined>;
}

export const UI_INPUT_GROUP = new InjectionToken<UiInputGroupContext>('UI_INPUT_GROUP');
