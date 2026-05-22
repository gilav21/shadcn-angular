import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    MenubarComponent,
    MenubarMenuComponent,
    MenubarTriggerComponent,
    MenubarContentComponent,
    MenubarItemComponent,
} from '@/components/ui/menubar';

@Component({
    selector: 'app-menubar-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MenubarComponent, MenubarMenuComponent, MenubarTriggerComponent,
        MenubarContentComponent, MenubarItemComponent,
    ],
    template: `
        <main class="p-8">
            <ui-menubar>
                <ui-menubar-menu>
                    <ui-menubar-trigger data-testid="trigger-file">File</ui-menubar-trigger>
                    <ui-menubar-content>
                        <ui-menubar-item (click)="pick('new')" data-testid="item-new">
                            New
                        </ui-menubar-item>
                        <ui-menubar-item (click)="pick('open')" data-testid="item-open">
                            Open
                        </ui-menubar-item>
                    </ui-menubar-content>
                </ui-menubar-menu>
                <ui-menubar-menu>
                    <ui-menubar-trigger data-testid="trigger-edit">Edit</ui-menubar-trigger>
                    <ui-menubar-content>
                        <ui-menubar-item (click)="pick('cut')" data-testid="item-cut">
                            Cut
                        </ui-menubar-item>
                    </ui-menubar-content>
                </ui-menubar-menu>
            </ui-menubar>
            <p data-testid="selected">{{ selected() }}</p>
        </main>
    `,
})
export class MenubarDemoComponent {
    protected readonly selected = signal('');
    protected pick(name: string): void {
        this.selected.set(name);
    }
}
