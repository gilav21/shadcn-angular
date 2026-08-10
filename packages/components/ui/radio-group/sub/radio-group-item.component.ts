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

  /** Value reported to the parent group when this item is picked; also what the group's current value is compared against for the selected state. */
  value = input.required<string>();
  /** Disables this item only. The parent group's disabled state disables it regardless of this input. */
  disabled = input(false);
  /** Extra classes merged onto the radio dot's visual circle (not the row or the label). */
  class = input('');
  /** `aria-label` for the native radio input. Only applied when {@link label} is unset — with a label the rendered `<label>` names it. */
  ariaLabel = input<string | undefined>(undefined);

  /** Simple mode: renders an associated `<label>` next to the dot, wired to {@link computedId}. */
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

  /** Asks the parent group to select {@link value}. No-op when disabled or when the item is used outside a `ui-radio-group`. */
  select(): void {
    if (this.isDisabled() || !this.group) return;
    this.group.selectValue(this.value());
  }
}
