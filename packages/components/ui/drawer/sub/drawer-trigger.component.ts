import {
    Component,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import { DRAWER } from '../drawer.component';

@Component({
    selector: 'ui-drawer-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      (click)="onClick()"
      (keydown.enter)="onClick()"
      (keydown.space)="onClick()"
      [attr.data-slot]="'drawer-trigger'"
      tabindex="0"
      role="button"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DrawerTriggerComponent {
    private readonly drawer = inject(DRAWER, { optional: true });

    onClick(): void {
        this.drawer?.toggle();
    }
}
