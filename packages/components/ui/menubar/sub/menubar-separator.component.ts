import {
  Component,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'ui-menubar-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="-mx-1 my-1 h-px bg-muted" [attr.data-slot]="'menubar-separator'"></div>
  `,
  host: { class: 'contents' },
})
export class MenubarSeparatorComponent { }
