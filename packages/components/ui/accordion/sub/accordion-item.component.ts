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
import { SkeletonComponent } from '../../skeleton';

export const ACCORDION_ITEM = new InjectionToken<AccordionItemComponent>('ACCORDION_ITEM');

@Component({
  selector: 'ui-accordion-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  providers: [{ provide: ACCORDION_ITEM, useExisting: forwardRef(() => AccordionItemComponent) }],
  templateUrl: './accordion-item.component.html',
  styleUrl: './accordion-item.component.css',
  host: { '[class]': '"contents"' },
})
export class AccordionItemComponent {
  /**
   * Key identifying this item in the parent accordion's open set and in `[openValues]`.
   * Required, and must be unique within the accordion — duplicates open and close together.
   */
  value = input.required<string>();
  /** Extra classes merged onto the item wrapper, after the base `border-b` — set e.g. `border-none` on the last item. */
  class = input('');
  /**
   * Renders a placeholder header bar instead of the item, for loading states. Takes precedence
   * over both modes: neither {@link title} nor any projected trigger/content is rendered, and
   * the item cannot be opened.
   */
  readonly skeleton = input(false);

  /**
   * Simple mode — supplying a title makes the item render its own trigger button and panel,
   * and any projected `<ui-accordion-trigger>` / `<ui-accordion-content>` is ignored. Leave it
   * undefined to compose those sub-components yourself.
   */
  title = input<string | undefined>(undefined);
  /**
   * Body text for simple mode, rendered as plain text inside the built-in panel. Only read when
   * {@link title} is set; for markup or components, project a `<ui-accordion-content>` instead.
   */
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

  /**
   * Opens or closes this item through the parent accordion, honouring its `type` and
   * `collapsible` rules. Bound to the simple-mode trigger button; safe to call from a
   * template reference to open an item programmatically. No-op outside a `<ui-accordion>`.
   */
  toggle(): void {
    this.accordion?.toggle(this.value());
  }

  classes = computed(() => cn('border-b', this.class()));
}
