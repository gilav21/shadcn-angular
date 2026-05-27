import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  IconComponent,
  SidebarComponent,
  SidebarContentComponent,
  SidebarFooterComponent,
  SidebarGroupComponent,
  SidebarGroupContentComponent,
  SidebarGroupLabelComponent,
  SidebarHeaderComponent,
  SidebarInsetComponent,
  SidebarMenuComponent,
  SidebarMenuItemComponent,
  SidebarMenuLinkComponent,
  SidebarProviderComponent,
  SidebarSeparatorComponent,
  SidebarTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SIDEBAR_DEMO_LOCALES } from './sidebar-demo.locales';

@Component({
  selector: 'app-sidebar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    SidebarProviderComponent,
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarContentComponent,
    SidebarFooterComponent,
    SidebarGroupComponent,
    SidebarGroupLabelComponent,
    SidebarGroupContentComponent,
    SidebarMenuComponent,
    SidebarMenuItemComponent,
    SidebarMenuLinkComponent,
    SidebarTriggerComponent,
    SidebarInsetComponent,
    SidebarSeparatorComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="sidebar" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="border rounded-lg overflow-hidden h-[400px]">
        <ui-sidebar-provider>
          <ui-sidebar>
            <ui-sidebar-header>
              <div class="font-semibold">{{ t().appName }}</div>
            </ui-sidebar-header>
            <ui-sidebar-content>
              <ui-sidebar-group>
                <ui-sidebar-group-label>{{ t().navGroup }}</ui-sidebar-group-label>
                <ui-sidebar-group-content>
                  <ui-sidebar-menu>
                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#" [isActive]="true">
                        <ui-icon name="home" />
                        <span>{{ t().navHome }}</span>
                      </ui-sidebar-menu-link>
                    </ui-sidebar-menu-item>
                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#">
                        <ui-icon name="mail" />
                        <span>{{ t().navInbox }}</span>
                      </ui-sidebar-menu-link>
                    </ui-sidebar-menu-item>
                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#">
                        <ui-icon name="calendar" />
                        <span>{{ t().navCalendar }}</span>
                      </ui-sidebar-menu-link>
                    </ui-sidebar-menu-item>
                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#">
                        <ui-icon name="settings" />
                        <span>{{ t().navSettings }}</span>
                      </ui-sidebar-menu-link>
                    </ui-sidebar-menu-item>
                  </ui-sidebar-menu>
                </ui-sidebar-group-content>
              </ui-sidebar-group>
            </ui-sidebar-content>
            <ui-sidebar-footer>
              <ui-sidebar-separator />
              <div class="text-xs text-muted-foreground">{{ t().version }}</div>
            </ui-sidebar-footer>
          </ui-sidebar>
          <ui-sidebar-inset>
            <header class="flex h-12 items-center border-b px-4">
              <ui-sidebar-trigger />
              <span class="ml-4 text-sm font-medium">{{ t().mainContentHeader }}</span>
            </header>
            <div class="p-4">
              <p class="text-muted-foreground">{{ t().mainContent }}</p>
            </div>
          </ui-sidebar-inset>
        </ui-sidebar-provider>
      </div>
    </section>
  `,
})
export class SidebarDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => SIDEBAR_DEMO_LOCALES[this.localeId()] ?? SIDEBAR_DEMO_LOCALES['en']);
}
