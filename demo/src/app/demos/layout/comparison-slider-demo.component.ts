import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ComparisonSliderComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { COMPARISON_SLIDER_DEMO_LOCALES } from './comparison-slider-demo.locales';

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
                <h2 id="comparison-slider" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
                <p class="text-muted-foreground">{{ t().description }}</p>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().horizontalHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().horizontalDesc }}</p>
                <div class="w-full max-w-2xl">
                    <ui-comparison-slider
                        [beforeSrc]="forestBefore"
                        [afterSrc]="forestAfter"
                        [beforeAlt]="t().forestBeforeAlt"
                        [afterAlt]="t().forestAfterAlt"
                    />
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().verticalHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().verticalDesc }}</p>
                <div class="w-full max-w-2xl">
                    <ui-comparison-slider
                        [beforeSrc]="cityBefore"
                        [afterSrc]="cityAfter"
                        [beforeAlt]="t().cityBeforeAlt"
                        [afterAlt]="t().cityAfterAlt"
                        orientation="vertical"
                    />
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().labelsHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().labelsDesc }}</p>
                <div class="w-full max-w-2xl">
                    <ui-comparison-slider
                        [beforeSrc]="forestBefore"
                        [afterSrc]="forestAfter"
                        [beforeAlt]="t().beforeLabel"
                        [afterAlt]="t().afterLabel"
                        [beforeLabel]="t().beforeLabel"
                        [afterLabel]="t().afterLabel"
                    />
                </div>
            </section>

            <section class="space-y-4">
                <h3 class="text-lg font-semibold">{{ t().bindingHeading }}</h3>
                <p class="text-sm text-muted-foreground">{{ t().bindingDesc }}</p>
                <div class="w-full max-w-2xl space-y-3">
                    <ui-comparison-slider
                        [beforeSrc]="forestBefore"
                        [afterSrc]="cityAfter"
                        [beforeLabel]="t().sceneALabel"
                        [afterLabel]="t().sceneBLabel"
                        [(position)]="livePosition"
                    />
                    <div class="flex flex-wrap items-center gap-4">
                        <span class="text-sm text-muted-foreground">
                            {{ t().positionLabel }} <strong>{{ livePosition() }}%</strong>
                        </span>
                        <button
                            type="button"
                            class="text-sm px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                            (click)="resetPosition()"
                        >
                            {{ t().resetButton }}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    `,
})
export class ComparisonSliderDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(() => COMPARISON_SLIDER_DEMO_LOCALES[this.localeId()] ?? COMPARISON_SLIDER_DEMO_LOCALES['en']);

    readonly forestBefore = FOREST_BEFORE;
    readonly forestAfter = FOREST_AFTER;
    readonly cityBefore = CITY_BEFORE;
    readonly cityAfter = CITY_AFTER;

    readonly livePosition = signal(50);

    resetPosition(): void {
        this.livePosition.set(50);
    }
}
