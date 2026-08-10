import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * Header action slot (custom mode). Rendered beside the chevron, outside the
 * toggle button, so action clicks never toggle the panel. Intended to hold
 * `ui-button` controls.
 */
@Component({
  selector: 'ui-card-accordion-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"card-accordion-actions"',
    '(click)': 'onClick($event)',
  },
})
export class CardAccordionActionsComponent {
  /** Extra classes merged onto the action row. It sits outside the toggle button, so buttons projected here stay independently focusable. */
  readonly class = input('');

  readonly classes = computed(() =>
    cn('flex shrink-0 items-center gap-1', this.class())
  );

  /**
   * Host `click` handler that stops propagation, which is what keeps a click on
   * an action button from also toggling the surrounding card. Every click inside
   * this slot is swallowed, so wire your own handlers on the controls themselves.
   */
  onClick(event: Event): void {
    event.stopPropagation();
  }
}
