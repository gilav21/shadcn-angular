import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { Component, input, signal } from '@angular/core';
import { TourComponent, TourStep, TourSkippedEvent } from './tour.component';
import { writeTourCompleted } from './tour.utils';
import { ButtonComponent } from '../button';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent } from '../card';
import { COMMON_LOCALES } from '../../lib/i18n/common.locales';

@Component({
    selector: 'tour-playground-demo',
    imports: [TourComponent, ButtonComponent],
    template: `
        <div style="min-height:300px;padding:24px;">
            <div id="story-playground-step1" style="display:inline-block;margin-bottom:24px;">
                <ui-button (click)="startTour()">Start Tour</ui-button>
            </div>
            <div style="display:flex;gap:16px;margin-top:16px;">
                <div id="story-playground-step2" style="padding:16px;border:1px solid hsl(var(--border));border-radius:8px;min-width:160px;">
                    Feature A
                </div>
                <div id="story-playground-step3" style="padding:16px;border:1px solid hsl(var(--border));border-radius:8px;min-width:160px;">
                    Feature B
                </div>
            </div>
            <ui-tour
                [steps]="steps"
                [(active)]="showTour"
                [showSkip]="showSkip()"
                [nextLabel]="nextLabel()"
                [prevLabel]="prevLabel()"
                [finishLabel]="finishLabel()"
                [skipLabel]="skipLabel()"
                [locale]="locale()"
                [class]="class()"
            />
        </div>
    `,
})
class TourPlaygroundDemoComponent {
    readonly showSkip = input(true);
    readonly nextLabel = input<string>();
    readonly prevLabel = input<string>();
    readonly finishLabel = input<string>();
    readonly skipLabel = input<string>();
    readonly locale = input<string>();
    readonly class = input('');

    readonly showTour = signal(false);
    readonly steps: TourStep[] = [
        { target: '#story-playground-step1', title: 'Welcome', description: 'Click here anytime to restart the tour.', side: 'bottom' },
        { target: '#story-playground-step2', title: 'Feature A', description: 'This is the primary feature panel.' },
        { target: '#story-playground-step3', title: 'Feature B', description: 'And this is the secondary feature.' },
    ];

    startTour(): void {
        this.showTour.set(true);
    }
}

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

@Component({
    selector: 'tour-async-steps-demo',
    imports: [TourComponent, ButtonComponent],
    template: `
        <div style="min-height:340px;padding:24px;">
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <div id="story-async-start" style="display:inline-block;">
                    <ui-button (click)="showTour.set(true)">Start Tour</ui-button>
                </div>
                <ui-button variant="outline" (click)="items.set(items().length ? [] : ['First item'])">
                    {{ items().length ? 'Empty the list' : 'Add an item' }}
                </ui-button>
            </div>

            <div style="display:flex;gap:16px;">
                @if (panelOpen()) {
                    <aside id="story-async-panel" style="width:180px;padding:12px;border:1px solid hsl(var(--border));border-radius:8px;">
                        Side panel
                    </aside>
                }
                <div style="flex:1;padding:12px;border:1px solid hsl(var(--border));border-radius:8px;">
                    @for (item of items(); track item) {
                        <div id="story-async-row" style="padding:8px;">{{ item }}</div>
                    } @empty {
                        <p style="color:hsl(var(--muted-foreground));">The list is empty — the tour skips its step.</p>
                    }
                </div>
            </div>

            <p style="margin-top:16px;color:hsl(var(--muted-foreground));font-size:13px;">
                Skipped steps: {{ skipped().join(', ') || 'none' }}
            </p>

            <ui-tour [steps]="steps" [(active)]="showTour" [targetTimeout]="2000" (stepSkipped)="onSkipped($event)" />
        </div>
    `,
})
class TourAsyncStepsDemoComponent {
    readonly showTour = signal(false);
    readonly panelOpen = signal(false);
    readonly items = signal<string[]>([]);
    readonly skipped = signal<string[]>([]);

    readonly steps: TourStep[] = [
        { target: '#story-async-start', title: 'Welcome', description: 'The next step opens the side panel first.' },
        {
            target: '#story-async-panel',
            title: 'Side panel',
            description: 'beforeActivate opened this panel and the tour waited for it to render.',
            beforeActivate: () => {
                this.panelOpen.set(true);
            },
            afterDeactivate: ({ direction }) => {
                if (direction === 'backward') this.panelOpen.set(false);
            },
        },
        {
            target: '#story-async-row',
            title: 'First row',
            description: 'Only shown when the list has rows — otherwise the tour skips past it, forwards and backwards.',
        },
        { target: '#story-async-start', title: 'Done', description: 'Back where we started.' },
    ];

    onSkipped(event: TourSkippedEvent): void {
        this.skipped.update(list => [...list, `#${event.index} (${event.reason})`]);
    }
}

interface TourStoryProps {
    showSkip: boolean;
    nextLabel?: string;
    prevLabel?: string;
    finishLabel?: string;
    skipLabel?: string;
    locale?: string;
    class: string;
}

