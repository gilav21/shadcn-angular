import {
  Component,
  ChangeDetectionStrategy,
  computed,
  forwardRef,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { ACCORDION, AccordionComponent } from '../accordion';

/**
 * Card-styled accordion. Reuses the base accordion state engine (single/multiple
 * open, collapsible, default-open) while rendering each panel as an elevated card
 * with a smooth grid-rows height animation.
 */
@Component({
  selector: 'ui-card-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: ACCORDION, useExisting: forwardRef(() => CardAccordionComponent) }],
  templateUrl: './card-accordion.component.html',
  host: { '[class]': '"contents"' },
})
export class CardAccordionComponent extends AccordionComponent {
  override readonly classes = computed(() =>
    cn('flex w-full flex-col gap-3', this.class())
  );
}
