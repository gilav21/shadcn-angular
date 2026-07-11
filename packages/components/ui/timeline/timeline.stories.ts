import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    TimelineComponent,
    TimelineItemComponent,
    TimelineConnectorComponent,
    TimelineDotComponent,
    TimelineHeaderComponent,
    TimelineContentComponent,
    TimelineTitleComponent,
    TimelineDescriptionComponent,
    TimelineTimeComponent,
} from '../timeline';

const meta: Meta<TimelineComponent> = {
    title: 'UI/Timeline',
    component: TimelineComponent,
    decorators: [
        moduleMetadata({
            imports: [
                TimelineComponent,
                TimelineItemComponent,
                TimelineConnectorComponent,
                TimelineDotComponent,
                TimelineHeaderComponent,
                TimelineContentComponent,
                TimelineTitleComponent,
                TimelineDescriptionComponent,
                TimelineTimeComponent,
            ],
        }),
    ],
    tags: ['autodocs'],
    argTypes: {
        orientation: {
            control: 'select',
            options: ['vertical', 'horizontal'],
            description: 'Layout direction of the timeline.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        orientation: 'vertical',
        class: '',
    },
};

export default meta;

type Story = StoryObj<TimelineComponent>;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: `
        <ui-timeline [orientation]="orientation" [class]="class">
            <ui-timeline-item>
                <ui-timeline-header>
                    <ui-timeline-dot />
                    <ui-timeline-connector />
                </ui-timeline-header>
                <ui-timeline-content>
                    <ui-timeline-title>Order Placed</ui-timeline-title>
                    <ui-timeline-description>Your order has been confirmed</ui-timeline-description>
                    <ui-timeline-time>10:00 AM</ui-timeline-time>
                </ui-timeline-content>
            </ui-timeline-item>
            <ui-timeline-item>
                <ui-timeline-header>
                    <ui-timeline-dot />
                    <ui-timeline-connector />
                </ui-timeline-header>
                <ui-timeline-content>
                    <ui-timeline-title>Processing</ui-timeline-title>
                    <ui-timeline-description>Order is being prepared</ui-timeline-description>
                    <ui-timeline-time>11:30 AM</ui-timeline-time>
                </ui-timeline-content>
            </ui-timeline-item>
            <ui-timeline-item>
                <ui-timeline-header>
                    <ui-timeline-dot />
                </ui-timeline-header>
                <ui-timeline-content>
                    <ui-timeline-title>Delivered</ui-timeline-title>
                    <ui-timeline-description>Package arrived</ui-timeline-description>
                    <ui-timeline-time>2:00 PM</ui-timeline-time>
                </ui-timeline-content>
            </ui-timeline-item>
        </ui-timeline>`,
});

/** Interactive playground — every input is wired to the Controls panel (template-composition mode). */
export const Playground: Story = { render };

export const Default: Story = {
    render: () => ({
        template: `
            <ui-timeline>
                <ui-timeline-item>
                    <ui-timeline-header>
                        <ui-timeline-dot />
                        <ui-timeline-connector />
                    </ui-timeline-header>
                    <ui-timeline-content>
                        <ui-timeline-title>Order Placed</ui-timeline-title>
                        <ui-timeline-description>Your order has been confirmed</ui-timeline-description>
                        <ui-timeline-time>10:00 AM</ui-timeline-time>
                    </ui-timeline-content>
                </ui-timeline-item>
                <ui-timeline-item>
                    <ui-timeline-header>
                        <ui-timeline-dot />
                        <ui-timeline-connector />
                    </ui-timeline-header>
                    <ui-timeline-content>
                        <ui-timeline-title>Processing</ui-timeline-title>
                        <ui-timeline-description>Order is being prepared</ui-timeline-description>
                        <ui-timeline-time>11:30 AM</ui-timeline-time>
                    </ui-timeline-content>
                </ui-timeline-item>
                <ui-timeline-item>
                    <ui-timeline-header>
                        <ui-timeline-dot />
                    </ui-timeline-header>
                    <ui-timeline-content>
                        <ui-timeline-title>Delivered</ui-timeline-title>
                        <ui-timeline-description>Package arrived</ui-timeline-description>
                        <ui-timeline-time>2:00 PM</ui-timeline-time>
                    </ui-timeline-content>
                </ui-timeline-item>
            </ui-timeline>
        `,
    }),
};

