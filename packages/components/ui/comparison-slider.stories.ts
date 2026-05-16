import { Meta, StoryObj } from '@storybook/angular';
import { ComparisonSliderComponent } from './comparison-slider.component';

const BEFORE_URL = 'https://picsum.photos/id/10/800/450';
const AFTER_URL = 'https://picsum.photos/id/20/800/450';

const meta: Meta<ComparisonSliderComponent> = {
    title: 'UI/Comparison Slider',
    component: ComparisonSliderComponent,
    tags: ['autodocs'],
    argTypes: {
        orientation: {
            control: 'select',
            options: ['horizontal', 'vertical'],
        },
        position: {
            control: { type: 'range', min: 0, max: 100, step: 1 },
        },
        beforeSrc: { control: 'text' },
        afterSrc: { control: 'text' },
        beforeLabel: { control: 'text' },
        afterLabel: { control: 'text' },
    },
    args: {
        beforeSrc: BEFORE_URL,
        afterSrc: AFTER_URL,
        beforeAlt: 'Before image',
        afterAlt: 'After image',
        orientation: 'horizontal',
        position: 50,
    },
};

export default meta;
type Story = StoryObj<ComparisonSliderComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="w-full max-w-2xl mx-auto">
                <ui-comparison-slider
                    [beforeSrc]="beforeSrc"
                    [afterSrc]="afterSrc"
                    [beforeAlt]="beforeAlt"
                    [afterAlt]="afterAlt"
                    [position]="position"
                    [orientation]="orientation"
                />
            </div>
        `,
    }),
};

export const Horizontal: Story = {
    args: {
        orientation: 'horizontal',
        position: 40,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="w-full max-w-2xl mx-auto">
                <ui-comparison-slider
                    [beforeSrc]="beforeSrc"
                    [afterSrc]="afterSrc"
                    [orientation]="orientation"
                    [position]="position"
                />
            </div>
        `,
    }),
};

export const Vertical: Story = {
    args: {
        orientation: 'vertical',
        position: 55,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="w-full max-w-2xl mx-auto">
                <ui-comparison-slider
                    [beforeSrc]="beforeSrc"
                    [afterSrc]="afterSrc"
                    [orientation]="orientation"
                    [position]="position"
                />
            </div>
        `,
    }),
};

export const WithLabels: Story = {
    args: {
        beforeLabel: 'Before',
        afterLabel: 'After',
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="w-full max-w-2xl mx-auto">
                <ui-comparison-slider
                    [beforeSrc]="beforeSrc"
                    [afterSrc]="afterSrc"
                    [beforeLabel]="beforeLabel"
                    [afterLabel]="afterLabel"
                    [position]="position"
                />
            </div>
        `,
    }),
};
