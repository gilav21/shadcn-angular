import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { RatingComponent } from './rating.component';

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
        max: { control: 'number' },
        precision: { control: 'select', options: [0.5, 1] },
        readonly: { control: 'boolean' },
        disabled: { control: 'boolean' },
        size: { control: 'select', options: ['sm', 'md', 'lg'] },
    },
    args: {
        max: 5,
        precision: 1,
        readonly: false,
        disabled: false,
        size: 'md',
    },
};

export default meta;
type Story = StoryObj<RatingComponent>;

export const Default: Story = {
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

export const RTL: Story = {
    render: () => ({
        props: { value: signal(4) },
        template: `
            <div dir="rtl" class="space-y-2">
                <p class="text-sm text-muted-foreground">التقييم: {{ value() }} نجوم</p>
                <ui-rating
                    [ngModel]="value()"
                    (ngModelChange)="value.set($event)"
                />
            </div>
        `,
    }),
};
