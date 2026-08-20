import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturesBlockComponent, type Feature } from '@/blocks/features';

/** Harness for the `features` block — defaults plus a custom item list. */
@Component({
    selector: 'app-features-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FeaturesBlockComponent],
    template: `
        <main class="p-8">
            <ui-features-block data-testid="root" />
            <ui-features-block
                data-testid="custom"
                heading="Just two"
                [features]="custom" />
        </main>
    `,
})
export class FeaturesDemoComponent {
    protected readonly custom: Feature[] = [
        { icon: 'zap', title: 'One', description: 'First custom feature.' },
        { icon: 'code', title: 'Two', description: 'Second custom feature.' },
    ];
}
