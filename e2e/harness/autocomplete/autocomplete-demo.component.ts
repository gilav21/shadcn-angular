import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AutocompleteComponent } from '@/components/ui/autocomplete';

/**
 * Auto-generated harness for the `autocomplete` component.
 * Extend the template and assertions in `autocomplete.spec.ts` as needed.
 */
@Component({
    selector: 'app-autocomplete-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AutocompleteComponent],
    template: `
        <main class="p-8">
            <ui-autocomplete data-testid="root"></ui-autocomplete>
        </main>
    `,
})
export class AutocompleteDemoComponent {}
