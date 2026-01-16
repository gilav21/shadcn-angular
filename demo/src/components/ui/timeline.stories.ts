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
} from './timeline.component';

const meta: Meta = {
    title: 'UI/Timeline',
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
};

export default meta;

type Story = StoryObj;

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
