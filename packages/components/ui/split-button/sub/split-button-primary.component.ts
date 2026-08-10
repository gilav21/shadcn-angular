import {
    Component,
    ChangeDetectionStrategy,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ButtonComponent } from '../../button';
import { SPLIT_BUTTON } from '../split-button.component';

@Component({
    selector: 'ui-split-button-primary',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    template: `
    <ui-button
      [class]="classes()"
      [variant]="splitButton.variant()"
      [size]="splitButton.size()"
      [disabled]="splitButton.disabled()"
      (click)="onClick($event)"
      type="button"
    >
      <ng-content />
    </ui-button>
  `,
    host: { class: 'contents' },
})
export class SplitButtonPrimaryComponent {
    readonly splitButton = inject(SPLIT_BUTTON);

    classes = computed(() => cn('rounded-e-none border-e-0'));

    /**
     * Forwards the click to the parent `ui-split-button` as its `primaryClick`
     * output — this component has no output of its own, so bind the handler on
     * the parent. It leaves the menu's open state untouched.
     */
    onClick(event: MouseEvent): void {
        this.splitButton.primaryClick.emit(event);
    }
}
