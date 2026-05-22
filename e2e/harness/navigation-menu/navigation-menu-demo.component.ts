import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    NavigationMenuComponent,
    NavigationMenuListComponent,
    NavigationMenuItemComponent,
    NavigationMenuTriggerComponent,
    NavigationMenuContentComponent,
    NavigationMenuLinkComponent,
} from '@/components/ui/navigation-menu';

@Component({
    selector: 'app-navigation-menu-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NavigationMenuComponent,
        NavigationMenuListComponent,
        NavigationMenuItemComponent,
        NavigationMenuTriggerComponent,
        NavigationMenuContentComponent,
        NavigationMenuLinkComponent,
    ],
    template: `
        <main class="p-8">
            <ui-navigation-menu>
                <ui-navigation-menu-list>
                    <ui-navigation-menu-item>
                        <ui-navigation-menu-trigger data-testid="trigger-getting-started">
                            Getting Started
                        </ui-navigation-menu-trigger>
                        <ui-navigation-menu-content>
                            <ui-navigation-menu-link data-testid="link-intro">
                                Introduction
                            </ui-navigation-menu-link>
                            <ui-navigation-menu-link data-testid="link-install">
                                Installation
                            </ui-navigation-menu-link>
                        </ui-navigation-menu-content>
                    </ui-navigation-menu-item>
                </ui-navigation-menu-list>
            </ui-navigation-menu>
        </main>
    `,
})
export class NavigationMenuDemoComponent {}
