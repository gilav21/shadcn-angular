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
  /**
   * `'single'` (default) keeps at most one item open — opening one closes the rest;
   * `'multiple'` lets any number stay open and makes {@link collapsible} irrelevant.
   * Also reinterprets {@link openValues}: in `'single'` only its first entry is honoured.
   */
  type = input<'single' | 'multiple'>('single');
  /** Extra classes merged onto the accordion wrapper, after the base `w-full`. Item borders come from `<ui-accordion-item>`, not here. */
  class = input('');
  /**
   * Values of the items to open. Applied whenever the array *reference* changes, overwriting
   * whatever the user had open — pass a new array to drive the accordion, and leave it `null`
   * (the default) for uncontrolled use. It is not two-way: user toggles via {@link toggle}
   * are not written back here.
   */
  openValues = input<string[] | null>(null);
  /**
   * Whether clicking the open item in `'single'` mode closes it, leaving nothing open.
   * Defaults to `true`; set `false` to force one item to always stay open. Ignored when
   * {@link type} is `'multiple'`, where items always toggle closed.
   */
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

  /**
   * Opens the item if closed, closes it otherwise — the single entry point both the projected
   * `<ui-accordion-trigger>` and simple-mode item triggers call. In `'single'` {@link type} this
   * closes the previously open item, and closing the current one is suppressed unless
   * {@link collapsible}. The value is not validated against any rendered item, so an unknown
   * value simply opens nothing. Emits no output — read state back via {@link isOpen}.
   */
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

  /** Whether the item with this value is currently expanded. Reads the live state, which drifts from {@link openValues} once the user toggles anything. */
  isOpen(value: string): boolean {
    return this.openItems().has(value);
  }

  /**
   * The `id` given to that item's trigger button, so its panel can point `aria-labelledby` at it.
   * Namespaced by a per-accordion counter, so two accordions may reuse the same item values.
   * Wired up automatically by the sub-components — call it only when hand-rolling a trigger.
   */
  getTriggerId(value: string): string {
    return `${this.accordionId}-trigger-${value}`;
  }

  /** Counterpart to {@link getTriggerId} for the content panel — the id the trigger's `aria-controls` references. */
  getPanelId(value: string): string {
    return `${this.accordionId}-panel-${value}`;
  }
}
