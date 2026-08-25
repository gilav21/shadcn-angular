import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ResultComponent } from './result.component';
import { ResultDetailComponent } from './sub/result-detail.component';
import { ButtonComponent } from '../button';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<ResultComponent> = {
    title: 'UI/Result',
    component: ResultComponent,
    decorators: [
        moduleMetadata({
            imports: [ResultComponent, ResultDetailComponent, ButtonComponent],
        }),
    ],
    tags: ['autodocs'],
    argTypes: {
        status: {
            control: 'inline-radio',
            options: ['success', 'error', 'warning', 'info'],
            description:
                'Outcome being reported. Drives the glyph and its colour — never how loudly the panel is announced, which stays polite for every status.',
        },
        title: { control: 'text', description: 'Headline. Omitted entirely when empty.' },
        description: {
            control: 'text',
            description: 'Supporting line under the headline. Omitted entirely when empty.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the panel.' },
    },
    args: {
        status: 'success',
        title: 'Payment received',
        description: 'We emailed your receipt to ada@example.com.',
        class: '',
    },
};

export default meta;
type Story = StoryObj<ResultComponent>;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: args => ({
        props: args,
        template: `
            <ui-result [status]="status" [title]="title" [description]="description" [class]="class">
                <ui-button>Back to dashboard</ui-button>
                <ui-button variant="outline">View receipt</ui-button>
            </ui-result>
        `,
    }),
};

/** All four statuses. Each has its own glyph and colour; all four are announced politely. */
export const Statuses: Story = {
    render: () => ({
        template: `
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ui-result status="success" title="Payment received"
                           description="We emailed your receipt." />
                <ui-result status="error" title="Payment failed"
                           description="Your card was declined." />
                <ui-result status="warning" title="Partially imported"
                           description="18 of 20 rows were imported." />
                <ui-result status="info" title="Request queued"
                           description="We'll email you when it finishes." />
            </div>
        `,
    }),
};

/** Projected buttons land in the actions row, centred and wrapping. */
export const WithActions: Story = {
    render: () => ({
        template: `
            <ui-result status="success" title="Order placed"
                       description="Your order will arrive on Thursday.">
                <ui-button>Track order</ui-button>
                <ui-button variant="outline">View invoice</ui-button>
                <ui-button variant="ghost">Keep shopping</ui-button>
            </ui-result>
        `,
    }),
};

/** With no actions projected, the actions row collapses and leaves no gap. */
export const WithoutActions: Story = {
    render: () => ({
        template: `
            <ui-result status="info" title="Nothing to do"
                       description="Every invoice in this period is already reconciled." />
        `,
    }),
};

/**
 * `ui-result-detail` is selected out of the default slot and rendered above the
 * actions, so an error dump never shares a row with the buttons. Its content is
 * start-aligned, because centred code is unreadable.
 */
export const WithDetail: Story = {
    render: () => ({
        template: `
            <ui-result status="error" title="Import failed"
                       description="We could not parse the file you uploaded.">
                <ui-result-detail>
<pre class="whitespace-pre">TypeError: Cannot read properties of undefined (reading 'sku')
    at parseRow (import.ts:42:18)
    at Array.map (&lt;anonymous&gt;)</pre>
                </ui-result-detail>
                <ui-button>Try again</ui-button>
                <ui-button variant="outline">Contact support</ui-button>
            </ui-result>
        `,
    }),
};

/** At 320px the three actions wrap instead of overflowing. */
export const NarrowViewport: Story = {
    render: () => ({
        template: `
            <div class="w-[320px] border border-dashed">
                <ui-result status="warning" title="Almost there"
                           description="Two fields still need your attention.">
                    <ui-button>Review fields</ui-button>
                    <ui-button variant="outline">Save draft</ui-button>
                    <ui-button variant="ghost">Discard</ui-button>
                </ui-result>
            </div>
        `,
    }),
};

/** Right-to-left: the panel uses only logical spacing, so it mirrors wholesale. */
export const RightToLeft: Story = {
    render: () => ({
        template: `
            <div dir="rtl">
                <ui-result status="success" title="התשלום התקבל"
                           description="שלחנו לך את הקבלה במייל.">
                    <ui-button>חזרה ללוח הבקרה</ui-button>
                    <ui-button variant="outline">צפייה בקבלה</ui-button>
                </ui-result>
            </div>
        `,
    }),
};