export const SimpleMode: Story = {
    name: 'Simple Mode (title/description/time inputs)',
    render: () => ({
        template: `
            <div class="space-y-2">
                <p class="text-sm text-muted-foreground">Simple mode: pass <code>title</code>/<code>description</code>/<code>time</code>/<code>variant</code> directly on <code>ui-timeline-item</code> instead of projecting header/content.</p>
                <ui-timeline>
                    <ui-timeline-item title="Order Placed" description="Your order has been confirmed" time="10:00 AM" variant="success" />
                    <ui-timeline-item title="Processing" description="Order is being prepared" time="11:30 AM" variant="filled" />
                    <ui-timeline-item title="Delivered" description="Package arrived" time="2:00 PM" [showConnector]="false" />
                </ui-timeline>
            </div>`,
    }),
};

export const WithVariants: Story = {
    render: () => ({
        template: `
            <ui-timeline>
                <ui-timeline-item>
                    <ui-timeline-header>
                        <ui-timeline-dot variant="success" />
                        <ui-timeline-connector />
                    </ui-timeline-header>
                    <ui-timeline-content>
                        <ui-timeline-title>Success</ui-timeline-title>
                        <ui-timeline-description>Operation completed successfully</ui-timeline-description>
                    </ui-timeline-content>
                </ui-timeline-item>
                <ui-timeline-item>
                    <ui-timeline-header>
                        <ui-timeline-dot variant="warning" />
                        <ui-timeline-connector />
                    </ui-timeline-header>
                    <ui-timeline-content>
                        <ui-timeline-title>Warning</ui-timeline-title>
                        <ui-timeline-description>Attention required</ui-timeline-description>
                    </ui-timeline-content>
                </ui-timeline-item>
                <ui-timeline-item>
                    <ui-timeline-header>
                        <ui-timeline-dot variant="error" />
                        <ui-timeline-connector />
                    </ui-timeline-header>
                    <ui-timeline-content>
                        <ui-timeline-title>Error</ui-timeline-title>
                        <ui-timeline-description>Something went wrong</ui-timeline-description>
                    </ui-timeline-content>
                </ui-timeline-item>
                <ui-timeline-item>
                    <ui-timeline-header>
                        <ui-timeline-dot variant="filled" />
                    </ui-timeline-header>
                    <ui-timeline-content>
                        <ui-timeline-title>Current</ui-timeline-title>
                        <ui-timeline-description>Active item</ui-timeline-description>
                    </ui-timeline-content>
                </ui-timeline-item>
            </ui-timeline>
        `,
    }),
};

export const Horizontal: Story = {
    args: { orientation: 'horizontal' },
    render: (args) => ({
        props: args,
        template: `
            <ui-timeline [orientation]="orientation" class="gap-6 overflow-x-auto pb-2">
                <ui-timeline-item title="Order Placed" description="Confirmed" time="10:00 AM" variant="success" />
                <ui-timeline-item title="Processing" description="In progress" time="11:30 AM" variant="filled" />
                <ui-timeline-item title="Delivered" description="Arrived" time="2:00 PM" [showConnector]="false" />
            </ui-timeline>`,
    }),
};

export const RTL: Story = {
    render: () => ({
        template: `
            <div dir="rtl">
                <ui-timeline>
                    <ui-timeline-item>
                        <ui-timeline-header>
                            <ui-timeline-dot variant="success" />
                            <ui-timeline-connector />
                        </ui-timeline-header>
                        <ui-timeline-content>
                            <ui-timeline-title>تم الطلب</ui-timeline-title>
                            <ui-timeline-description>تم تأكيد طلبك</ui-timeline-description>
                            <ui-timeline-time>10:00 صباحاً</ui-timeline-time>
                        </ui-timeline-content>
                    </ui-timeline-item>
                    <ui-timeline-item>
                        <ui-timeline-header>
                            <ui-timeline-dot variant="filled" />
                            <ui-timeline-connector />
                        </ui-timeline-header>
                        <ui-timeline-content>
                            <ui-timeline-title>قيد المعالجة</ui-timeline-title>
                            <ui-timeline-description>يتم تحضير الطلب</ui-timeline-description>
                            <ui-timeline-time>11:30 صباحاً</ui-timeline-time>
                        </ui-timeline-content>
                    </ui-timeline-item>
                    <ui-timeline-item>
                        <ui-timeline-header>
                            <ui-timeline-dot />
                        </ui-timeline-header>
                        <ui-timeline-content>
                            <ui-timeline-title>التسليم</ui-timeline-title>
                            <ui-timeline-description>في انتظار التسليم</ui-timeline-description>
                        </ui-timeline-content>
                    </ui-timeline-item>
                </ui-timeline>
            </div>
        `,
    }),
};
