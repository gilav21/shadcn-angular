import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
    TourComponent,
    ButtonComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
} from '../../../../../packages/components/ui';
import { TOUR_DEMO_LOCALES } from './tour-demo.locales';

@Component({
    selector: 'app-tour-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TourComponent,
        ButtonComponent,
        CardComponent,
        CardHeaderComponent,
        CardTitleComponent,
        CardDescriptionComponent,
        CardContentComponent,
    ],
    template: `
        <section class="space-y-8 max-w-3xl">
            <div>
                <h2 id="tour" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
                <p class="text-muted-foreground mt-1">
                    {{ t().description }}
                </p>
            </div>

            <div class="space-y-4">
                <ui-button id="tour-start-btn" (click)="startTour()">{{ t().startButton }}</ui-button>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ui-card id="tour-feature-1">
                        <ui-card-header>
                            <ui-card-title>{{ t().card1Title }}</ui-card-title>
                            <ui-card-description>{{ t().card1Description }}</ui-card-description>
                        </ui-card-header>
                        <ui-card-content>{{ t().card1Content }}</ui-card-content>
                    </ui-card>
                    <ui-card id="tour-feature-2">
                        <ui-card-header>
                            <ui-card-title>{{ t().card2Title }}</ui-card-title>
                            <ui-card-description>{{ t().card2Description }}</ui-card-description>
                        </ui-card-header>
                        <ui-card-content>{{ t().card2Content }}</ui-card-content>
                    </ui-card>
                </div>
            </div>

            <div class="space-y-3 h-[80vh] flex flex-col justify-end">
                <p class="text-sm text-muted-foreground">{{ t().scrollTestLabel }}</p>
            </div>

            <ui-card id="tour-feature-3" class="mt-32">
                <ui-card-header>
                    <ui-card-title>{{ t().offscreenTitle }}</ui-card-title>
                    <ui-card-description>{{ t().offscreenDescription }}</ui-card-description>
                </ui-card-header>
                <ui-card-content>{{ t().offscreenContent }}</ui-card-content>
            </ui-card>

            <ui-tour [steps]="t().steps" [(active)]="showTour" (done)="onDone()" (stepChange)="onStepChange($event)" />
        </section>
    `,
})
export class TourDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(
        () => TOUR_DEMO_LOCALES[this.localeId()] ?? TOUR_DEMO_LOCALES['en'],
    );

    readonly showTour = signal(false);
    readonly lastStep = signal(-1);

    startTour(): void {
        this.showTour.set(true);
    }

    onDone(): void {
        this.lastStep.set(-1);
    }

    onStepChange(index: number): void {
        this.lastStep.set(index);
    }
}
