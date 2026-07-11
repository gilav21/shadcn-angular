import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { RatingComponent } from './rating.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<RatingComponent> = {
    title: 'UI/Rating',
    component: RatingComponent,
    decorators: [
        moduleMetadata({
            imports: [FormsModule],
        }),
    ],
    tags: ['autodocs'],
    argTypes: {
        max: { control: 'number', description: 'Number of stars in the group.', min: 1, max: 20 },
        precision: { control: 'select', options: [0.5, 1], description: 'Selection precision — `0.5` allows half-star ratings.' },
        readonly: { control: 'boolean', description: 'Displays the current rating without allowing interaction.' },
        disabled: { control: 'boolean', description: 'Disables interaction and dims the stars.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        ariaLabel: { control: 'text', description: "Override for the group aria-label. Falls back to the locale's `rating` string." },
        size: { control: 'select', options: ['sm', 'md', 'lg'], description: 'Star size.' },
        locale: { control: false, description: 'Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set.' },
        ratingChange: { control: false, description: 'Emits the new rating value when the user selects a star.' },
    },
    args: {
        max: 5,
        precision: 1,
        readonly: false,
        disabled: false,
        class: '',
        ariaLabel: undefined,
        size: 'md',
    },
};

export default meta;
type Story = StoryObj<RatingComponent>;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: { ...args, value: signal(3) },
        template: `
            <ui-rating
                [ngModel]="value()"
                (ngModelChange)="value.set($event)"
                [max]="max"
                [precision]="precision"
                [readonly]="readonly"
                [disabled]="disabled"
                [class]="class"
                [ariaLabel]="ariaLabel"
                [size]="size"
            />
        `,
    }),
};

export const HalfPrecision: Story = {
    render: () => ({
        props: { value: signal(2.5) },
        template: `
            <div class="space-y-2">
                <p class="text-sm text-muted-foreground">Rating: {{ value() }} stars</p>
                <ui-rating
                    [ngModel]="value()"
                    (ngModelChange)="value.set($event)"
                    [precision]="0.5"
                />
            </div>
        `,
    }),
};

export const Readonly: Story = {
    render: () => ({
        template: `
            <div class="space-y-4">
                <div class="flex items-center gap-2">
                    <ui-rating [ngModel]="4" [readonly]="true" />
                    <span class="text-sm text-muted-foreground">4.0 out of 5</span>
                </div>
                <div class="flex items-center gap-2">
                    <ui-rating [ngModel]="3.5" [precision]="0.5" [readonly]="true" />
                    <span class="text-sm text-muted-foreground">3.5 out of 5</span>
                </div>
            </div>
        `,
    }),
};

export const Disabled: Story = {
    render: () => ({
        template: `
            <ui-rating [ngModel]="3" [disabled]="true" />
        `,
    }),
};

export const Sizes: Story = {
    render: () => ({
        template: `
            <div class="space-y-4">
                <div class="flex items-center gap-4">
                    <span class="w-16 text-sm">Small</span>
                    <ui-rating [ngModel]="4" [readonly]="true" size="sm" />
                </div>
                <div class="flex items-center gap-4">
                    <span class="w-16 text-sm">Medium</span>
                    <ui-rating [ngModel]="4" [readonly]="true" size="md" />
                </div>
                <div class="flex items-center gap-4">
                    <span class="w-16 text-sm">Large</span>
                    <ui-rating [ngModel]="4" [readonly]="true" size="lg" />
                </div>
            </div>
        `,
    }),
};

export const TenStars: Story = {
    render: () => ({
        props: { value: signal(7) },
        template: `
            <div class="space-y-2">
                <p class="text-sm text-muted-foreground">Rating: {{ value() }} / 10</p>
                <ui-rating
                    [ngModel]="value()"
                    (ngModelChange)="value.set($event)"
                    [max]="10"
                />
            </div>
        `,
    }),
};

export const CustomAriaLabel: Story = {
    render: () => ({
        props: { value: signal(3) },
        template: `
            <ui-rating
                [ngModel]="value()"
                (ngModelChange)="value.set($event)"
                ariaLabel="Movie rating"
            />
        `,
    }),
};

export const RTL: Story = {
    render: () => ({
        props: { value: signal(3.5) },
        template: `
            <div dir="rtl" class="space-y-4">
                <div class="space-y-2">
                    <p class="text-sm text-muted-foreground">التقييم: {{ value() }} نجوم (3.5)</p>
                    <ui-rating
                        [ngModel]="value()"
                        (ngModelChange)="value.set($event)"
                        [precision]="0.5"
                    />
                </div>
                 <div class="space-y-2">
                    <p class="text-sm text-muted-foreground">التقييم: 2.5 نجوم</p>
                    <ui-rating
                        [ngModel]="2.5"
                        [precision]="0.5"
                        [readonly]="true"
                    />
                </div>
            </div>
        `,
    }),
};
