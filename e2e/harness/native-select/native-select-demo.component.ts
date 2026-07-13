import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NativeSelectComponent } from '@/components/ui/native-select';

/**
 * Auto-generated harness for the `native-select` component.
 * Extend the template and assertions in `native-select.spec.ts` as needed.
 */
@Component({
    selector: 'app-native-select-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NativeSelectComponent],
    template: `
        <main class="p-8">
            <ui-native-select data-testid="root"></ui-native-select>
        </main>
    `,
})
export class NativeSelectDemoComponent {}
