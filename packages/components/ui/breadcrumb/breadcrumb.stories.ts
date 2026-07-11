import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    BreadcrumbComponent,
    BreadcrumbItem,
    BreadcrumbListComponent,
    BreadcrumbItemComponent,
    BreadcrumbLinkComponent,
    BreadcrumbPageComponent,
    BreadcrumbSeparatorComponent,
    BreadcrumbEllipsisComponent,
} from './index';

// `<ui-breadcrumb>` itself only owns `locale`; the interactive data-driven
// inputs (`items`, `skeleton`, `skeletonCount`) live on the projected
// `<ui-breadcrumb-list>`. They are surfaced here as explicit argTypes, and
// the story-local `BreadcrumbStoryProps` type merges both so the Controls
// panel can drive the whole compound component live.
type BreadcrumbStoryProps = BreadcrumbComponent & {
    items: BreadcrumbItem[];
    skeleton: boolean;
    skeletonCount: number;
};

const meta: Meta<BreadcrumbStoryProps> = {
    title: 'UI/Breadcrumb',
    component: BreadcrumbComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                BreadcrumbComponent,
                BreadcrumbListComponent,
                BreadcrumbItemComponent,
                BreadcrumbLinkComponent,
                BreadcrumbPageComponent,
                BreadcrumbSeparatorComponent,
                BreadcrumbEllipsisComponent,
            ],
        }),
    ],
    argTypes: {
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Locale dictionary key. Falls back to `UI_LOCALE_ID` when unset. `he`/`ar` also flip `dir` to rtl.',
        },
        items: {
            control: 'object',
            description: '`ui-breadcrumb-list` data-driven mode: renders items with auto-generated separators, skipping projected content.',
        },
        skeleton: {
            control: 'boolean',
            description: '`ui-breadcrumb-list` loading mode: renders skeleton placeholders instead of items/content.',
        },
        skeletonCount: {
            control: 'number',
            description: 'Number of skeleton segments rendered when `skeleton` is true.',
            min: 1,
            max: 8,
            step: 1,
        },
    },
    args: {
        locale: 'en',
        items: [
            { label: 'Home', href: '/' },
            { label: 'Components', href: '/components' },
            { label: 'Breadcrumb', isCurrentPage: true },
        ],
        skeleton: false,
        skeletonCount: 3,
    },
};

export default meta;
type Story = StoryObj<BreadcrumbStoryProps>;

const PLAYGROUND_TEMPLATE = `
    <ui-breadcrumb [locale]="locale">
        <ui-breadcrumb-list [items]="items" [skeleton]="skeleton" [skeletonCount]="skeletonCount" />
    </ui-breadcrumb>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: PLAYGROUND_TEMPLATE,
});

/** Interactive playground — locale, items, skeleton and skeletonCount are all wired to the Controls panel. */
export const Playground: Story = { render };

export const TemplateComposition: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-breadcrumb>
                <ui-breadcrumb-list>
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-link href="/">Home</ui-breadcrumb-link>
                    </ui-breadcrumb-item>
                    <ui-breadcrumb-separator />
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-link href="/components">Components</ui-breadcrumb-link>
                    </ui-breadcrumb-item>
                    <ui-breadcrumb-separator />
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-page>Breadcrumb</ui-breadcrumb-page>
                    </ui-breadcrumb-item>
                </ui-breadcrumb-list>
            </ui-breadcrumb>`,
    }),
};

export const ItemsArray: Story = {
    args: {
        items: [
            { label: 'Home', href: '/' },
            { label: 'Docs', href: '/docs' },
            { label: 'Components', href: '/docs/components' },
            { label: 'Breadcrumb', isCurrentPage: true },
        ],
    },
    render,
};

export const WithEllipsis: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-breadcrumb>
                <ui-breadcrumb-list>
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-link href="/">Home</ui-breadcrumb-link>
                    </ui-breadcrumb-item>
                    <ui-breadcrumb-separator />
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-ellipsis />
                    </ui-breadcrumb-item>
                    <ui-breadcrumb-separator />
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-link href="/components">Components</ui-breadcrumb-link>
                    </ui-breadcrumb-item>
                    <ui-breadcrumb-separator />
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-page>Breadcrumb</ui-breadcrumb-page>
                    </ui-breadcrumb-item>
                </ui-breadcrumb-list>
            </ui-breadcrumb>`,
    }),
};

export const CustomSeparator: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-breadcrumb>
                <ui-breadcrumb-list>
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-link href="/">Home</ui-breadcrumb-link>
                    </ui-breadcrumb-item>
                    <ui-breadcrumb-separator>/</ui-breadcrumb-separator>
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-link href="/components">Components</ui-breadcrumb-link>
                    </ui-breadcrumb-item>
                    <ui-breadcrumb-separator>/</ui-breadcrumb-separator>
                    <ui-breadcrumb-item>
                        <ui-breadcrumb-page>Breadcrumb</ui-breadcrumb-page>
                    </ui-breadcrumb-item>
                </ui-breadcrumb-list>
            </ui-breadcrumb>`,
    }),
};

export const Skeleton: Story = {
    args: { skeleton: true, skeletonCount: 3 },
    render,
};

export const RTL: Story = {
    args: {
        locale: 'ar',
        items: [
            { label: 'الرئيسية', href: '/' },
            { label: 'المكونات', href: '/components' },
            { label: 'مسار التنقل', isCurrentPage: true },
        ],
    },
    render,
};
