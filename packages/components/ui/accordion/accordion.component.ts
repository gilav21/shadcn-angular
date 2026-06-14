import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  effect,
  InjectionToken,
  forwardRef,
} from '@angular/core';
import { cn } from '../../lib/utils';

export const ACCORDION = new InjectionToken<AccordionComponent>('ACCORDION');

let accordionIdCounter = 0;

@Component({
  selector: 'ui-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: ACCORDION, useExisting: forwardRef(() => AccordionComponent) }],
  templateUrl: './accordion.component.html',
  host: { '[class]': '"contents"' },
})
export class AccordionComponent {
  type = input<'single' | 'multiple'>('single');
  class = input('');
  openValues = input<string[] | null>(null);
  collapsible = input(true);

  readonly accordionId = `accordion-${++accordionIdCounter}`;
  openItems = signal<Set<string>>(new Set());

  classes = computed(() => cn('w-full', this.class()));

  constructor() {
    effect(() => {
      const values = this.openValues();
      if (values === null) {
        return;
      }

      if (this.type() === 'single') {
        this.openItems.set(values.length > 0 ? new Set([values[0]]) : new Set());
        return;
      }

      this.openItems.set(new Set(values));
    }, { allowSignalWrites: true });
  }

  toggle(value: string): void {
    const current = this.openItems();
    if (this.type() === 'single') {
      if (current.has(value)) {
        if (this.collapsible()) {
          this.openItems.set(new Set());
        }
      } else {
        this.openItems.set(new Set([value]));
      }
    } else {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      this.openItems.set(next);
    }
  }

  isOpen(value: string): boolean {
    return this.openItems().has(value);
  }

  getTriggerId(value: string): string {
    return `${this.accordionId}-trigger-${value}`;
  }

  getPanelId(value: string): string {
    return `${this.accordionId}-panel-${value}`;
  }
}
