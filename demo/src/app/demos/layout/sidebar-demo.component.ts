import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  SidebarMenuSubComponent,
  SidebarMenuSubItemComponent,
  SidebarMenuSubButtonComponent,
  SidebarMenuSubTriggerComponent,
  SidebarMenuActionComponent,
  SidebarMenuBadgeComponent,
  SidebarMenuSkeletonComponent,
  SidebarRailComponent,
  SidebarProviderComponent,
  SidebarSeparatorComponent,
  SidebarTriggerComponent,
  type SidebarVariant,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SIDEBAR_DEMO_LOCALES } from './sidebar-demo.locales';

interface VariantTile {
  key: string;
  variant: SidebarVariant;
  variantName: string;
  collapsible: boolean;
  label: string;
}

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
    SidebarMenuSubComponent,
    SidebarMenuSubItemComponent,
    SidebarMenuSubButtonComponent,
    SidebarMenuSubTriggerComponent,
    SidebarMenuActionComponent,
    SidebarMenuBadgeComponent,
    SidebarMenuSkeletonComponent,
    SidebarRailComponent,
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

      <h3 class="text-lg font-medium mt-8">{{ t().variantsHeading }}</h3>
      <p class="text-muted-foreground text-sm">{{ t().variantsCaption }}</p>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        @for (tile of variantTiles(); track tile.key) {
          <div class="space-y-2">
            <p class="text-sm font-medium">{{ tile.label }}</p>
            <div class="border rounded-lg overflow-hidden h-[220px] sm:h-[260px] bg-muted/20">
              <ui-sidebar-provider>
                <ui-sidebar [variant]="tile.variant" [collapsible]="tile.collapsible">
                  <ui-sidebar-header>
                    <div class="font-semibold">{{ t().appName }}</div>
                  </ui-sidebar-header>
                  <ui-sidebar-content>
                    <ui-sidebar-group>
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
                              <ui-icon name="settings" />
                              <span>{{ t().navSettings }}</span>
                            </ui-sidebar-menu-link>
                          </ui-sidebar-menu-item>
                        </ui-sidebar-menu>
                      </ui-sidebar-group-content>
                    </ui-sidebar-group>
                  </ui-sidebar-content>
                </ui-sidebar>
                <ui-sidebar-inset>
                  <header class="flex min-h-12 flex-wrap items-center gap-2 border-b px-4 py-2">
                    <ui-sidebar-trigger />
                    <span class="text-sm font-medium">{{ tile.variantName }}</span>
                  </header>
                </ui-sidebar-inset>
              </ui-sidebar-provider>
            </div>
          </div>
        }
      </div>

      <h3 class="text-lg font-semibold pt-4">Nested menus, badges, actions and the rail</h3>
      <p class="text-muted-foreground text-sm">
        A sub-menu keeps its rows in the DOM and collapses them with a grid-row
        transition, so closing animates; closed rows are <code>inert</code>, so Tab
        skips them. <code>expanded</code> is two-way and defaults to open. Drag-free
        collapse lives on the rail at the sidebar's edge — hover it.
      </p>

      <div class="border rounded-lg overflow-hidden h-[460px]">
        <ui-sidebar-provider [persistCollapsed]="false">
          <ui-sidebar>
            <ui-sidebar-header>
              <div class="font-semibold">Acme Inc</div>
            </ui-sidebar-header>
            <ui-sidebar-content>
              <ui-sidebar-group>
                <ui-sidebar-group-label>Workspace</ui-sidebar-group-label>
                <ui-sidebar-group-content>
                  <ui-sidebar-menu>
                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#" [isActive]="true">
                        <ui-icon name="home" />
                        <span>Dashboard</span>
                      </ui-sidebar-menu-link>
                    </ui-sidebar-menu-item>

                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#">
                        <ui-icon name="mail" />
                        <span>Inbox</span>
                      </ui-sidebar-menu-link>
                      <ui-sidebar-menu-badge>12</ui-sidebar-menu-badge>
                    </ui-sidebar-menu-item>

                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-sub-trigger [sub]="projects">
                        <ui-icon name="folder" />
                        <span>Projects</span>
                      </ui-sidebar-menu-sub-trigger>
                      <ui-sidebar-menu-sub #projects [(expanded)]="projectsOpen">
                        <ui-sidebar-menu-sub-item>
                          <ui-sidebar-menu-sub-button href="#" [isActive]="true">
                            <span>Apollo</span>
                          </ui-sidebar-menu-sub-button>
                        </ui-sidebar-menu-sub-item>
                        <ui-sidebar-menu-sub-item>
                          <ui-sidebar-menu-sub-button href="#">
                            <span>Borealis</span>
                          </ui-sidebar-menu-sub-button>
                        </ui-sidebar-menu-sub-item>
                        <ui-sidebar-menu-sub-item>
                          <ui-sidebar-menu-sub-button href="#">
                            <span>Cartograph</span>
                          </ui-sidebar-menu-sub-button>
                        </ui-sidebar-menu-sub-item>
                      </ui-sidebar-menu-sub>
                    </ui-sidebar-menu-item>

                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-sub-trigger [sub]="team">
                        <ui-icon name="users" />
                        <span>Team</span>
                      </ui-sidebar-menu-sub-trigger>
                      <ui-sidebar-menu-sub #team [(expanded)]="teamOpen">
                        <ui-sidebar-menu-sub-item>
                          <ui-sidebar-menu-sub-button href="#"><span>Members</span></ui-sidebar-menu-sub-button>
                        </ui-sidebar-menu-sub-item>
                        <ui-sidebar-menu-sub-item>
                          <ui-sidebar-menu-sub-button href="#"><span>Invitations</span></ui-sidebar-menu-sub-button>
                        </ui-sidebar-menu-sub-item>
                      </ui-sidebar-menu-sub>
                    </ui-sidebar-menu-item>

                    <ui-sidebar-menu-item>
                      <ui-sidebar-menu-link href="#">
                        <ui-icon name="settings" />
                        <span>Settings</span>
                      </ui-sidebar-menu-link>
                      <ui-sidebar-menu-action label="Settings options" (triggered)="lastAction.set('settings')">
                        <ui-icon name="more-horizontal" />
                      </ui-sidebar-menu-action>
                    </ui-sidebar-menu-item>
                  </ui-sidebar-menu>
                </ui-sidebar-group-content>
              </ui-sidebar-group>

              <ui-sidebar-group>
                <ui-sidebar-group-label>Loading</ui-sidebar-group-label>
                <ui-sidebar-group-content>
                  <ui-sidebar-menu>
                    @for (row of [0, 1, 2]; track row) {
                      <ui-sidebar-menu-skeleton [seed]="row" />
                    }
                  </ui-sidebar-menu>
                </ui-sidebar-group-content>
              </ui-sidebar-group>
            </ui-sidebar-content>
            <ui-sidebar-rail />
          </ui-sidebar>
          <ui-sidebar-inset class="p-4">
            <ui-sidebar-trigger />
            <p class="text-sm text-muted-foreground pt-2">
              Projects open: {{ projectsOpen() }} · Team open: {{ teamOpen() }}
              @if (lastAction()) { · last action: {{ lastAction() }} }
            </p>
          </ui-sidebar-inset>
        </ui-sidebar-provider>
      </div>
    </section>
  `,
})
export class SidebarDemoComponent {
  readonly projectsOpen = signal(true);
  readonly teamOpen = signal(false);
  readonly lastAction = signal('');

  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => SIDEBAR_DEMO_LOCALES[this.localeId()] ?? SIDEBAR_DEMO_LOCALES['en']);

  protected readonly variantTiles = computed<VariantTile[]>(() => {
    const loc = this.t();
    return [
      { key: 'sidebar', variant: 'sidebar', variantName: 'sidebar', collapsible: true, label: loc.variantSidebarLabel },
      { key: 'floating', variant: 'floating', variantName: 'floating', collapsible: true, label: loc.variantFloatingLabel },
      { key: 'inset', variant: 'inset', variantName: 'inset', collapsible: true, label: loc.variantInsetLabel },
      { key: 'pinned', variant: 'sidebar', variantName: 'collapsible = false', collapsible: false, label: loc.variantPinnedLabel },
    ];
  });
}
