import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    PageBuilderComponent,
    PropertyEditorComponent,
} from '@/components/ui/page-builder';

/**
 * Auto-generated harness for the `page-builder` component.
 * Extend the template and assertions in `page-builder.spec.ts` as needed.
 */
@Component({
    selector: 'app-page-builder-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PageBuilderComponent, PropertyEditorComponent],
    template: `
        <main class="p-8">
            <ui-page-builder data-testid="root">
                <ui-property-editor data-testid="property-editor"></ui-property-editor>
            </ui-page-builder>
        </main>
    `,
})
export class PageBuilderDemoComponent {}
