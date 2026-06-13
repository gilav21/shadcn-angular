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

  toggle(): void {
    const val = this.item?.value();
    if (val && this.accordion) {
      this.accordion.toggle(val);
    }
  }
}
