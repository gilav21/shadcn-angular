import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ErrorPageComponent } from './error-page.component';
import { ErrorPageActionsComponent } from './sub/error-page-actions.component';
import { ErrorPageIllustrationComponent } from './sub/error-page-illustration.component';
import { ButtonComponent } from '../button';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<ErrorPageComponent> = {
    title: 'UI/Error Page',
    component: ErrorPageComponent,
    decorators: [
        moduleMetadata({
            imports: [
                ErrorPageComponent,
                ErrorPageIllustrationComponent,
                ErrorPageActionsComponent,
                ButtonComponent,
            ],
        }),
    ],
    tags: ['autodocs'],
    argTypes: {
        code: {
            control: 'text',
            description:
                "Status code. `'404'`, `'403'` and `'500'` ship with default copy; anything else falls back to the locale's generic copy rather than rendering blank.",
        },
        title: { control: 'text', description: "Overrides the code's default heading." },
        description: {
            control: 'text',
            description: "Overrides the code's default supporting line.",
        },
        class: { control: 'text', description: 'Extra classes merged onto the page container.' },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Locale registry key. Falls back to `UI_LOCALE_ID` when not set.',
        },
        goBack: {
            action: 'goBack',
            description:
                'Emitted by the default back action. The component never routes — the consumer decides what "back" means.',
        },
        goHome: {
            action: 'goHome',
            description:
                'Emitted by the default home action. The component never routes — the consumer decides where home is.',
        },
    },
    args: {
        code: '404',
        title: '',
        description: '',
        class: '',
        locale: 'en',
    },
};

export default meta;
type Story = StoryObj<ErrorPageComponent>;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: args => ({
        props: args,
        template: `
            <ui-error-page
                [code]="code"
                [title]="title"
                [description]="description"
                [class]="class"
                [locale]="locale"
                (goBack)="goBack($event)"
                (goHome)="goHome($event)"
            />
        `,
    }),
};

/** The three codes that ship with default copy. */
export const KnownCodes: Story = {
    render: () => ({
        template: `
            <div class="divide-y">
                <ui-error-page code="404" />
                <ui-error-page code="403" />
                <ui-error-page code="500" />
            </div>
        `,
    }),
};

/** An unrecognised code still renders: the copy falls back to the generic message. */
export const UnknownCode: Story = {
    render: () => ({ template: `<ui-error-page code="418" />` }),
};

/** Explicit copy overrides the code's defaults, independently of each other. */
export const CustomCopy: Story = {
    render: () => ({
        template: `
            <ui-error-page
                code="404"
                title="This page moved"
                description="We reorganised the docs. Try the new address instead." />
        `,
    }),
};

/** A projected illustration replaces the typographic code rather than joining it. */
export const CustomIllustration: Story = {
    render: () => ({
        template: `
            <ui-error-page code="404">
                <ui-error-page-illustration>
                    <svg viewBox="0 0 120 80" class="h-32 w-auto text-muted-foreground/50"
                         fill="none" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="10" y="18" width="100" height="52" rx="6" />
                        <path d="M10 32h100" />
                        <circle cx="22" cy="25" r="2" />
                        <circle cx="32" cy="25" r="2" />
                        <path d="M46 46h28M52 58h16" />
                    </svg>
                </ui-error-page-illustration>
            </ui-error-page>
        `,
    }),
};

/**
 * Projected actions replace both defaults. Note that `goBack` / `goHome` stop
 * firing once you do this — wire your own handlers.
 */
export const CustomActions: Story = {
    render: () => ({
        template: `
            <ui-error-page code="500">
                <ui-error-page-actions>
                    <ui-button>Try again</ui-button>
                    <ui-button variant="outline">Check status page</ui-button>
                    <ui-button variant="ghost">Contact support</ui-button>
                </ui-error-page-actions>
            </ui-error-page>
        `,
    }),
};

/** At 320px the heading, copy and actions all stay on screen. */
export const NarrowViewport: Story = {
    render: () => ({
        template: `
            <div class="w-[320px] border border-dashed">
                <ui-error-page code="404" />
            </div>
        `,
    }),
};

/** Right-to-left: the page uses only logical spacing, so it mirrors wholesale. */
export const RightToLeft: Story = {
    render: () => ({
        template: `
            <div dir="rtl">
                <ui-error-page code="404" locale="he" />
            </div>
        `,
    }),
};
