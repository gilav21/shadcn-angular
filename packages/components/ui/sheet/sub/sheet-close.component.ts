import {
    ChangeDetectionStrategy,
    Component,
    inject,
} from '@angular/core';
import { SHEET } from '../sheet.component';

@Component({
    selector: 'ui-sheet-close',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'sheet-close'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class SheetCloseComponent {
    private readonly sheet = inject(SHEET, { optional: true });

    onClick() {
        this.sheet?.hide();
    }
}
