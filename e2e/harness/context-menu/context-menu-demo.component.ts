import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    ContextMenuComponent,
    ContextMenuTriggerComponent,
    type ContextMenuItem,
} from '@/components/ui/context-menu';

/**
 * Harness for the `context-menu` component. The menu is data-driven via
 * `[items]`; the trigger opens it on right-click.
 */
@Component({
    selector: 'app-context-menu-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent],
    template: `
        <main class="p-8">
            <ui-context-menu data-testid="root" [items]="items">
                <ui-context-menu-trigger data-testid="context-menu-trigger">
                    <div class="flex h-32 w-64 items-center justify-center rounded-md border">
                        Right-click here
                    </div>
                </ui-context-menu-trigger>
            </ui-context-menu>
            <p data-testid="last-action">{{ lastAction() }}</p>
        </main>
    `,
})
export class ContextMenuDemoComponent {
    readonly lastAction = signal('none');

    readonly items: ContextMenuItem[] = [
        { type: 'label', label: 'Actions' },
        { label: 'Copy', shortcut: 'Ctrl+C', click: () => this.lastAction.set('copy') },
        { label: 'Paste', click: () => this.lastAction.set('paste') },
        { type: 'separator' },
        { label: 'Disabled', disabled: true },
    ];
}
