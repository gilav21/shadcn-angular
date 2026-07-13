import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    SplitButtonComponent,
    SplitButtonPrimaryComponent,
    SplitButtonMenuComponent,
    SplitButtonItemComponent,
} from '@/components/ui/split-button';

/**
 * Auto-generated harness for the `split-button` component.
 * Extend the template and assertions in `split-button.spec.ts` as needed.
 */
@Component({
    selector: 'app-split-button-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SplitButtonComponent, SplitButtonPrimaryComponent, SplitButtonMenuComponent, SplitButtonItemComponent],
    template: `
        <main class="p-8">
            <ui-split-button data-testid="root">
                <ui-split-button-primary data-testid="split-button-primary"></ui-split-button-primary>
                <ui-split-button-menu data-testid="split-button-menu"></ui-split-button-menu>
                <ui-split-button-item data-testid="split-button-item"></ui-split-button-item>
            </ui-split-button>
        </main>
    `,
})
export class SplitButtonDemoComponent {}
