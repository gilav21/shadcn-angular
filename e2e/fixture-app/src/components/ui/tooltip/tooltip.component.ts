import {
    Component,
    ChangeDetectionStrategy,
    input,
    signal,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { TooltipContentComponent } from './sub/tooltip-content.component';

export const TOUCH_AUTO_DISMISS_MS = 2500;

export const TOOLTIP = new InjectionToken<TooltipComponent>('TOOLTIP');

@Component({
    selector: 'ui-tooltip',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [forwardRef(() => TooltipContentComponent)],
    providers: [{ provide: TOOLTIP, useExisting: forwardRef(() => TooltipComponent) }],
    template: `
    <ng-content />
    @if (content()) {
      <ui-tooltip-content>{{ content() }}</ui-tooltip-content>
    }
  `,
    host: { class: 'relative inline-block' },
})
export class TooltipComponent {
    open = signal(false);
    /**
     * Simple mode: the tooltip text. When set, a `ui-tooltip-content` is
     * rendered for you — leave it empty and project your own
     * `ui-tooltip-content` if you need markup inside the bubble.
     */
    content = input<string>('');
    /**
     * Side of the trigger the bubble is placed on. Read by
     * `ui-tooltip-content`, which positions absolutely inside this host — there
     * is no viewport flipping here, so a tooltip near an edge can clip. Use the
     * `[uiTooltip]` directive instead when you need auto-flip.
     */
    side = input<'top' | 'right' | 'bottom' | 'left'>('top');
    /**
     * Hover dwell time in ms before opening. Applies to pointer hover only —
     * keyboard focus and touch taps open immediately.
     */
    delayDuration = input(200);

    /**
     * Opens the tooltip. Called by `ui-tooltip-trigger` after
     * {@link delayDuration} on hover, and immediately on focus or touch tap.
     */
    show(): void {
        this.open.set(true);
    }

    /**
     * Closes the tooltip — on pointer leave, blur, a second tap, or the touch
     * auto-dismiss timeout. Tooltips never trap focus and Escape is not handled.
     */
    hide(): void {
        this.open.set(false);
    }
}
