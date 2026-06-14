import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ACCORDION } from '../../accordion';
import { SkeletonComponent } from '../../skeleton';

/**
 * A single card panel. Supports simple mode (title/description/content inputs)
 * and custom mode (projected trigger/actions/content).
 */
@Component({
  selector: 'ui-card-accordion-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  templateUrl: './card-accordion-item.component.html',
  host: { '[class]': '"contents"' },
})
export class CardAccordionItemComponent {
  /** Unique identifier shared with the parent accordion's open-state map. */
  readonly value = input.required<string>();
  readonly class = input('');
  readonly skeleton = input(false);

  /** Simple mode: header title text. */
  readonly title = input<string | undefined>(undefined);
  /** Simple mode: optional muted subtitle under the title. */
  readonly description = input<string | undefined>(undefined);
  /** Simple mode: body text. */
  readonly content = input<string | undefined>(undefined);

  private readonly accordion = inject(ACCORDION, { optional: true });

  readonly isOpen = computed(() => this.accordion?.isOpen(this.value()) ?? false);
  readonly triggerId = computed(() => this.accordion?.getTriggerId(this.value()) ?? '');
  readonly panelId = computed(() => this.accordion?.getPanelId(this.value()) ?? '');

  readonly classes = computed(() =>
    cn(
      'overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow duration-200',
      this.isOpen() && 'shadow-md',
      this.class()
    )
  );

  readonly contentClasses = computed(() =>
    cn(
      'grid transition-[grid-template-rows] duration-300 ease-out',
      this.isOpen() ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
    )
  );

  toggle(): void {
    this.accordion?.toggle(this.value());
  }
}
