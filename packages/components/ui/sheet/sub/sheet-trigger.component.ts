import {
    ChangeDetectionStrategy,
    Component,
    inject,
} from '@angular/core';
import { SHEET } from '../sheet.component';

@Component({
    selector: 'ui-sheet-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'sheet-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class SheetTriggerComponent {
    private readonly sheet = inject(SHEET, { optional: true });

    onClick() {
        this.sheet?.toggle();
    }
}
