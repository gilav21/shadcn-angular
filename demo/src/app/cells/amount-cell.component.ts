import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
    selector: 'app-amount-cell',
    standalone: true,
    template: `
    <span class="font-mono font-semibold">
      {{ formatAmount() }}
    </span>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AmountCellComponent {
    amount = input.required<number>();

    formatAmount() {
        return `$${this.amount().toFixed(2)}`;
    }
}
