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
  host: { '[class]': '"contents"' },
})
export class CardAccordionTriggerComponent {
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
      'flex flex-1 items-center justify-between gap-3 p-4 text-start text-base font-semibold transition-colors hover:bg-accent/40 sm:p-6',
      this.class()
    )
  );

  toggle(): void {
    const val = this.item?.value();
    if (val && this.accordion) {
      this.accordion.toggle(val);
    }
  }
}
