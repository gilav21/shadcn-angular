import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    TabsComponent,
    TabsListComponent,
    TabsTriggerComponent,
    TabsContentComponent,
} from '@/components/ui/tabs';

@Component({
    selector: 'app-tabs-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TabsComponent,
        TabsListComponent,
        TabsTriggerComponent,
        TabsContentComponent,
    ],
    template: `
        <main class="p-8">
            <ui-tabs defaultValue="account">
                <ui-tabs-list>
                    <ui-tabs-trigger value="account" data-testid="trigger-account">Account</ui-tabs-trigger>
                    <ui-tabs-trigger value="password" data-testid="trigger-password">Password</ui-tabs-trigger>
                    <ui-tabs-trigger value="billing" data-testid="trigger-billing">Billing</ui-tabs-trigger>
                </ui-tabs-list>
                <ui-tabs-content value="account">
                    <p data-testid="content-account">Account settings</p>
                </ui-tabs-content>
                <ui-tabs-content value="password">
                    <p data-testid="content-password">Change your password</p>
                </ui-tabs-content>
                <ui-tabs-content value="billing">
                    <p data-testid="content-billing">Manage billing</p>
                </ui-tabs-content>
            </ui-tabs>
        </main>
    `,
})
export class TabsDemoComponent {}
