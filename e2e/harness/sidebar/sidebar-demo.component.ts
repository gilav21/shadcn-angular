import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    SidebarProviderComponent,
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarContentComponent,
    SidebarGroupComponent,
    SidebarGroupLabelComponent,
    SidebarMenuComponent,
    SidebarMenuItemComponent,
    SidebarMenuButtonComponent,
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
} from '@/components/ui/sidebar';

@Component({
    selector: 'app-sidebar-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SidebarProviderComponent,
        SidebarComponent,
        SidebarHeaderComponent,
        SidebarContentComponent,
        SidebarGroupComponent,
        SidebarGroupLabelComponent,
        SidebarMenuComponent,
        SidebarMenuItemComponent,
        SidebarMenuButtonComponent,
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
    ],
    template: `
        <ui-sidebar-provider>
            <ui-sidebar collapseMode="icon">
                <ui-sidebar-header>
                    <p data-testid="sidebar-header">My App</p>
                </ui-sidebar-header>
                <ui-sidebar-content>
                    <ui-sidebar-group>
                        <ui-sidebar-group-label>Main</ui-sidebar-group-label>
                        <ui-sidebar-menu>
                            <ui-sidebar-menu-item>
                                <ui-sidebar-menu-button data-testid="item-home">Home</ui-sidebar-menu-button>
                            </ui-sidebar-menu-item>
                            <ui-sidebar-menu-item>
                                <ui-sidebar-menu-button data-testid="item-settings">Settings</ui-sidebar-menu-button>
                                <ui-sidebar-menu-badge data-testid="badge">7</ui-sidebar-menu-badge>
                                <ui-sidebar-menu-action
                                    data-testid="action"
                                    label="Settings options"
                                    (triggered)="actions = actions + 1"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="2" /></svg>
                                </ui-sidebar-menu-action>
                            </ui-sidebar-menu-item>
                            <ui-sidebar-menu-item>
                                <ui-sidebar-menu-sub-trigger data-testid="sub-trigger" [sub]="projects">
                                    Projects
                                </ui-sidebar-menu-sub-trigger>
                                <ui-sidebar-menu-sub #projects data-testid="sub">
                                    <ui-sidebar-menu-sub-item>
                                        <ui-sidebar-menu-sub-button data-testid="sub-alpha" href="/alpha">
                                            Alpha
                                        </ui-sidebar-menu-sub-button>
                                    </ui-sidebar-menu-sub-item>
                                    <ui-sidebar-menu-sub-item>
                                        <ui-sidebar-menu-sub-button data-testid="sub-beta" href="/beta">
                                            Beta
                                        </ui-sidebar-menu-sub-button>
                                    </ui-sidebar-menu-sub-item>
                                </ui-sidebar-menu-sub>
                            </ui-sidebar-menu-item>
                            <ui-sidebar-menu-skeleton data-testid="skeleton" [seed]="0" />
                        </ui-sidebar-menu>
                    </ui-sidebar-group>
                </ui-sidebar-content>
                <ui-sidebar-rail data-testid="rail" />
            </ui-sidebar>
            <ui-sidebar-inset>
                <ui-sidebar-trigger data-testid="trigger" />
                <main class="p-4">
                    <p data-testid="main-content">Main content</p>
                </main>
            </ui-sidebar-inset>
        </ui-sidebar-provider>
    `,
})
export class SidebarDemoComponent {
    actions = 0;
}
