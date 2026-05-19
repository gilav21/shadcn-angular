import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  InjectionToken,
  forwardRef,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ACCORDION } from '../accordion.component';

export const ACCORDION_ITEM = new InjectionToken<AccordionItemComponent>('ACCORDION_ITEM');

@Component({
  selector: 'ui-accordion-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: ACCORDION_ITEM, useExisting: forwardRef(() => AccordionItemComponent) }],
  templateUrl: './accordion-item.component.html',
  host: { '[class]': '"contents"' },
})
export class AccordionItemComponent {
  value = input.required<string>();
  class = input('');

  // Simple mode: title and content inputs
  title = input<string | undefined>(undefined);
  content = input<string | undefined>(undefined);

  private readonly accordion = inject(ACCORDION, { optional: true });

  isOpen = computed(() => {
    return this.accordion?.isOpen(this.value()) ?? false;
  });

  triggerId = computed(() => {
    return this.accordion?.getTriggerId(this.value()) ?? '';
  });

  panelId = computed(() => {
    return this.accordion?.getPanelId(this.value()) ?? '';
  });

  toggle() {
    this.accordion?.toggle(this.value());
  }

  classes = computed(() => cn('border-b', this.class()));
}
