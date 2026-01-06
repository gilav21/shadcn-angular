import { Meta, StoryObj } from '@storybook/angular';
import { ProgressComponent } from './progress.component';

const meta: Meta<ProgressComponent> = {
    title: 'UI/Progress',
    component: ProgressComponent,
    tags: ['autodocs'],
    argTypes: {
        value: {
            control: { type: 'range', min: 0, max: 100 },
        },
        max: {
            control: { type: 'number' },
        },
    },
    args: {
        value: 60,
        max: 100,
    },
};

export default meta;
type Story = StoryObj<ProgressComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-progress [value]="value" [max]="max" [ariaLabel]="'Progress'"></ui-progress>`,
    }),
};
