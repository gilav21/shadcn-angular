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
  class = input('');
  ariaLabel = input<string | undefined>(undefined);
  readonly skeleton = input(false);
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
