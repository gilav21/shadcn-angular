import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from '../button';
import { BannerComponent } from './index';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<BannerComponent> = {
    title: 'UI/Banner',
    component: BannerComponent,
    tags: ['autodocs'],
    decorators: [moduleMetadata({ imports: [BannerComponent, ButtonComponent] })],
    argTypes: {
        variant: {
            control: 'select',
            options: ['info', 'warning', 'success', 'destructive'],
            description:
                'Severity treatment. `destructive` also sets `role="alert"` / `aria-live="assertive"`; everything else announces politely via `role="status"`.',
        },
        message: {
            control: 'text',
            description:
                'Plain-text announcement. Ignored when content is projected into the banner — the projection wins.',
        },
        dismissible: {
            control: 'boolean',
            description: 'Render a close control that hides the banner and emits `dismissed`.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        variant: 'info',
        message: 'Scheduled maintenance at 02:00 UTC.',
        dismissible: false,
        class: '',
    },
};

export default meta;
type Story = StoryObj<BannerComponent>;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-banner [variant]="variant" [message]="message" [dismissible]="dismissible" [class]="class" />`,
    }),
};

/** All four severities side by side. */
export const Variants: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col gap-2">
                <ui-banner variant="info" message="A new version of the console is available." />
                <ui-banner variant="warning" message="Scheduled maintenance at 02:00 UTC." />
                <ui-banner variant="success" message="Your workspace was migrated successfully." />
                <ui-banner variant="destructive" message="Billing failed — update your card to avoid interruption." />
            </div>`,
    }),
};

/** The close control hides the bar and emits `dismissed`. */
export const Dismissible: Story = {
    render: () => ({
        template: `<ui-banner variant="warning" message="You are impersonating another user." dismissible />`,
    }),
};

/** Projected content replaces the `message` input entirely. */
export const ProjectedContent: Story = {
    render: () => ({
        template: `
            <ui-banner variant="info" dismissible>
                <span class="flex flex-wrap items-center gap-2">
                    Trial ends in 3 days.
                    <ui-button size="sm" label="Upgrade" />
                </span>
            </ui-banner>`,
    }),
};

/** Right-to-left layout. */
export const Rtl: Story = {
    render: () => ({
        template: `
            <div dir="rtl">
                <ui-banner variant="warning" message="תחזוקה מתוכננת בשעה 02:00 UTC." dismissible />
            </div>`,
    }),
};
