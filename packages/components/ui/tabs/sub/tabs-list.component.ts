import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-tabs-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="tablist"
      [class]="classes()"
      [attr.data-slot]="'tabs-list'"
      [attr.aria-label]="ariaLabel()"
    >
      <ng-content />
    </div>
  `,
  host: { '[class]': '"contents"' },
})
export class TabsListComponent {
  class = input('');
  ariaLabel = input<string | undefined>(undefined);

  classes = computed(() =>
    cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      this.class()
    )
  );
}
