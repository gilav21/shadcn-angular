import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ShortcutBindingsDialogComponent } from '@/components/ui/shortcut-bindings-dialog';

/** Harness for the `shortcut-bindings-dialog` component. */
@Component({
    selector: 'app-shortcut-bindings-dialog-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ShortcutBindingsDialogComponent],
    template: `
        <main class="p-8">
            <button type="button" data-testid="open" (click)="open.set(true)">Shortcuts</button>
            <ui-shortcut-bindings-dialog data-testid="root" [(open)]="open" />
        </main>
    `,
})
export class ShortcutBindingsDialogDemoComponent {
    readonly open = signal(false);
}
