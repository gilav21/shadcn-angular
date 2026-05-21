import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    SheetComponent,
    SheetTriggerComponent,
    SheetContentComponent,
    SheetHeaderComponent,
    SheetTitleComponent,
} from '@/components/ui/sheet';

@Component({
    selector: 'app-sheet-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SheetComponent, SheetTriggerComponent, SheetContentComponent,
        SheetHeaderComponent, SheetTitleComponent,
    ],
    template: `
        <main class="p-8">
            <ui-sheet>
                <ui-sheet-trigger data-testid="trigger">
                    <button type="button" class="border px-3 py-1">Open sheet</button>
                </ui-sheet-trigger>
                <ui-sheet-content>
                    <ui-sheet-header>
                        <ui-sheet-title data-testid="title">Settings</ui-sheet-title>
                    </ui-sheet-header>
                    <p data-testid="body">Sheet body content</p>
                </ui-sheet-content>
            </ui-sheet>
        </main>
    `,
})
export class SheetDemoComponent {}
