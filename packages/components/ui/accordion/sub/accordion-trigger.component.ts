import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ACCORDION } from '../accordion.component';
import { AccordionItemComponent } from './accordion-item.component';

@Component({
  selector: 'ui-accordion-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accordion-trigger.component.html',
  styleUrl: './accordion-trigger.component.css',
  host: { '[class]': '"contents"' },
})
export class AccordionTriggerComponent {
  /**
   * Extra classes merged onto the trigger button. The base classes include the
   * `[&[data-state=open]>svg]:rotate-180` rule that flips the chevron, so keep any override
   * additive rather than replacing the selector-based styling. Vertical padding is not in the
   * base set — add your own (e.g. `py-4`) to match simple-mode items.
   */
  class = input('');

  private readonly accordion = inject(ACCORDION, { optional: true });
  private readonly item = inject(AccordionItemComponent, { optional: true });

  isOpen = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.isOpen(val) ?? false : false;
  });

  triggerId = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.getTriggerId(val) ?? '' : '';
  });

  panelId = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.getPanelId(val) ?? '' : '';
  });

  classes = computed(() =>
    cn(
      'flex flex-1 items-center justify-between text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180',
      this.class()
    )
  );

  /**
   * Toggles the enclosing `<ui-accordion-item>` via the accordion, applying its `type` and
   * `collapsible` rules. Already bound to the button's `click`; does nothing unless the trigger
   * is nested inside both a `<ui-accordion-item>` and a `<ui-accordion>`.
   */
  toggle(): void {
    const val = this.item?.value();
    if (val && this.accordion) {
      this.accordion.toggle(val);
    }
  }
}
