import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    CommandComponent,
    CommandInputComponent,
    CommandListComponent,
    CommandGroupComponent,
    CommandItemComponent,
    CommandEmptyComponent,
} from '@/components/ui/command';

@Component({
    selector: 'app-command-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommandComponent,
        CommandInputComponent,
        CommandListComponent,
        CommandGroupComponent,
        CommandItemComponent,
        CommandEmptyComponent,
    ],
    template: `
        <main class="p-8">
            <ui-command class="w-[400px] border rounded-md">
                <ui-command-input placeholder="Type a command…" data-testid="search" />
                <ui-command-list>
                    <ui-command-empty data-testid="empty">No results.</ui-command-empty>
                    <ui-command-group heading="Actions">
                        <ui-command-item value="copy" (select)="pick('copy')" data-testid="item-copy">
                            Copy
                        </ui-command-item>
                        <ui-command-item value="cut" (select)="pick('cut')" data-testid="item-cut">
                            Cut
                        </ui-command-item>
                        <ui-command-item value="paste" (select)="pick('paste')" data-testid="item-paste">
                            Paste
                        </ui-command-item>
                    </ui-command-group>
                </ui-command-list>
            </ui-command>
            <p data-testid="picked">{{ picked() }}</p>
        </main>
    `,
})
export class CommandDemoComponent {
    protected readonly picked = signal('');
    protected pick(name: string): void {
        this.picked.set(name);
    }
}
