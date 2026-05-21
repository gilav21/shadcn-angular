import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * ButtonGroupText - Static text element within a button group
 *
 * Usage:
 * <ui-button-group>
 *   <ui-button-group-text>https://</ui-button-group-text>
 *   <ui-input />
 *   <ui-button-group-text>.com</ui-button-group-text>
 * </ui-button-group>
 */
@Component({
    selector: 'ui-button-group-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'button-group-text'"
    >
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class ButtonGroupTextComponent {
    class = input('');

    classes = computed(() => cn(
        'bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs',
        '[&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4',
        this.class()
    ));
}
