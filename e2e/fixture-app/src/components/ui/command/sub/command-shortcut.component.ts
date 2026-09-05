import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';

@Component({
  selector: 'ui-command-shortcut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="text-xs tracking-widest text-muted-foreground ltr:ml-auto rtl:mr-auto" [attr.data-slot]="'command-shortcut'">
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class CommandShortcutComponent { }
