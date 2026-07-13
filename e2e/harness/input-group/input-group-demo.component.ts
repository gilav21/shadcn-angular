import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    InputGroupComponent,
    InputGroupInputComponent,
    InputGroupAddonComponent,
    InputGroupTextComponent,
} from '@/components/ui/input-group';

/**
 * Auto-generated harness for the `input-group` component.
 * Extend the template and assertions in `input-group.spec.ts` as needed.
 */
@Component({
    selector: 'app-input-group-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [InputGroupComponent, InputGroupInputComponent, InputGroupAddonComponent, InputGroupTextComponent],
    template: `
        <main class="p-8">
            <ui-input-group data-testid="root">
                <ui-input-group-input data-testid="input-group-input"></ui-input-group-input>
                <ui-input-group-addon data-testid="input-group-addon"></ui-input-group-addon>
                <ui-input-group-text data-testid="input-group-text"></ui-input-group-text>
            </ui-input-group>
        </main>
    `,
})
export class InputGroupDemoComponent {}
