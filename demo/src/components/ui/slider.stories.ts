import { Meta, StoryObj } from '@storybook/angular';
import { SliderComponent } from './slider.component';
import { cn } from '../lib/utils';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<SliderComponent> = {
    title: 'UI/Slider',
    component: SliderComponent,
    tags: ['autodocs'],
    argTypes: {
        min: { control: 'number' },
        max: { control: 'number' },
        step: { control: 'number' },
        disabled: { control: 'boolean' },
        defaultValue: { control: 'number' },
    },
    args: {
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<SliderComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-slider [min]="min" [max]="max" [step]="step" [defaultValue]="defaultValue" [disabled]="disabled" [ariaLabel]="'Slider'" class="w-[60%]"></ui-slider>`,
    }),
};
