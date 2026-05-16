import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComparisonSliderComponent } from '../../../../../packages/components/ui';

const FOREST_BEFORE = 'https://picsum.photos/id/10/800/450';
const FOREST_AFTER = 'https://picsum.photos/id/11/800/450';
const CITY_BEFORE = 'https://picsum.photos/id/43/800/450';
const CITY_AFTER = 'https://picsum.photos/id/44/800/450';

@Component({
    selector: 'app-comparison-slider-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ComparisonSliderComponent],
    template: `
        <div class="space-y-10">
            <section class="space-y-4">
                <h2 id="comparison-slider" class="text-2xl font-semibold scroll-m-20">Comparison Slider</h2>
                <p class="text-muted-foreground">
                    A before/after image comparison slider. Drag the handle (or click anywhere on the image)
                    to reveal the before or after state. Supports horizontal and vertical orientations.
                </p>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">Horizontal (default)</h3>
                <p class="text-sm text-muted-foreground">Drag left and right to compare images.</p>
                <div class="w-full max-w-2xl">
                    <ui-comparison-slider
                        [beforeSrc]="forestBefore"
                        [afterSrc]="forestAfter"
                        beforeAlt="Forest scene — before"
                        afterAlt="Forest scene — after"
                    />
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">Vertical orientation</h3>
                <p class="text-sm text-muted-foreground">Drag up and down to reveal the difference.</p>
                <div class="w-full max-w-2xl">
                    <ui-comparison-slider
                        [beforeSrc]="cityBefore"
                        [afterSrc]="cityAfter"
                        beforeAlt="City scene — before"
                        afterAlt="City scene — after"
                        orientation="vertical"
                    />
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">With before / after labels</h3>
                <p class="text-sm text-muted-foreground">Optional chips in the corners identify each side.</p>
                <div class="w-full max-w-2xl">
                    <ui-comparison-slider
                        [beforeSrc]="forestBefore"
                        [afterSrc]="forestAfter"
                        beforeAlt="Before"
                        afterAlt="After"
                        beforeLabel="Before"
                        afterLabel="After"
                    />
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">Two-way position binding</h3>
                <p class="text-sm text-muted-foreground">
                    Bind <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">[(position)]</code>
                    to get or set the divider position programmatically.
                </p>
                <div class="w-full max-w-2xl space-y-3">
                    <ui-comparison-slider
                        [beforeSrc]="forestBefore"
                        [afterSrc]="cityAfter"
                        beforeLabel="Scene A"
                        afterLabel="Scene B"
                        [(position)]="livePosition"
                    />
                    <div class="flex flex-wrap items-center gap-4">
                        <span class="text-sm text-muted-foreground">
                            Position: <strong>{{ livePosition() }}%</strong>
                        </span>
                        <button
                            type="button"
                            class="text-sm px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                            (click)="resetPosition()"
                        >
                            Reset to 50%
                        </button>
                    </div>
                </div>
            </section>
        </div>
    `,
})
export class ComparisonSliderDemoComponent {
    readonly forestBefore = FOREST_BEFORE;
    readonly forestAfter = FOREST_AFTER;
    readonly cityBefore = CITY_BEFORE;
    readonly cityAfter = CITY_AFTER;

    readonly livePosition = signal(50);

    resetPosition(): void {
        this.livePosition.set(50);
    }
}
