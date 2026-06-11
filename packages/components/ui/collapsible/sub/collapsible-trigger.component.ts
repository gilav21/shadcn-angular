import {
    Component,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import { CollapsibleComponent } from '../collapsible.component';

@Component({
    selector: 'ui-collapsible-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      (click)="onClick()"
      (keydown.enter)="onClick()"
      (keydown.space)="onClick()"
      tabindex="0"
      [attr.data-state]="collapsible?.open() ? 'open' : 'closed'"
      [attr.data-slot]="'collapsible-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class CollapsibleTriggerComponent {
    readonly collapsible = inject(CollapsibleComponent, { optional: true });

    onClick(): void {
        this.collapsible?.toggle();
    }
}
