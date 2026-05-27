import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  DropdownMenuComponent,
  DropdownMenuContentComponent,
  DropdownMenuItemComponent,
  DropdownMenuLabelComponent,
  DropdownMenuSeparatorComponent,
  DropdownMenuSubComponent,
  DropdownMenuSubContentComponent,
  DropdownMenuSubTriggerComponent,
  DropdownMenuTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { DROPDOWN_MENU_DEMO_LOCALES } from './dropdown-menu-demo.locales';

@Component({
  selector: 'app-dropdown-menu-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    DropdownMenuComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
    DropdownMenuLabelComponent,
    DropdownMenuSeparatorComponent,
    DropdownMenuSubComponent,
    DropdownMenuSubContentComponent,
    DropdownMenuSubTriggerComponent,
    DropdownMenuTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="dropdown-menu" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-col gap-8">
        <div class="space-y-4">
          <h3 class="text-lg font-medium">{{ t().simpleModeHeading }}</h3>
          <ui-dropdown-menu [items]="t().simpleItems">
            <ui-dropdown-menu-trigger>
              <ui-button variant="outline">{{ t().openDataLabel }}</ui-button>
            </ui-dropdown-menu-trigger>
          </ui-dropdown-menu>
        </div>

        <div class="space-y-4">
          <h3 class="text-lg font-medium">{{ t().complexModeHeading }}</h3>
          <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>
              <ui-button variant="outline">{{ t().openTemplateLabel }}</ui-button>
            </ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content class="w-56">
              <ui-dropdown-menu-label>{{ t().myAccountLabel }}</ui-dropdown-menu-label>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item shortcut="&#8679;&#8984;P">{{ t().profileLabel }}</ui-dropdown-menu-item>
              <ui-dropdown-menu-item shortcut="&#8984;B">{{ t().billingLabel }}</ui-dropdown-menu-item>
              <ui-dropdown-menu-item shortcut="&#8984;S">{{ t().settingsLabel }}</ui-dropdown-menu-item>
              <ui-dropdown-menu-item shortcut="&#8984;K">{{ t().keyboardShortcutsLabel }}</ui-dropdown-menu-item>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item>{{ t().teamLabel }}</ui-dropdown-menu-item>
              <ui-dropdown-menu-sub>
                <ui-dropdown-menu-sub-trigger>{{ t().inviteUsersLabel }}</ui-dropdown-menu-sub-trigger>
                <ui-dropdown-menu-sub-content>
                  <ui-dropdown-menu-item>{{ t().emailLabel }}</ui-dropdown-menu-item>
                  <ui-dropdown-menu-item>{{ t().messageLabel }}</ui-dropdown-menu-item>
                  <ui-dropdown-menu-separator />
                  <ui-dropdown-menu-item>{{ t().moreLabel }}</ui-dropdown-menu-item>
                </ui-dropdown-menu-sub-content>
              </ui-dropdown-menu-sub>
              <ui-dropdown-menu-item shortcut="&#8984;+T">{{ t().newTeamLabel }}</ui-dropdown-menu-item>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item>{{ t().githubLabel }}</ui-dropdown-menu-item>
              <ui-dropdown-menu-item>{{ t().supportLabel }}</ui-dropdown-menu-item>
              <ui-dropdown-menu-item [disabled]="true">{{ t().apiLabel }}</ui-dropdown-menu-item>
              <ui-dropdown-menu-separator />
              <ui-dropdown-menu-item shortcut="&#8679;&#8984;Q">{{ t().logOutLabel }}</ui-dropdown-menu-item>
            </ui-dropdown-menu-content>
          </ui-dropdown-menu>
        </div>
      </div>
    </section>
  `,
})
export class DropdownMenuDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => DROPDOWN_MENU_DEMO_LOCALES[this.localeId()] ?? DROPDOWN_MENU_DEMO_LOCALES['en'],
  );
}
