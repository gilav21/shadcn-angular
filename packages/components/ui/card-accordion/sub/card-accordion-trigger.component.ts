import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ACCORDION } from '../../accordion';
import { CardAccordionItemComponent } from './card-accordion-item.component';

/**
 * Clickable card header (custom mode). Projected title content sits on the start
 * side; the chevron rotates on open. Action controls are projected via
 * `ui-card-accordion-actions` and rendered outside the toggle button so their
 * clicks never toggle the panel.
 */
@Component({
  selector: 'ui-card-accordion-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-accordion-trigger.component.html',
  styleUrl: './card-accordion-trigger.component.css',
  host: { '[class]': '"contents"' },
})
export class CardAccordionTriggerComponent {
  /** Extra classes merged onto the header button. It is `flex-1 min-w-0`, so long titles truncate rather than pushing the chevron and actions off the card. */
  readonly class = input('');

  private readonly accordion = inject(ACCORDION, { optional: true });
  private readonly item = inject(CardAccordionItemComponent, { optional: true });

  readonly isOpen = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.isOpen(val) ?? false : false;
  });

  readonly triggerId = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.getTriggerId(val) ?? '' : '';
  });

  readonly panelId = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.getPanelId(val) ?? '' : '';
  });

  readonly classes = computed(() =>
    cn(
      'flex min-w-0 flex-1 items-center rounded-md text-start text-base font-semibold transition-colors',
      this.class()
    )
  );

  /**
   * Toggles the card this trigger belongs to, resolving the item from DI. A
   * no-op outside a `ui-card-accordion-item` inside a `ui-accordion`.
   */
  toggle(): void {
    const val = this.item?.value();
    if (val && this.accordion) {
      this.accordion.toggle(val);
    }
  }
}
