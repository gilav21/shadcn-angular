import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  ButtonComponent,
  CommandComponent,
  CommandDialogComponent,
  CommandEmptyComponent,
  CommandGroupComponent,
  CommandInputComponent,
  CommandItemComponent,
  CommandListComponent,
  CommandSeparatorComponent,
  CommandShortcutComponent,
  IconComponent,
  KbdComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-command-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CommandComponent,
    CommandDialogComponent,
    CommandEmptyComponent,
    CommandGroupComponent,
    CommandInputComponent,
    CommandItemComponent,
    CommandListComponent,
    CommandSeparatorComponent,
    CommandShortcutComponent,
    IconComponent,
    KbdComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="command" class="text-2xl font-semibold scroll-m-20">Command</h2>
      <p class="text-muted-foreground">A command palette for quick actions.</p>

      <ui-command class="max-w-md rounded-lg border shadow-md">
        <ui-command-input placeholder="Type a command or search..." />
        <ui-command-list>
          <ui-command-empty>No results found.</ui-command-empty>
          <ui-command-group heading="Suggestions">
            <ui-command-item value="calendar">
              <ui-icon name="calendar" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>Calendar</span>
            </ui-command-item>
            <ui-command-item value="search-emoji">
              <ui-icon name="smile" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>Search Emoji</span>
            </ui-command-item>
            <ui-command-item value="launch">
              <ui-icon name="zap" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>Launch</span>
            </ui-command-item>
          </ui-command-group>
          <ui-command-separator />
          <ui-command-group heading="Settings">
            <ui-command-item value="profile">
              <ui-icon name="user" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>Profile</span>
              <ui-command-shortcut>\u2318P</ui-command-shortcut>
            </ui-command-item>
            <ui-command-item value="mail">
              <ui-icon name="mail" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>Mail</span>
              <ui-command-shortcut>\u2318B</ui-command-shortcut>
            </ui-command-item>
            <ui-command-item value="settings">
              <ui-icon name="settings" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>Settings</span>
              <ui-command-shortcut>\u2318S</ui-command-shortcut>
            </ui-command-item>
          </ui-command-group>
        </ui-command-list>
      </ui-command>
      <div class="flex flex-col gap-2">
        <ui-button class="w-60" variant="outline" (click)="showCommandDialog.set(true)">Show command
          dialog</ui-button>
        <p class="text-sm text-muted-foreground">Press <ui-kbd>\u2318</ui-kbd> <ui-kbd>K</ui-kbd></p>
      </div>
    </section>

    <ui-command-dialog [(open)]="showCommandDialog">
      <ui-command>
        <ui-command-input placeholder="Type a command or search..." />
        <ui-command-list>
          <ui-command-empty>No results found.</ui-command-empty>
          <ui-command-group heading="Suggestions">
            <ui-command-item value="calendar">Calendar</ui-command-item>
            <ui-command-item value="search-emoji">Search Emoji</ui-command-item>
            <ui-command-item value="launch">Launch</ui-command-item>
          </ui-command-group>
          <ui-command-separator />
          <ui-command-group heading="Settings">
            <ui-command-item value="profile">Profile <ui-command-shortcut>\u2318P</ui-command-shortcut></ui-command-item>
            <ui-command-item value="mail">Mail <ui-command-shortcut>\u2318B</ui-command-shortcut></ui-command-item>
            <ui-command-item value="settings">Settings <ui-command-shortcut>\u2318S</ui-command-shortcut></ui-command-item>
          </ui-command-group>
        </ui-command-list>
      </ui-command>
    </ui-command-dialog>
  `,
})
export class CommandDemoComponent {
  readonly showCommandDialog = signal(false);
}
