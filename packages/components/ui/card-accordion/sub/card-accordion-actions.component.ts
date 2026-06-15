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
  readonly class = input('');

  readonly classes = computed(() =>
    cn('flex shrink-0 items-center gap-1', this.class())
  );

  onClick(event: Event): void {
    event.stopPropagation();
  }
}
