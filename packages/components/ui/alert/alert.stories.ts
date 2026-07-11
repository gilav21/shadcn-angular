import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { AlertComponent, AlertTitleComponent, AlertDescriptionComponent } from './index';

const INFO_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>`;
const ALERT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
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
            description: 'Visual style of the alert. `destructive` also sets `role="alert"` and `aria-live="assertive"`.',
        },
        title: {
            control: 'text',
            description: 'Simple-mode title text. When set, the component auto-generates the title/description structure from inputs instead of requiring `ui-alert-title`/`ui-alert-description` projection.',
        },
        description: {
            control: 'text',
            description: 'Simple-mode description text, rendered under the title when `title` is set.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        variant: 'default',
        title: 'Heads up!',
        description: 'You can add components to your app using the cli.',
        class: '',
    },
};

export default meta;
type Story = StoryObj<AlertComponent>;

const TEMPLATE = `
    <ui-alert [variant]="variant" [title]="title" [description]="description" [class]="class">
        ${INFO_ICON}
    </ui-alert>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Variants: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-col gap-3">
                <ui-alert variant="default" title="Heads up!" description="You can add components to your app using the cli.">
                    ${INFO_ICON}
                </ui-alert>
                <ui-alert variant="destructive" title="Error" description="Your session has expired. Please log in again.">
                    ${ALERT_ICON}
                </ui-alert>
            </div>`,
    }),
};

export const Destructive: Story = {
    args: {
        variant: 'destructive',
        title: 'Error',
        description: 'Your session has expired. Please log in again.',
    },
    render: (args) => ({
        props: args,
        template: `
            <ui-alert [variant]="variant" [title]="title" [description]="description" [class]="class">
                ${ALERT_ICON}
            </ui-alert>`,
    }),
};

/** Simple mode: title/description inputs drive the generated structure. */
export const SimpleMode: Story = { render };

/** Template mode: full control via projected `ui-alert-title` / `ui-alert-description`. */
export const TemplateMode: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-alert [variant]="variant" [class]="class">
                ${ALERT_ICON}
                <ui-alert-title>Custom title</ui-alert-title>
                <ui-alert-description>
                    Fully custom content projected via <code>ui-alert-title</code> and <code>ui-alert-description</code>.
                </ui-alert-description>
            </ui-alert>`,
    }),
};

export const WithoutIcon: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-alert [variant]="variant" [title]="title" [description]="description" [class]="class"></ui-alert>`,
    }),
};
