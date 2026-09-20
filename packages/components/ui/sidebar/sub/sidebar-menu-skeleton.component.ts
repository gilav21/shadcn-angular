import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SkeletonComponent } from '../../skeleton';
import { SidebarService } from '../sidebar.service';

/**
 * Placeholder row shown while nav data loads. Matches the height of a real
 * `ui-sidebar-menu-button` so the list does not jump when the data arrives.
 *
 * Widths vary per row so a column of these reads as text rather than as a
 * stack of identical bars. The width is derived from {@link seed} rather than
 * randomised, because a random width would change on every change-detection
 * pass and make the placeholder shimmer at the wrong rhythm.
 */
@Component({
  selector: 'ui-sidebar-menu-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'sidebar-menu-skeleton'"
      [attr.data-collapsed]="isCollapsedState()"
    >
      @if (showIcon()) {
        <ui-skeleton class="size-4 shrink-0 rounded-md" [variant]="variant()" />
      }
      @if (!isCollapsedState()) {
        <ui-skeleton [class]="textBarClasses()" [variant]="variant()" />
      }
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuSkeletonComponent {
  /** Extra classes merged onto the row. */
  readonly class = input('');
  /** Render a leading square for the row's icon. */
  readonly showIcon = input(true);
  /** Placeholder animation, passed through to `ui-skeleton`. */
  readonly variant = input<'pulse' | 'shimmer'>('pulse');
  /**
   * Picks the text bar's width from a fixed set. Pass the loop index
   * (`[seed]="$index"`) so consecutive rows differ; equal seeds give equal
   * widths, which is what keeps the width stable across renders.
   */
  readonly seed = input(0);

  private readonly service = inject(SidebarService);

  private static readonly WIDTHS = ['w-[70%]', 'w-[55%]', 'w-[85%]', 'w-[45%]'] as const;

  readonly isCollapsedState = computed(
    () => this.service.isCollapsed() && !this.service.isMobile()
  );

  readonly textBarClasses = computed(() => {
    const widths = SidebarMenuSkeletonComponent.WIDTHS;
    // Modulo of a possibly-negative seed can be negative; the abs keeps the
    // index inside the array whatever the consumer passes.
    const width = widths[Math.abs(Math.trunc(this.seed())) % widths.length];
    return cn('h-4 rounded-md', width);
  });

  readonly classes = computed(() =>
    cn(
      'flex h-9 items-center gap-2 rounded-md px-2',
      this.isCollapsedState() && 'justify-center',
      this.class()
    )
  );
}
