import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { Component, signal } from '@angular/core';
import { TourComponent, TourStep } from './tour.component';
import { ButtonComponent } from '../button';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent } from '../card.component';

@Component({
    selector: 'tour-basic-demo',
    imports: [TourComponent, ButtonComponent],
    template: `
        <div style="min-height:300px;padding:24px;">
            <div id="story-step1" style="display:inline-block;margin-bottom:24px;">
                <ui-button (click)="startTour()">Start Tour</ui-button>
            </div>
            <div style="display:flex;gap:16px;margin-top:16px;">
                <div id="story-step2" style="padding:16px;border:1px solid hsl(var(--border));border-radius:8px;min-width:160px;">
                    Feature A
                </div>
                <div id="story-step3" style="padding:16px;border:1px solid hsl(var(--border));border-radius:8px;min-width:160px;">
                    Feature B
                </div>
            </div>
            <ui-tour [steps]="steps" [(active)]="showTour" />
        </div>
    `,
})
class TourBasicDemoComponent {
    readonly showTour = signal(false);
    readonly steps: TourStep[] = [
        { target: '#story-step1', title: 'Welcome', description: 'Click here anytime to restart the tour.', side: 'bottom' },
        { target: '#story-step2', title: 'Feature A', description: 'This is the primary feature panel.' },
        { target: '#story-step3', title: 'Feature B', description: 'And this is the secondary feature.' },
    ];

    startTour(): void {
        this.showTour.set(true);
    }
}

@Component({
    selector: 'tour-custom-labels-demo',
    imports: [TourComponent, ButtonComponent],
    template: `
        <div style="min-height:300px;padding:24px;">
            <div id="story-custom-step1" style="display:inline-block;margin-bottom:24px;">
                <ui-button (click)="startTour()">Start Custom Tour</ui-button>
            </div>
            <div id="story-custom-step2" style="padding:16px;border:1px solid hsl(var(--border));border-radius:8px;margin-top:16px;max-width:300px;">
                Target Element
            </div>
            <ui-tour
                [steps]="steps"
                [(active)]="showTour"
                nextLabel="Continue →"
                prevLabel="← Back"
                finishLabel="Finish"
                skipLabel="Exit"
            />
        </div>
    `,
})
class TourCustomLabelsDemoComponent {
    readonly showTour = signal(false);
    readonly steps: TourStep[] = [
        { target: '#story-custom-step1', title: 'Start Here', description: 'Begin your journey.' },
        { target: '#story-custom-step2', title: 'Destination', description: 'This is where you end up.' },
    ];

    startTour(): void {
        this.showTour.set(true);
    }
}

@Component({
    selector: 'tour-no-skip-demo',
    imports: [TourComponent, ButtonComponent],
    template: `
        <div style="min-height:300px;padding:24px;">
            <div id="story-noskip-step1" style="display:inline-block;margin-bottom:24px;">
                <ui-button (click)="startTour()">Start Mandatory Tour</ui-button>
            </div>
            <div id="story-noskip-step2" style="padding:16px;border:1px solid hsl(var(--border));border-radius:8px;margin-top:16px;max-width:300px;">
                Last Stop
            </div>
            <ui-tour [steps]="steps" [(active)]="showTour" [showSkip]="false" />
        </div>
    `,
})
class TourNoSkipDemoComponent {
    readonly showTour = signal(false);
    readonly steps: TourStep[] = [
        { target: '#story-noskip-step1', title: 'Mandatory Step 1', description: 'You must complete this tour.' },
        { target: '#story-noskip-step2', title: 'Mandatory Step 2', description: 'Almost done!' },
    ];

    startTour(): void {
        this.showTour.set(true);
    }
}

const meta: Meta = {
    title: 'Advanced/Tour',
    decorators: [
        moduleMetadata({
            imports: [
                TourComponent, ButtonComponent,
                CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent,
                TourBasicDemoComponent, TourCustomLabelsDemoComponent, TourNoSkipDemoComponent,
            ],
        }),
    ],
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
    render: () => ({
        template: '<tour-basic-demo></tour-basic-demo>',
    }),
};

export const CustomLabels: Story = {
    render: () => ({
        template: '<tour-custom-labels-demo></tour-custom-labels-demo>',
    }),
};

export const NoSkipButton: Story = {
    render: () => ({
        template: '<tour-no-skip-demo></tour-no-skip-demo>',
    }),
};

export const PresetSides: Story = {
    render: () => ({
        props: {},
        template: `
            <div style="min-height:300px;padding:24px;">
                <p style="color:hsl(var(--muted-foreground));margin-bottom:24px;">
                    Each step can have a preferred tooltip side: top, bottom, left, or right.
                </p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:400px;">
                    <div id="story-side-top" style="padding:12px;border:1px solid hsl(var(--border));border-radius:8px;text-align:center;">Top</div>
                    <div id="story-side-bottom" style="padding:12px;border:1px solid hsl(var(--border));border-radius:8px;text-align:center;">Bottom</div>
                    <div id="story-side-left" style="padding:12px;border:1px solid hsl(var(--border));border-radius:8px;text-align:center;">Left</div>
                    <div id="story-side-right" style="padding:12px;border:1px solid hsl(var(--border));border-radius:8px;text-align:center;">Right</div>
                </div>
            </div>
        `,
    }),
};
