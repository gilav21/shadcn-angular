import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { COMMAND_DEMO_LOCALES } from './command-demo.locales';

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
      <h2 id="command" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-command class="max-w-md rounded-lg border shadow-md">
        <ui-command-input [placeholder]="t().placeholder" />
        <ui-command-list>
          <ui-command-empty>{{ t().noResults }}</ui-command-empty>
          <ui-command-group [heading]="t().suggestionsHeading">
            <ui-command-item value="calendar">
              <ui-icon name="calendar" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>{{ t().calendarLabel }}</span>
            </ui-command-item>
            <ui-command-item value="search-emoji">
              <ui-icon name="smile" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>{{ t().searchEmojiLabel }}</span>
            </ui-command-item>
            <ui-command-item value="launch">
              <ui-icon name="zap" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>{{ t().launchLabel }}</span>
            </ui-command-item>
          </ui-command-group>
          <ui-command-separator />
          <ui-command-group [heading]="t().settingsHeading">
            <ui-command-item value="profile">
              <ui-icon name="user" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>{{ t().profileLabel }}</span>
              <ui-command-shortcut>&#8984;P</ui-command-shortcut>
            </ui-command-item>
            <ui-command-item value="mail">
              <ui-icon name="mail" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>{{ t().mailLabel }}</span>
              <ui-command-shortcut>&#8984;B</ui-command-shortcut>
            </ui-command-item>
            <ui-command-item value="settings">
              <ui-icon name="settings" class="ltr:mr-2 rtl:ml-2 h-4 w-4" />
              <span>{{ t().settingsLabel }}</span>
              <ui-command-shortcut>&#8984;S</ui-command-shortcut>
            </ui-command-item>
          </ui-command-group>
        </ui-command-list>
      </ui-command>
      <div class="flex flex-col gap-2">
        <ui-button class="w-60" variant="outline" (click)="showCommandDialog.set(true)">{{ t().showDialogLabel }}</ui-button>
        <p class="text-sm text-muted-foreground">{{ t().pressHint }} <ui-kbd>&#8984;</ui-kbd> <ui-kbd>K</ui-kbd></p>
      </div>
    </section>

    <ui-command-dialog [(open)]="showCommandDialog">
      <ui-command>
        <ui-command-input [placeholder]="t().placeholder" />
        <ui-command-list>
          <ui-command-empty>{{ t().noResults }}</ui-command-empty>
          <ui-command-group [heading]="t().suggestionsHeading">
            <ui-command-item value="calendar">{{ t().calendarLabel }}</ui-command-item>
            <ui-command-item value="search-emoji">{{ t().searchEmojiLabel }}</ui-command-item>
            <ui-command-item value="launch">{{ t().launchLabel }}</ui-command-item>
          </ui-command-group>
          <ui-command-separator />
          <ui-command-group [heading]="t().settingsHeading">
            <ui-command-item value="profile">{{ t().profileLabel }} <ui-command-shortcut>&#8984;P</ui-command-shortcut></ui-command-item>
            <ui-command-item value="mail">{{ t().mailLabel }} <ui-command-shortcut>&#8984;B</ui-command-shortcut></ui-command-item>
            <ui-command-item value="settings">{{ t().settingsLabel }} <ui-command-shortcut>&#8984;S</ui-command-shortcut></ui-command-item>
          </ui-command-group>
        </ui-command-list>
      </ui-command>
    </ui-command-dialog>
  `,
})
export class CommandDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => COMMAND_DEMO_LOCALES[this.localeId()] ?? COMMAND_DEMO_LOCALES['en'],
  );
  readonly showCommandDialog = signal(false);
}
