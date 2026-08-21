import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MasonryComponent } from '@/components/ui/masonry';

/**
 * Harness for the `masonry` component: uneven-height cards laid out in three
 * columns, so the e2e run can check the DOM-order guarantee in a real consumer
 * build rather than only in the unit suite.
 */
@Component({
    selector: 'app-masonry-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MasonryComponent],
    template: `
        <main class="p-8" style="width: 900px">
            <ui-masonry data-testid="root" [columns]="3" [gap]="16">
                @for (card of cards; track card.id) {
                    <div
                        class="rounded-lg border p-4"
                        data-testid="card"
                        [attr.data-card-id]="card.id"
                        [style.height.px]="card.height"
                    >
                        Card {{ card.id }}
                    </div>
                }
            </ui-masonry>
        </main>
    `,
})
export class MasonryDemoComponent {
    readonly cards = [
        { id: 1, height: 120 },
        { id: 2, height: 60 },
        { id: 3, height: 200 },
        { id: 4, height: 40 },
        { id: 5, height: 150 },
        { id: 6, height: 90 },
    ];
}
