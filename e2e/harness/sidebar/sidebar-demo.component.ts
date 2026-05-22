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
                            </ui-sidebar-menu-item>
                        </ui-sidebar-menu>
                    </ui-sidebar-group>
                </ui-sidebar-content>
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
export class SidebarDemoComponent {}
