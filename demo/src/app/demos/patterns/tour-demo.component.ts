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
    type TourStep,
    type TourStepContext,
    type TourSkippedEvent,
    type TourSkipReason,
    type TourEndReason,
} from '../../../../../packages/components/ui';
import { TOUR_DEMO_LOCALES } from './tour-demo.locales';

interface SkippedLine {
    readonly id: number;
    readonly text: string;
}

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

        <section class="space-y-6 max-w-3xl border-t pt-8 mt-12">
            <div>
                <h2 id="tour-dynamic" class="text-2xl font-semibold scroll-m-20">{{ dyn().heading }}</h2>
                <p class="text-muted-foreground mt-1">{{ dyn().description }}</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <ui-button id="dyn-start-btn" (click)="startDynamicTour()">{{ dyn().startButton }}</ui-button>
                <ui-button id="dyn-list-toggle" variant="outline" (click)="toggleRow()">
                    @if (hasRow()) {
                        {{ dyn().removeRow }}
                    } @else {
                        {{ dyn().addRow }}
                    }
                </ui-button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                @if (panelOpen()) {
                    <ui-card>
                        <ui-card-header>
                            <ui-card-title>{{ dyn().panelTitle }}</ui-card-title>
                            <ui-card-description>{{ dyn().panelBody }}</ui-card-description>
                        </ui-card-header>
                        <ui-card-content>
                            <div id="dyn-panel-item" class="rounded-md border p-3 text-sm">
                                {{ dyn().panelItemLabel }}
                            </div>
                        </ui-card-content>
                    </ui-card>
                }

                <ui-card>
                    <ui-card-header>
                        <ui-card-title>{{ dyn().listTitle }}</ui-card-title>
                    </ui-card-header>
                    <ui-card-content>
                        @if (hasRow()) {
                            <div id="dyn-list-row" class="rounded-md border p-3 text-sm">
                                {{ dyn().rowLabel }}
                            </div>
                        } @else {
                            <p class="text-sm text-muted-foreground">{{ dyn().listEmpty }}</p>
                        }
                    </ui-card-content>
                </ui-card>
            </div>

            <ui-card>
                <ui-card-header>
                    <ui-card-title>{{ dyn().skippedTitle }}</ui-card-title>
                </ui-card-header>
                <ui-card-content class="space-y-2">
                    @if (skippedLines().length > 0) {
                        <ul class="space-y-1 text-sm">
                            @for (line of skippedLines(); track line.id) {
                                <li>{{ line.text }}</li>
                            }
                        </ul>
                    } @else {
                        <p class="text-sm text-muted-foreground">{{ dyn().skippedEmpty }}</p>
                    }
                    @if (endText(); as reason) {
                        <p class="text-sm font-medium">{{ dyn().endLabel }} {{ reason }}</p>
                    }
                </ui-card-content>
            </ui-card>

            <ui-tour
                [steps]="dynamicSteps()"
                [(active)]="showDynamicTour"
                [targetTimeout]="2000"
                (done)="onDynamicDone($event)"
                (stepSkipped)="onStepSkipped($event)"
            />
        </section>
    `,
})
export class TourDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(
        () => TOUR_DEMO_LOCALES[this.localeId()] ?? TOUR_DEMO_LOCALES['en'],
    );
    protected readonly dyn = computed(() => this.t().dynamic);

    readonly showTour = signal(false);
    readonly lastStep = signal(-1);

    readonly showDynamicTour = signal(false);
    readonly panelOpen = signal(false);
    readonly hasRow = signal(true);

    private readonly skipped = signal<readonly TourSkippedEvent[]>([]);
    private readonly endReason = signal<TourEndReason | null>(null);

    /** Opens the side panel the second dynamic step points at. */
    private readonly openPanel = (): void => {
        this.panelOpen.set(true);
    };

    /** Undoes {@link openPanel}, but only when the user is walking backwards. */
    private readonly closePanelOnBack = (ctx: TourStepContext): void => {
        if (ctx.direction === 'backward') this.panelOpen.set(false);
    };

    /** Keeps the list-row step out of the tour while the list is empty. */
    private readonly listHasRow = (): boolean => this.hasRow();

    protected readonly dynamicSteps = computed<TourStep[]>(() => {
        const d = this.dyn();
        return [
            {
                target: '#dyn-start-btn',
                title: d.stepIntro.title,
                description: d.stepIntro.description,
                side: 'bottom',
            },
            {
                target: '#dyn-panel-item',
                title: d.stepPanel.title,
                description: d.stepPanel.description,
                beforeActivate: this.openPanel,
                afterDeactivate: this.closePanelOnBack,
            },
            {
                target: '#dyn-list-row',
                title: d.stepRow.title,
                description: d.stepRow.description,
                when: this.listHasRow,
            },
            {
                target: '#dyn-list-toggle',
                title: d.stepToggle.title,
                description: d.stepToggle.description,
                side: 'top',
            },
        ];
    });

    protected readonly skippedLines = computed<SkippedLine[]>(() => {
        const d = this.dyn();
        const labels: Record<TourSkipReason, string> = {
            condition: d.reasonCondition,
            'missing-target': d.reasonMissingTarget,
            'hook-error': d.reasonHookError,
        };
        return this.skipped().map((event, i) => ({
            id: i,
            text: `${d.stepPrefix} ${event.index + 1} — ${labels[event.reason]}`,
        }));
    });

    protected readonly endText = computed<string | null>(() => {
        const reason = this.endReason();
        if (!reason) return null;
        const d = this.dyn();
        return reason === 'finished' ? d.endFinished : d.endSkipped;
    });

    startTour(): void {
        this.showTour.set(true);
    }

    onDone(): void {
        this.lastStep.set(-1);
    }

    onStepChange(index: number): void {
        this.lastStep.set(index);
    }

    startDynamicTour(): void {
        this.skipped.set([]);
        this.endReason.set(null);
        this.showDynamicTour.set(true);
    }

    onDynamicDone(reason: TourEndReason): void {
        this.endReason.set(reason);
        this.panelOpen.set(false);
    }

    onStepSkipped(event: TourSkippedEvent): void {
        this.skipped.update(list => [...list, event]);
    }

    toggleRow(): void {
        this.hasRow.update(value => !value);
    }
}
