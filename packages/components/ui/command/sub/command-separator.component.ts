import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';

@Component({
  selector: 'ui-command-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="-mx-1 h-px bg-border" [attr.data-slot]="'command-separator'"></div>
  `,
  host: { class: 'contents' },
})
export class CommandSeparatorComponent { }
