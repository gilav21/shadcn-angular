import { Meta, StoryObj } from '@storybook/angular';
import {
    SidebarComponent,
    SidebarProviderComponent,
    SidebarHeaderComponent,
    SidebarContentComponent,
    SidebarFooterComponent,
    SidebarGroupComponent,
    SidebarGroupLabelComponent,
    SidebarGroupContentComponent,
    SidebarMenuComponent,
    SidebarMenuItemComponent,
    SidebarMenuButtonComponent,
    SidebarMenuLinkComponent,
    SidebarTriggerComponent,
    SidebarInsetComponent,
    SidebarSeparatorComponent,
} from './sidebar.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<SidebarComponent> = {
    title: 'UI/Sidebar',
    component: SidebarComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                SidebarComponent,
                SidebarProviderComponent,
                SidebarHeaderComponent,
                SidebarContentComponent,
                SidebarFooterComponent,
                SidebarGroupComponent,
                SidebarGroupLabelComponent,
                SidebarGroupContentComponent,
                SidebarMenuComponent,
                SidebarMenuItemComponent,
                SidebarMenuButtonComponent,
                SidebarMenuLinkComponent,
                SidebarTriggerComponent,
                SidebarInsetComponent,
                SidebarSeparatorComponent,
            ],
        }),
    ],
};

export default meta;
type Story = StoryObj<SidebarComponent>;

export const Default: Story = {
    render: () => ({
        template: `
      <ui-sidebar-provider>
        <ui-sidebar>
          <ui-sidebar-header>
            <ui-sidebar-menu>
              <ui-sidebar-menu-item>
                <ui-sidebar-menu-button size="lg" [class]="'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'">
                  <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>
                  </div>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">Acme Inc</span>
                    <span class="truncate text-xs">Enterprise</span>
                  </div>
                </ui-sidebar-menu-button>
              </ui-sidebar-menu-item>
            </ui-sidebar-menu>
          </ui-sidebar-header>
          <ui-sidebar-content>
            <ui-sidebar-group>
              <ui-sidebar-group-label>Platform</ui-sidebar-group-label>
              <ui-sidebar-group-content>
                <ui-sidebar-menu>
                  <ui-sidebar-menu-item>
                    <ui-sidebar-menu-button tooltip="Playground">
                       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="9" y1="3" y2="21"/></svg>
                      <span>Playground</span>
                    </ui-sidebar-menu-button>
                  </ui-sidebar-menu-item>
                   <ui-sidebar-menu-item>
                    <ui-sidebar-menu-button tooltip="Models">
                       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                      <span>Models</span>
                    </ui-sidebar-menu-button>
                  </ui-sidebar-menu-item>
                </ui-sidebar-menu>
              </ui-sidebar-group-content>
            </ui-sidebar-group>
            <ui-sidebar-group>
               <ui-sidebar-group-label>Projects</ui-sidebar-group-label>
               <ui-sidebar-group-content>
                <ui-sidebar-menu>
                   <ui-sidebar-menu-item>
                    <ui-sidebar-menu-button>
                       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span>Design Engineering</span>
                    </ui-sidebar-menu-button>
                  </ui-sidebar-menu-item>
                </ui-sidebar-menu>
               </ui-sidebar-group-content>
            </ui-sidebar-group>
          </ui-sidebar-content>
          <ui-sidebar-footer>
            <ui-sidebar-menu>
              <ui-sidebar-menu-item>
                <ui-sidebar-menu-button>
                  <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">shadcn</span>
                    <span class="truncate text-xs">m@example.com</span>
                  </div>
                </ui-sidebar-menu-button>
              </ui-sidebar-menu-item>
            </ui-sidebar-menu>
          </ui-sidebar-footer>
        </ui-sidebar>
        <ui-sidebar-inset>
            <header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b px-4">
                 <div class="flex items-center gap-2">
                    <ui-sidebar-trigger class="-ml-1"></ui-sidebar-trigger>
                 </div>
            </header>
            <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div class="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-4">
                     Content Area
                </div>
            </div>
        </ui-sidebar-inset>
      </ui-sidebar-provider>
    `,
    }),
};
