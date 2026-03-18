import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  MenubarComponent,
  MenubarContentComponent,
  MenubarItemComponent,
  MenubarMenuComponent,
  MenubarSeparatorComponent,
  MenubarShortcutComponent,
  MenubarSubComponent,
  MenubarSubContentComponent,
  MenubarSubTriggerComponent,
  MenubarTriggerComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-menubar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MenubarComponent,
    MenubarMenuComponent,
    MenubarTriggerComponent,
    MenubarContentComponent,
    MenubarItemComponent,
    MenubarSeparatorComponent,
    MenubarShortcutComponent,
    MenubarSubComponent,
    MenubarSubTriggerComponent,
    MenubarSubContentComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="menubar" class="text-2xl font-semibold scroll-m-20">Menubar</h2>
      <p class="text-muted-foreground">A horizontal menu bar with dropdown menus.</p>

      <ui-menubar>
        <ui-menubar-menu>
          <ui-menubar-trigger>File</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item>New Tab <ui-menubar-shortcut>⌘T</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item>New Window <ui-menubar-shortcut>⌘N</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item disabled>New Incognito Window</ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-sub>
              <ui-menubar-sub-trigger>Share</ui-menubar-sub-trigger>
              <ui-menubar-sub-content>
                <ui-menubar-sub>
                  <ui-menubar-sub-trigger>Email</ui-menubar-sub-trigger>
                  <ui-menubar-sub-content>
                    <ui-menubar-item>Personal</ui-menubar-item>
                    <ui-menubar-item>Work</ui-menubar-item>
                  </ui-menubar-sub-content>
                </ui-menubar-sub>
                <ui-menubar-item>Messages</ui-menubar-item>
                <ui-menubar-item>Notes</ui-menubar-item>
              </ui-menubar-sub-content>
            </ui-menubar-sub>
            <ui-menubar-separator />
            <ui-menubar-item>Print <ui-menubar-shortcut>⌘P</ui-menubar-shortcut></ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
        <ui-menubar-menu>
          <ui-menubar-trigger>Edit</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item>Undo <ui-menubar-shortcut>⌘Z</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item>Redo <ui-menubar-shortcut>⇧⌘Z</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item>Cut <ui-menubar-shortcut>⌘X</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item>Copy <ui-menubar-shortcut>⌘C</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item>Paste <ui-menubar-shortcut>⌘V</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item>Select All <ui-menubar-shortcut>⌘A</ui-menubar-shortcut></ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
        <ui-menubar-menu>
          <ui-menubar-trigger>View</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item [inset]="true">Reload <ui-menubar-shortcut>⌘R</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item [inset]="true" [disabled]="true">Force Reload
              <ui-menubar-shortcut>⇧⌘R</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item [inset]="true">Toggle Fullscreen</ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item [inset]="true">Hide Sidebar</ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
        <ui-menubar-menu>
          <ui-menubar-trigger>Profiles</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item [inset]="true">Andy</ui-menubar-item>
            <ui-menubar-item [inset]="true">Benoit</ui-menubar-item>
            <ui-menubar-item [inset]="true">Luis</ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item [inset]="true">Edit...</ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item [inset]="true">Add Profile...</ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
      </ui-menubar>
    </section>
  `,
})
export class MenubarDemoComponent {}
