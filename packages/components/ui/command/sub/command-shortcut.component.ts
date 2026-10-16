import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-command-shortcut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()" [attr.data-slot]="'command-shortcut'">
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class CommandShortcutComponent {
  /** Extra classes merged onto the hint, after the muted `text-xs` default — so a `text-*` here wins. */
  readonly class = input('');

  readonly classes = computed(() =>
    cn('text-xs tracking-widest text-muted-foreground ltr:ml-auto rtl:mr-auto', this.class()),
  );
}
