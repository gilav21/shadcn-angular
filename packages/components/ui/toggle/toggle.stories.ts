import { Meta, StoryObj } from '@storybook/angular';
import { ToggleComponent } from './toggle.component';

const meta: Meta<ToggleComponent> = {
    title: 'UI/Toggle',
    component: ToggleComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'outline'],
            description: 'Visual style of the toggle.',
        },
        size: {
            control: 'select',
            options: ['default', 'sm', 'lg'],
            description: 'Sizing preset.',
        },
        disabled: { control: 'boolean', description: 'Disables interaction.' },
        defaultPressed: { control: 'boolean', description: 'Initial pressed state.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        variant: 'default',
        size: 'default',
        disabled: false,
        defaultPressed: false,
        class: '',
    },
};

export default meta;
type Story = StoryObj<ToggleComponent>;

const TEMPLATE = `
    <ui-toggle [variant]="variant" [size]="size" [disabled]="disabled" [defaultPressed]="defaultPressed" [class]="class">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M12 5v14M5 12h14"/></svg>
        <span class="ml-2">Bold</span>
    </ui-toggle>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const Outline: Story = {
    args: { variant: 'outline' },
    render: (args) => ({
        props: args,
        template: `
      <ui-toggle [variant]="variant" [size]="size" [disabled]="disabled" [defaultPressed]="defaultPressed" [class]="class">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
        <span class="ml-2">Italic</span>
      </ui-toggle>
    `,
    }),
};

export const Sizes: Story = {
    render: () => ({
        template: `
            <div class="flex flex-wrap items-center gap-3">
                <ui-toggle size="sm">Small</ui-toggle>
                <ui-toggle size="default">Default</ui-toggle>
                <ui-toggle size="lg">Large</ui-toggle>
            </div>`,
    }),
};

export const DefaultPressed: Story = {
    args: { defaultPressed: true },
    render,
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};
