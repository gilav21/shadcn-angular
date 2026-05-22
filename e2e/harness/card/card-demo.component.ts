import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent,
} from '@/components/ui/card';

/**
 * Auto-generated harness for the `card` component.
 * Extend the template and assertions in `card.spec.ts` as needed.
 */
@Component({
    selector: 'app-card-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent],
    template: `
        <main class="p-8">
            <ui-card data-testid="root">
                <ui-card-header data-testid="card-header"></ui-card-header>
                <ui-card-title data-testid="card-title"></ui-card-title>
                <ui-card-description data-testid="card-description"></ui-card-description>
                <ui-card-content data-testid="card-content"></ui-card-content>
                <ui-card-footer data-testid="card-footer"></ui-card-footer>
            </ui-card>
        </main>
    `,
})
export class CardDemoComponent {}
