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
    content = input<string>('');
    side = input<'top' | 'right' | 'bottom' | 'left'>('top');
    delayDuration = input(200);

    show() {
        this.open.set(true);
    }

    hide() {
        this.open.set(false);
    }
}
