import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-menubar-shortcut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()" [attr.data-slot]="'menubar-shortcut'">
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class MenubarShortcutComponent {
  /** Extra classes merged onto the element this component renders, after its built-in styling. */
  readonly class = input('');
  readonly classes = computed(() => cn('text-xs tracking-widest text-muted-foreground ltr:ml-auto rtl:mr-auto', this.class()));
}
