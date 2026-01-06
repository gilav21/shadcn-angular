import { Meta, StoryObj } from '@storybook/angular';
import { ToggleComponent } from './toggle.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<ToggleComponent> = {
    title: 'UI/Toggle',
    component: ToggleComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'outline'],
        },
        size: {
            control: 'select',
            options: ['default', 'sm', 'lg'],
        },
        disabled: {
            control: 'boolean',
        },
        defaultPressed: {
            control: 'boolean',
        },
    },
    args: {
        variant: 'default',
        size: 'default',
        disabled: false,
        defaultPressed: false,
    },
};

export default meta;
type Story = StoryObj<ToggleComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <ui-toggle [variant]="variant" [size]="size" [disabled]="disabled" [defaultPressed]="defaultPressed">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M12 5v14M5 12h14"/></svg>
        <span class="ml-2">Bold</span>
      </ui-toggle>
    `,
    }),
};

export const Outline: Story = {
    args: {
        variant: 'outline',
    },
    render: (args) => ({
        props: args,
        template: `
      <ui-toggle [variant]="variant" [size]="size" [disabled]="disabled" [defaultPressed]="defaultPressed">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
        <span class="ml-2">Italic</span>
      </ui-toggle>
    `,
    }),
};
