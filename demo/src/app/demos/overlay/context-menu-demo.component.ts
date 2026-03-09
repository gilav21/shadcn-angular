import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuSeparatorComponent,
  ContextMenuShortcutComponent,
  ContextMenuTriggerComponent,
  ContextMenuTriggerDirective,
  IconComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-context-menu-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSeparatorComponent,
    ContextMenuShortcutComponent,
    ContextMenuTriggerComponent,
    ContextMenuTriggerDirective,
    IconComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="context-menu" class="text-2xl font-semibold scroll-m-20">Context Menu</h2>
      <p class="text-muted-foreground">A menu that appears on right-click.</p>

      <ui-context-menu>
        <ui-context-menu-trigger>
          <div class="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
            Right click here
          </div>
        </ui-context-menu-trigger>
        <ui-context-menu-content>
          <ui-context-menu-item>
            Back
            <ui-context-menu-shortcut>\u2318[</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Forward
            <ui-context-menu-shortcut>\u2318]</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            Reload
            <ui-context-menu-shortcut>\u2318R</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-separator />
          <ui-context-menu-item>
            Save As...
            <ui-context-menu-shortcut>\u21E7\u2318S</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>Print...</ui-context-menu-item>
        </ui-context-menu-content>
      </ui-context-menu>

      <ui-context-menu #contextMenu>
        <ui-context-menu-content class="w-56">
          <ui-context-menu-item>
            <ui-icon name="pencil" size="sm" class="ltr:mr-2 rtl:ml-2" />
            Edit
            <ui-context-menu-shortcut>\u2318E</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            <ui-icon name="copy" size="sm" class="ltr:mr-2 rtl:ml-2" />
            Copy
            <ui-context-menu-shortcut>\u2318C</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            <ui-icon name="share-2" size="sm" class="ltr:mr-2 rtl:ml-2" />
            Share
          </ui-context-menu-item>
          <ui-context-menu-separator></ui-context-menu-separator>
          <ui-context-menu-item variant="destructive">
            <ui-icon name="trash" size="sm" class="ltr:mr-2 rtl:ml-2" />
            Delete
            <ui-context-menu-shortcut>\u2318\u232B</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-content>
      </ui-context-menu>

      <div [uiContextMenuTrigger]="contextMenu"
        class="h-[300px] w-full flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/50 text-muted-foreground">
        Right-click anywhere in this area to open the context menu
      </div>
    </section>
  `,
})
export class ContextMenuDemoComponent {}
