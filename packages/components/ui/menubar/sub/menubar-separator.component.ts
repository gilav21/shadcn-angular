import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-menubar-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'menubar-separator'"></div>
  `,
  host: { class: 'contents' },
})
export class MenubarSeparatorComponent {
  /** Extra classes merged onto the element this component renders, after its built-in styling. */
  readonly class = input('');
  readonly classes = computed(() => cn('-mx-1 my-1 h-px bg-muted', this.class()));
}
