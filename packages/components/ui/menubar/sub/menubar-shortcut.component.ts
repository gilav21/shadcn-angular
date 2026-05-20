import {
  Component,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'ui-menubar-shortcut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="text-xs tracking-widest text-muted-foreground ltr:ml-auto rtl:mr-auto" [attr.data-slot]="'menubar-shortcut'">
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class MenubarShortcutComponent { }
