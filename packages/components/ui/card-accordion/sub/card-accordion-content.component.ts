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
 * Animated card body (custom mode). Always rendered so the grid-rows
 * `0fr -> 1fr` transition can animate the panel height smoothly; closed content
 * is made `inert` to keep it out of the tab order and accessibility tree.
 */
@Component({
  selector: 'ui-card-accordion-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-accordion-content.component.html',
  host: { '[class]': '"contents"' },
})
export class CardAccordionContentComponent {
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
      'grid transition-[grid-template-rows] duration-300 ease-out',
      this.isOpen() ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      this.class()
    )
  );
}
