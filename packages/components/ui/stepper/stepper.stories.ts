import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { signal } from '@angular/core';
import {
    StepperComponent,
    StepperItemComponent,
    StepperTriggerComponent,
    StepperTitleComponent,
    StepperDescriptionComponent,
    StepperContentComponent,
} from './index';
import { ButtonComponent } from '../button';

const DEMO_STEPS = [
    { value: 'step-1', title: 'Account', description: 'Create your account' },
    { value: 'step-2', title: 'Profile', description: 'Set up your profile' },
    { value: 'step-3', title: 'Complete', description: 'Finish setup' },
];

const meta: Meta<StepperComponent> = {
    title: 'UI/Stepper',
    component: StepperComponent,
    decorators: [
        moduleMetadata({
            imports: [
                StepperComponent,
                StepperItemComponent,
                StepperTriggerComponent,
                StepperTitleComponent,
                StepperDescriptionComponent,
                StepperContentComponent,
                ButtonComponent,
            ],
        }),
    ],
    tags: ['autodocs'],
    argTypes: {
        orientation: {
            control: 'select',
            options: ['horizontal', 'vertical'],
            description: 'Layout direction of the steps.',
        },
        linear: {
            control: 'boolean',
            description: 'When true, steps can only be navigated in order.',
        },
        activeStep: {
            control: 'number',
            description: 'Index of the currently active step (two-way bindable).',
        },
        steps: {
            control: 'object',
            description: 'Simple mode: array of { value, title, description } steps rendered without projected content.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        orientation: 'horizontal',
        linear: false,
        activeStep: 0,
        steps: [],
        class: '',
    },
};

export default meta;
type Story = StoryObj<StepperComponent>;

const render: NonNullable<Story['render']> = (args) => ({
    props: { ...args, activeStep: signal(args.activeStep ?? 0) },
    template: `
        <ui-stepper [steps]="steps" [(activeStep)]="activeStep" [orientation]="orientation" [linear]="linear" [class]="class">
            <ui-stepper-item value="step-1">
                <ui-stepper-trigger>
                    <ui-stepper-title>Account</ui-stepper-title>
                    <ui-stepper-description>Create your account</ui-stepper-description>
                </ui-stepper-trigger>
                <ui-stepper-content>
                    <div class="p-4 border rounded-md space-y-4 mt-4">
                        <p class="text-sm">Enter your account information.</p>
                        <ui-button (click)="activeStep.set(1)">Continue</ui-button>
                    </div>
                </ui-stepper-content>
            </ui-stepper-item>
            <ui-stepper-item value="step-2">
                <ui-stepper-trigger>
                    <ui-stepper-title>Profile</ui-stepper-title>
                    <ui-stepper-description>Set up your profile</ui-stepper-description>
                </ui-stepper-trigger>
                <ui-stepper-content>
                    <div class="p-4 border rounded-md space-y-4 mt-4">
                        <p class="text-sm">Configure your profile settings.</p>
                        <div class="flex gap-2">
                            <ui-button variant="outline" (click)="activeStep.set(0)">Back</ui-button>
                            <ui-button (click)="activeStep.set(2)">Continue</ui-button>
                        </div>
                    </div>
                </ui-stepper-content>
            </ui-stepper-item>
            <ui-stepper-item value="step-3">
                <ui-stepper-trigger>
                    <ui-stepper-title>Complete</ui-stepper-title>
                    <ui-stepper-description>Finish setup</ui-stepper-description>
                </ui-stepper-trigger>
                <ui-stepper-content>
                    <div class="p-4 border rounded-md space-y-4 mt-4">
                        <p class="text-sm">All done! Your account is ready.</p>
                        <ui-button variant="outline" (click)="activeStep.set(1)">Back</ui-button>
                    </div>
                </ui-stepper-content>
            </ui-stepper-item>
        </ui-stepper>`,
});

/** Interactive playground — every input is wired to the Controls panel (template-composition mode). */
export const Playground: Story = { render };

export const Default: Story = {
    render: (args) => ({
        props: { ...args, activeStep: signal(0) },
        template: `
            <ui-stepper [(activeStep)]="activeStep" [orientation]="orientation" [linear]="linear">
                <ui-stepper-item value="step-1">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Account</ui-stepper-title>
                        <ui-stepper-description>Create your account</ui-stepper-description>
                    </ui-stepper-trigger>
                    <ui-stepper-content>
                        <div class="p-4 border rounded-md space-y-4 mt-4">
                            <p class="text-sm">Enter your account information.</p>
                            <ui-button (click)="activeStep.set(1)">Continue</ui-button>
                        </div>
                    </ui-stepper-content>
                </ui-stepper-item>
                <ui-stepper-item value="step-2">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Profile</ui-stepper-title>
                        <ui-stepper-description>Set up your profile</ui-stepper-description>
                    </ui-stepper-trigger>
                    <ui-stepper-content>
                        <div class="p-4 border rounded-md space-y-4 mt-4">
                            <p class="text-sm">Configure your profile settings.</p>
                            <div class="flex gap-2">
                                <ui-button variant="outline" (click)="activeStep.set(0)">Back</ui-button>
                                <ui-button (click)="activeStep.set(2)">Continue</ui-button>
                            </div>
                        </div>
                    </ui-stepper-content>
                </ui-stepper-item>
                <ui-stepper-item value="step-3">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Complete</ui-stepper-title>
                        <ui-stepper-description>Finish setup</ui-stepper-description>
                    </ui-stepper-trigger>
                    <ui-stepper-content>
                        <div class="p-4 border rounded-md space-y-4 mt-4">
                            <p class="text-sm">All done! Your account is ready.</p>
                            <ui-button variant="outline" (click)="activeStep.set(1)">Back</ui-button>
                        </div>
                    </ui-stepper-content>
                </ui-stepper-item>
            </ui-stepper>
        `,
    }),
};

export const SimpleMode: Story = {
    name: 'Simple Mode (steps input)',
    render: () => ({
        props: { steps: DEMO_STEPS, activeStep: signal(1) },
        template: `
            <div class="space-y-2">
                <p class="text-sm text-muted-foreground">Data-driven mode: pass a <code>steps</code> array instead of projecting <code>ui-stepper-item</code>s.</p>
                <ui-stepper [steps]="steps" [(activeStep)]="activeStep"></ui-stepper>
            </div>`,
    }),
};

export const LinearMode: Story = {
    render: () => ({
        props: { activeStep: signal(0) },
        template: `
            <div class="space-y-4">
                <p class="text-sm text-muted-foreground">In linear mode, you can only navigate to completed or current steps.</p>
                <ui-stepper [(activeStep)]="activeStep" [linear]="true">
                    <ui-stepper-item value="step-1">
                        <ui-stepper-trigger>
                            <ui-stepper-title>Step 1</ui-stepper-title>
                        </ui-stepper-trigger>
                        <ui-stepper-content>
                            <div class="p-4 border rounded-md mt-4">
                                <ui-button (click)="activeStep.set(1)">Complete Step 1</ui-button>
                            </div>
                        </ui-stepper-content>
                    </ui-stepper-item>
                    <ui-stepper-item value="step-2">
                        <ui-stepper-trigger>
                            <ui-stepper-title>Step 2</ui-stepper-title>
                        </ui-stepper-trigger>
                        <ui-stepper-content>
                            <div class="p-4 border rounded-md mt-4">
                                <ui-button (click)="activeStep.set(2)">Complete Step 2</ui-button>
                            </div>
                        </ui-stepper-content>
                    </ui-stepper-item>
                    <ui-stepper-item value="step-3">
                        <ui-stepper-trigger>
                            <ui-stepper-title>Step 3</ui-stepper-title>
                        </ui-stepper-trigger>
                        <ui-stepper-content>
                            <div class="p-4 border rounded-md mt-4">
                                <p class="text-sm">All steps complete!</p>
                            </div>
                        </ui-stepper-content>
                    </ui-stepper-item>
                </ui-stepper>
            </div>
        `,
    }),
};

export const Vertical: Story = {
    render: () => ({
        props: { activeStep: signal(1) },
        template: `
            <ui-stepper [(activeStep)]="activeStep" orientation="vertical">
                <ui-stepper-item value="step-1">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Account Information</ui-stepper-title>
                        <ui-stepper-description>Email and password</ui-stepper-description>
                    </ui-stepper-trigger>
                </ui-stepper-item>
                <ui-stepper-item value="step-2">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Personal Details</ui-stepper-title>
                        <ui-stepper-description>Name and address</ui-stepper-description>
                    </ui-stepper-trigger>
                </ui-stepper-item>
                <ui-stepper-item value="step-3">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Payment</ui-stepper-title>
                        <ui-stepper-description>Billing information</ui-stepper-description>
                    </ui-stepper-trigger>
                </ui-stepper-item>
                <ui-stepper-item value="step-4">
                    <ui-stepper-trigger>
                        <ui-stepper-title>Confirmation</ui-stepper-title>
                        <ui-stepper-description>Review and submit</ui-stepper-description>
                    </ui-stepper-trigger>
                </ui-stepper-item>
            </ui-stepper>
        `,
    }),
};

export const RTL: Story = {
    render: () => ({
        props: { activeStep: signal(1) },
        template: `
            <div dir="rtl">
                <ui-stepper [(activeStep)]="activeStep">
                    <ui-stepper-item value="step-1">
                        <ui-stepper-trigger>
                            <ui-stepper-title>الحساب</ui-stepper-title>
                            <ui-stepper-description>إنشاء حسابك</ui-stepper-description>
                        </ui-stepper-trigger>
                    </ui-stepper-item>
                    <ui-stepper-item value="step-2">
                        <ui-stepper-trigger>
                            <ui-stepper-title>الملف الشخصي</ui-stepper-title>
                            <ui-stepper-description>إعداد ملفك الشخصي</ui-stepper-description>
                        </ui-stepper-trigger>
                    </ui-stepper-item>
                    <ui-stepper-item value="step-3">
                        <ui-stepper-trigger>
                            <ui-stepper-title>إكمال</ui-stepper-title>
                            <ui-stepper-description>إنهاء الإعداد</ui-stepper-description>
                        </ui-stepper-trigger>
                    </ui-stepper-item>
                </ui-stepper>
            </div>
        `,
    }),
};
