import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    ButtonGroupComponent,
    ButtonGroupTextComponent,
    ButtonGroupSeparatorComponent,
} from '@/components/ui/button-group';

/**
 * Auto-generated harness for the `button-group` component.
 * Extend the template and assertions in `button-group.spec.ts` as needed.
 */
@Component({
    selector: 'app-button-group-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonGroupComponent, ButtonGroupTextComponent, ButtonGroupSeparatorComponent],
    template: `
        <main class="p-8">
            <ui-button-group data-testid="root">
                <ui-button-group-text data-testid="button-group-text"></ui-button-group-text>
                <ui-button-group-separator data-testid="button-group-separator"></ui-button-group-separator>
            </ui-button-group>
        </main>
    `,
})
export class ButtonGroupDemoComponent {}
