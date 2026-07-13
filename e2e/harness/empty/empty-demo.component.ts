import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    EmptyComponent,
    EmptyHeaderComponent,
    EmptyMediaComponent,
    EmptyTitleComponent,
    EmptyDescriptionComponent,
    EmptyContentComponent,
} from '@/components/ui/empty';

/**
 * Auto-generated harness for the `empty` component.
 * Extend the template and assertions in `empty.spec.ts` as needed.
 */
@Component({
    selector: 'app-empty-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [EmptyComponent, EmptyHeaderComponent, EmptyMediaComponent, EmptyTitleComponent, EmptyDescriptionComponent, EmptyContentComponent],
    template: `
        <main class="p-8">
            <ui-empty data-testid="root">
                <ui-empty-header data-testid="empty-header"></ui-empty-header>
                <ui-empty-media data-testid="empty-media"></ui-empty-media>
                <ui-empty-title data-testid="empty-title"></ui-empty-title>
                <ui-empty-description data-testid="empty-description"></ui-empty-description>
                <ui-empty-content data-testid="empty-content"></ui-empty-content>
            </ui-empty>
        </main>
    `,
})
export class EmptyDemoComponent {}
