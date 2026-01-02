import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  InjectionToken,
} from '@angular/core';
import { cn } from '../lib/utils';

export const ACCORDION = new InjectionToken<AccordionComponent>('ACCORDION');

@Component({
  selector: 'ui-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: ACCORDION, useExisting: AccordionComponent }],
  template: `
    <div [class]="classes()" [attr.data-slot]="'accordion'">
      <ng-content />
    </div>
  `,
  host: { '[class]': '"contents"' },
})
export class AccordionComponent {
  type = input<'single' | 'multiple'>('single');
  class = input('');

  openItems = signal<Set<string>>(new Set());

  classes = computed(() => cn('w-full', this.class()));

  toggle(value: string) {
    const current = this.openItems();
    if (this.type() === 'single') {
      if (current.has(value)) {
        this.openItems.set(new Set());
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
}

@Component({
  selector: 'ui-accordion-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'accordion-item'">
      <ng-content />
    </div>
  `,
  host: { '[class]': '"contents"' },
})
export class AccordionItemComponent {
  value = input.required<string>();
  class = input('');

  classes = computed(() => cn('border-b', this.class()));
}

export const ACCORDION_ITEM = new InjectionToken<AccordionItemComponent>('ACCORDION_ITEM');

@Component({
  selector: 'ui-accordion-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 class="flex">
      <button
        type="button"
        [class]="classes()"
        [attr.aria-expanded]="isOpen()"
        [attr.data-state]="isOpen() ? 'open' : 'closed'"
        [attr.data-slot]="'accordion-trigger'"
        (click)="toggle()"
      >
        <ng-content />
        <svg
          class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
          [class.rotate-180]="isOpen()"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </h3>
  `,
  host: { '[class]': '"contents"' },
})
export class AccordionTriggerComponent {
  class = input('');

  private accordion = inject(ACCORDION, { optional: true });
  private item = inject(AccordionItemComponent, { optional: true });

  isOpen = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.isOpen(val) ?? false : false;
  });

  classes = computed(() =>
    cn(
      'flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180',
      this.class()
    )
  );

  toggle() {
    const val = this.item?.value();
    if (val && this.accordion) {
      this.accordion.toggle(val);
    }
  }
}

@Component({
  selector: 'ui-accordion-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        [class]="classes()"
        [attr.data-state]="isOpen() ? 'open' : 'closed'"
        [attr.data-slot]="'accordion-content'"
      >
        <div class="pb-4 pt-0">
          <ng-content />
        </div>
      </div>
    }
  `,
  host: { '[class]': '"contents"' },
})
export class AccordionContentComponent {
  class = input('');

  private accordion = inject(ACCORDION, { optional: true });
  private item = inject(AccordionItemComponent, { optional: true });

  isOpen = computed(() => {
    const val = this.item?.value();
    return val ? this.accordion?.isOpen(val) ?? false : false;
  });

  classes = computed(() =>
    cn('overflow-hidden text-sm', this.class())
  );
}
