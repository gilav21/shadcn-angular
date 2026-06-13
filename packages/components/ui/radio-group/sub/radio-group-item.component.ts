import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { RADIO_GROUP } from '../radio-group.component';

@Component({
  selector: 'ui-radio-group-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './radio-group-item.component.html',
  styleUrl: './radio-group-item.component.css',
  host: {
    '[class]': '"contents"',
  },
})
export class RadioGroupItemComponent {
  private static idCounter = 0;

  value = input.required<string>();
  disabled = input(false);
  class = input('');
  ariaLabel = input<string | undefined>(undefined);

  label = input<string | undefined>(undefined);

  private readonly _generatedId = `radio-${++RadioGroupItemComponent.idCounter}`;
  computedId = computed(() => this._generatedId);

  protected readonly group = inject(RADIO_GROUP, { optional: true });

  isSelected = computed(() => this.group?.internalValue() === this.value());
  isDisabled = computed(() => this.disabled() || (this.group?.isDisabled() ?? false));

  classes = computed(() =>
    cn(
      'aspect-square rounded-full border border-primary text-primary shadow outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50 flex items-center justify-center',
      this.isSelected() ? 'border-primary' : 'bg-background',
      this.class()
    )
  );

  select(): void {
    if (this.isDisabled() || !this.group) return;
    this.group.selectValue(this.value());
  }
}
