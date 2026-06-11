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
    <span (click)="onClick()" (keydown.enter)="onClick()" (keydown.space)="onClick()" tabindex="0" role="button" [attr.data-slot]="'sheet-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class SheetTriggerComponent {
    private readonly sheet = inject(SHEET, { optional: true });

    onClick(): void {
        this.sheet?.toggle();
    }
}