const meta: Meta<TourStoryProps> = {
    title: 'Advanced/Tour',
    component: TourComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                TourComponent, ButtonComponent,
                CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent,
                TourPlaygroundDemoComponent, TourBasicDemoComponent, TourCustomLabelsDemoComponent, TourNoSkipDemoComponent,
                TourAsyncStepsDemoComponent,
            ],
        }),
    ],
    argTypes: {
        showSkip: { control: 'boolean', description: 'Whether the Skip button is shown on intermediate steps.' },
        nextLabel: { control: 'text', description: 'Override for the forward button label on non-final steps.' },
        prevLabel: { control: 'text', description: 'Override for the back button label on non-first steps.' },
        finishLabel: { control: 'text', description: 'Override for the forward button label on the final step.' },
        skipLabel: { control: 'text', description: 'Override for the skip button label.' },
        locale: {
            control: 'select',
            options: Object.keys(COMMON_LOCALES),
            description: 'Locale dictionary registry key (or a full CommonLocale object) seeding the default next/prev/finish/skip labels. Falls back to `UI_LOCALE_ID` when unset.',
        },
        class: { control: 'text', description: 'Extra CSS classes applied to the floating step card.' },
    },
    args: {
        showSkip: true,
        nextLabel: undefined,
        prevLabel: undefined,
        finishLabel: undefined,
        skipLabel: undefined,
        locale: 'en',
        class: '',
    },
};

export default meta;
type Story = StoryObj<TourStoryProps>;

/** Interactive playground — click "Start Tour" then use the Controls panel to change labels/skip button. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `
            <tour-playground-demo
                [showSkip]="showSkip"
                [nextLabel]="nextLabel"
                [prevLabel]="prevLabel"
                [finishLabel]="finishLabel"
                [skipLabel]="skipLabel"
                [locale]="locale"
                [class]="class"
            />
        `,
    }),
};

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

/** Steps that drive the app before they highlight, and steps that gracefully disappear when their target does not exist. */
export const AsyncStepsAndSkipping: Story = {
    render: () => ({
        template: '<tour-async-steps-demo></tour-async-steps-demo>',
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

@Component({
    selector: 'tour-persistence-demo',
    imports: [TourComponent, ButtonComponent],
    template: `
        <div style="min-height:320px;padding:24px;">
            <div id="story-persist-step1" style="display:inline-block;margin-bottom:24px;">
                <ui-button (click)="startTour()">Start onboarding</ui-button>
            </div>
            <div id="story-persist-step2" style="padding:16px;border:1px solid hsl(var(--border));border-radius:8px;max-width:320px;">
                Second stop
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <ui-button variant="outline" (click)="reset()">Reset completion flag</ui-button>
                <span style="font-size:0.875rem;opacity:0.7;">Completed: {{ completed() }}</span>
            </div>
            <ui-tour #tour [steps]="steps" [(active)]="showTour" storageKey="storybook-onboarding" />
        </div>
    `,
})
class TourPersistenceDemoComponent {
    readonly showTour = signal(false);
    readonly completed = signal(false);
    readonly steps: TourStep[] = [
        { target: '#story-persist-step1', title: 'Welcome', description: 'Finish or skip this tour once and it will not replay.' },
        { target: '#story-persist-step2', title: 'Second stop', description: 'The flag is written under storageKey on either ending.' },
    ];

    startTour(): void {
        this.showTour.set(true);
        queueMicrotask(() => this.completed.set(!this.showTour()));
    }

    reset(): void {
        writeTourCompleted('storybook-onboarding', false);
        this.completed.set(false);
    }
}

@Component({
    selector: 'tour-branching-demo',
    imports: [TourComponent, ButtonComponent],
    template: `
        <div style="min-height:340px;padding:24px;">
            <div id="story-branch-start" style="display:inline-block;margin-bottom:24px;">
                <ui-button (click)="showTour.set(true)">Start branching tour</ui-button>
            </div>
            <label style="display:flex;gap:8px;align-items:center;margin-bottom:16px;font-size:0.875rem;">
                <input type="checkbox" [checked]="isPro()" (change)="isPro.set(!isPro())" />
                I am on the Pro plan
            </label>
            <div id="story-branch-free" style="padding:16px;border:1px solid hsl(var(--border));border-radius:8px;max-width:320px;margin-bottom:12px;">
                Free-plan step
            </div>
            <div id="story-branch-pro" style="padding:16px;border:1px solid hsl(var(--border));border-radius:8px;max-width:320px;">
                Pro-plan step
            </div>
            <ui-tour [steps]="steps" [(active)]="showTour" />
        </div>
    `,
})
class TourBranchingDemoComponent {
    readonly showTour = signal(false);
    readonly isPro = signal(false);
    readonly steps: TourStep[] = [
        {
            target: '#story-branch-start',
            title: 'Your plan',
            description: 'The next step depends on the checkbox — the predicate picks the branch.',
            next: () => (this.isPro() ? 2 : 1),
        },
        { target: '#story-branch-free', title: 'Free plan', description: 'You were routed here because Pro is off.', next: () => null },
        { target: '#story-branch-pro', title: 'Pro plan', description: 'You were routed straight here, skipping the free step.' },
    ];
}

export const PersistedCompletion: Story = {
    name: 'storageKey — does not replay once completed',
    render: () => ({
        moduleMetadata: { imports: [TourPersistenceDemoComponent] },
        template: '<tour-persistence-demo />',
    }),
};

export const Branching: Story = {
    name: 'Per-step branching',
    render: () => ({
        moduleMetadata: { imports: [TourBranchingDemoComponent] },
        template: '<tour-branching-demo />',
    }),
};
