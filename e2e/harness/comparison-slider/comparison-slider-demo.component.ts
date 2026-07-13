import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComparisonSliderComponent } from '@/components/ui/comparison-slider';

/** Harness for the `comparison-slider` component (before/after image wipe). */
@Component({
    selector: 'app-comparison-slider-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ComparisonSliderComponent],
    template: `
        <main class="w-[600px] p-8">
            <ui-comparison-slider
                data-testid="root"
                class="block"
                [beforeSrc]="before"
                [afterSrc]="after"
                beforeAlt="Before"
                afterAlt="After"
                beforeLabel="Before"
                afterLabel="After"
            />
        </main>
    `,
})
export class ComparisonSliderDemoComponent {
    // Inline SVG data URIs keep the harness offline and deterministic.
    readonly before =
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23334155"/></svg>';

    readonly after =
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f97316"/></svg>';
}
