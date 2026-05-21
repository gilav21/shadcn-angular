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
  selector: 'ui-accordion-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accordion-content.component.html',
  host: { '[class]': '"contents"' },
})
export class AccordionContentComponent {
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
    cn('overflow-hidden text-sm', this.class())
  );
}
