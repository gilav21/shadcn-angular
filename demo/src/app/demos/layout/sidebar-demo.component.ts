import { ChangeDetectionStrategy, Component } from '@angular/core';
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
      <h2 id="sidebar" class="text-2xl font-semibold scroll-m-20">Sidebar</h2>
      <p class="text-muted-foreground">A composable sidebar component for application layouts.</p>

      <div class="border rounded-lg overflow-hidden h-[400px]">
        <ui-sidebar-provider>
          <ui-sidebar>
            <ui-sidebar-header>
              <div class="font-semibold">My App</div>
            </ui-sidebar-header>
            <ui-sidebar-content>
              <ui-sidebar-group>
                <ui-sidebar-group-label>Navigation</ui-sidebar-group-label>
                <ui-sidebar-group-content>
                  <ui-sidebar-menu>
                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#" [isActive]="true">
                        <ui-icon name="home" />
                        <span>Home</span>
                      </ui-sidebar-menu-link>
                    </ui-sidebar-menu-item>
                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#">
                        <ui-icon name="mail" />
                        <span>Inbox</span>
                      </ui-sidebar-menu-link>
                    </ui-sidebar-menu-item>
                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#">
                        <ui-icon name="calendar" />
                        <span>Calendar</span>
                      </ui-sidebar-menu-link>
                    </ui-sidebar-menu-item>
                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#">
                        <ui-icon name="settings" />
                        <span>Settings</span>
                      </ui-sidebar-menu-link>
                    </ui-sidebar-menu-item>
                  </ui-sidebar-menu>
                </ui-sidebar-group-content>
              </ui-sidebar-group>
            </ui-sidebar-content>
            <ui-sidebar-footer>
              <ui-sidebar-separator />
              <div class="text-xs text-muted-foreground">v1.0.0</div>
            </ui-sidebar-footer>
          </ui-sidebar>
          <ui-sidebar-inset>
            <header class="flex h-12 items-center border-b px-4">
              <ui-sidebar-trigger />
              <span class="ml-4 text-sm font-medium">Dashboard</span>
            </header>
            <div class="p-4">
              <p class="text-muted-foreground">
                Main content area. Click the sidebar trigger to toggle.
              </p>
            </div>
          </ui-sidebar-inset>
        </ui-sidebar-provider>
      </div>
    </section>
  `,
})
export class SidebarDemoComponent {}
