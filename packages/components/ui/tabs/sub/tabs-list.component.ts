import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SkeletonComponent } from '../../skeleton';

@Component({
  selector: 'ui-tabs-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  template: `
    @if (skeleton()) {
      <div [class]="skeletonClasses()" [attr.data-slot]="'tabs-list'">
        @for (item of skeletonItems(); track item) {
          <ui-skeleton class="h-7 w-20 rounded-md" />
        }
      </div>
    } @else {
      <div
        role="tablist"
        [class]="classes()"
        [attr.data-slot]="'tabs-list'"
        [attr.aria-label]="ariaLabel()"
      >
        <ng-content />
      </div>
    }
  `,
  host: { '[class]': '"contents"' },
})
export class TabsListComponent {
  /** Extra classes merged onto the `role="tablist"` bar, after the base pill styling. Applied to the skeleton placeholder too, so the loading bar keeps the same size. */
  class = input('');
  /**
   * Accessible name for the tab list, for pages with more than one set of tabs. Left undefined
   * the `aria-label` attribute is omitted. Not applied to the {@link skeleton} placeholder,
   * which carries no `role="tablist"`.
   */
  ariaLabel = input<string | undefined>(undefined);
  /**
   * Swaps the list for {@link skeletonCount} placeholder bars while data loads. Projected
   * `<ui-tabs-trigger>` children are not rendered at all in this state, and the placeholder has
   * no `role="tablist"`, so screen readers see nothing until it flips back.
   */
  readonly skeleton = input(false);
  /** How many placeholder bars {@link skeleton} renders — set it to the tab count you expect so the bar doesn't resize on load. Ignored unless `skeleton` is `true`. */
  readonly skeletonCount = input(3);

  readonly skeletonItems = computed(() =>
    Array.from({ length: this.skeletonCount() }, (_, i) => i)
  );

  readonly skeletonClasses = computed(() => cn(this.classes(), 'gap-1'));

  classes = computed(() =>
    cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      this.class()
    )
  );
}
