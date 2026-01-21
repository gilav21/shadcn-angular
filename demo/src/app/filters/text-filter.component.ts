import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { InputComponent } from '@/components/ui';

@Component({
    selector: 'app-text-filter',
    standalone: true,
    template: `
    <ui-input
      type="text"
      placeholder="Filter..."
      class="h-8 w-full"
      (input)="onInputChange($event)"
    />
  `,
    imports: [InputComponent],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextFilterComponent {
    filterChange = output<string>();

    onInputChange(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        this.filterChange.emit(value);
    }
}
