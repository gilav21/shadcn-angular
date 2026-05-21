import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    DropdownMenuComponent,
    DropdownMenuTriggerComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
} from '@/components/ui/dropdown-menu';

@Component({
    selector: 'app-dropdown-menu-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DropdownMenuComponent,
        DropdownMenuTriggerComponent,
        DropdownMenuContentComponent,
        DropdownMenuItemComponent,
    ],
    template: `
        <main class="p-8">
            <ui-dropdown-menu>
                <ui-dropdown-menu-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1 rounded">Open menu</button>
                </ui-dropdown-menu-trigger>
                <ui-dropdown-menu-content>
                    <ui-dropdown-menu-item data-testid="item-profile" (click)="pick('profile')">
                        Profile
                    </ui-dropdown-menu-item>
                    <ui-dropdown-menu-item data-testid="item-settings" (click)="pick('settings')">
                        Settings
                    </ui-dropdown-menu-item>
                </ui-dropdown-menu-content>
            </ui-dropdown-menu>
            <p data-testid="selected">{{ selected() }}</p>
        </main>
    `,
})
export class DropdownMenuDemoComponent {
    protected readonly selected = signal('');
    protected pick(name: string): void {
        this.selected.set(name);
    }
}
