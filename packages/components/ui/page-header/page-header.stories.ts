import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import {
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    BreadcrumbLinkComponent,
    BreadcrumbListComponent,
    BreadcrumbPageComponent,
    BreadcrumbSeparatorComponent,
} from '../breadcrumb';
import { ButtonComponent } from '../button';
import { PageHeaderComponent } from './index';

const BREADCRUMB = `
    <ui-breadcrumb>
        <ui-breadcrumb-list>
            <ui-breadcrumb-item>
                <ui-breadcrumb-link href="javascript:void(0)">Billing</ui-breadcrumb-link>
            </ui-breadcrumb-item>
            <ui-breadcrumb-separator />
            <ui-breadcrumb-item>
                <ui-breadcrumb-page>Invoices</ui-breadcrumb-page>
            </ui-breadcrumb-item>
        </ui-breadcrumb-list>
    </ui-breadcrumb>`;

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<PageHeaderComponent> = {
    title: 'UI/Page Header',
    component: PageHeaderComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                PageHeaderComponent,
                ButtonComponent,
                BreadcrumbComponent,
                BreadcrumbListComponent,
                BreadcrumbItemComponent,
                BreadcrumbLinkComponent,
                BreadcrumbPageComponent,
                BreadcrumbSeparatorComponent,
            ],
        }),
    ],
    argTypes: {
        title: { control: 'text', description: 'Heading text.' },
        description: { control: 'text', description: 'Sub-heading rendered under the title.' },
        headingLevel: {
            control: { type: 'number', min: 1, max: 6 },
            description:
                'Semantic level of the heading element (`h1`…`h6`). Drop it below 1 when the page already has an `<h1>`. The visual size never changes with it.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        title: 'Invoices',
        description: 'Everything billed this quarter.',
        headingLevel: 1,
        class: '',
    },
};

export default meta;
type Story = StoryObj<PageHeaderComponent>;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-page-header [title]="title" [description]="description" [headingLevel]="headingLevel" [class]="class">
                <ui-button variant="outline" label="Export" />
                <ui-button label="New invoice" />
            </ui-page-header>`,
    }),
};

/** Title and description only — the minimum useful header. */
export const TitleOnly: Story = {
    render: () => ({
        template: `<ui-page-header title="Invoices" description="Everything billed this quarter." />`,
    }),
};

/** A projected breadcrumb sits above the title. */
export const WithBreadcrumb: Story = {
    render: () => ({
        template: `
            <ui-page-header title="Invoices" description="Everything billed this quarter.">
                ${BREADCRUMB}
                <ui-button label="New invoice" />
            </ui-page-header>`,
    }),
};

/**
 * Narrow viewport: the actions stack below the heading block instead of being
 * squeezed beside it. Resize the preview to cross 640px.
 */
export const NarrowViewport: Story = {
    render: () => ({
        template: `
            <div class="w-[320px] rounded-lg border p-4">
                <ui-page-header title="Invoices" description="Everything billed this quarter.">
                    <ui-button variant="outline" label="Export" />
                    <ui-button label="New invoice" />
                </ui-page-header>
            </div>`,
    }),
};

/** `headingLevel` changes the element, not the look. */
export const SecondaryHeadingLevel: Story = {
    render: () => ({
        template: `<ui-page-header title="Team members" description="Manage who can access this workspace." [headingLevel]="2" />`,
    }),
};

/** Right-to-left layout. */
export const Rtl: Story = {
    render: () => ({
        template: `
            <div dir="rtl">
                <ui-page-header title="חשבוניות" description="כל מה שחויב ברבעון זה.">
                    <ui-button label="חשבונית חדשה" />
                </ui-page-header>
            </div>`,
    }),
};
