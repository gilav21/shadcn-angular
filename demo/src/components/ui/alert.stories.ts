import { Meta, StoryObj } from '@storybook/angular';
import { AlertComponent, AlertTitleComponent, AlertDescriptionComponent } from './alert.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<AlertComponent> = {
    title: 'UI/Alert',
    component: AlertComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [AlertComponent, AlertTitleComponent, AlertDescriptionComponent],
        }),
    ],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'destructive'],
        },
    },
    args: {
        variant: 'default',
    },
};

export default meta;
type Story = StoryObj<AlertComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <ui-alert [variant]="variant">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
        <ui-alert-title>Heads up!</ui-alert-title>
        <ui-alert-description>
          You can add components to your app using the cli.
        </ui-alert-description>
      </ui-alert>
    `,
    }),
};

export const Destructive: Story = {
    args: {
        variant: 'destructive',
    },
    render: (args) => ({
        props: args,
        template: `
      <ui-alert [variant]="variant">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <ui-alert-title>Error</ui-alert-title>
        <ui-alert-description>
          Your session has expired. Please log in again.
        </ui-alert-description>
      </ui-alert>
    `,
    }),
};
