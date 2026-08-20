import { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { VirtualScrollComponent, VirtualItemDirective, VirtualItem } from './virtual-scroll.component';

interface ListItem extends VirtualItem {
    id: number;
    title: string;
    description: string;
}

function generateItems(count: number): ListItem[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        title: `Item ${i + 1}`,
        description: `Description for item ${i + 1}`,
    }));
}

const meta: Meta<VirtualScrollComponent<ListItem>> = {
    title: 'UI/VirtualScroll',
    component: VirtualScrollComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [VirtualScrollComponent, VirtualItemDirective],
        }),
    ],
    argTypes: {
        items: { control: 'object', description: 'Full data set to virtualize.' },
        minItemHeight: { control: 'number', description: 'Minimum/estimated row height in pixels, used before an item is measured.' },
        buffer: { control: 'number', description: 'Extra rows rendered above/below the viewport to reduce blank flashes while scrolling.' },
        loading: { control: 'boolean', description: 'Shows the loading template/footer and suppresses scrollEnd emission.' },
        hasMore: { control: 'boolean', description: 'Whether more items can be loaded — gates the scrollEnd emission near the bottom.' },
    },
    args: {
        items: generateItems(1000),
        minItemHeight: 60,
        buffer: 5,
        loading: false,
        hasMore: true,
    },
};

export default meta;
type Story = StoryObj<VirtualScrollComponent<ListItem>>;

const TEMPLATE = `
    <div class="h-[350px] sm:h-[400px] w-full max-w-[500px] border rounded-lg">
        <ui-virtual-scroll [items]="items" [minItemHeight]="minItemHeight" [buffer]="buffer" [loading]="loading" [hasMore]="hasMore">
            <ng-template uiVirtualItem let-item let-index="index">
                <div class="flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/50 transition-colors">
                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {{ index + 1 }}
                    </div>
                    <div>
                        <p class="text-sm font-medium">{{ item.title }}</p>
                        <p class="text-xs text-muted-foreground">{{ item.description }}</p>
                    </div>
                </div>
            </ng-template>
        </ui-virtual-scroll>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const WithLoading: Story = {
    args: {
        items: generateItems(50),
        minItemHeight: 50,
        loading: true,
        hasMore: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[350px] sm:h-[400px] w-full max-w-[500px] border rounded-lg">
                <ui-virtual-scroll [items]="items" [minItemHeight]="minItemHeight" [loading]="loading" [hasMore]="hasMore">
                    <ng-template uiVirtualItem let-item let-index="index">
                        <div class="flex items-center gap-3 px-4 py-3 border-b">
                            <span class="text-sm font-medium">{{ item.title }}</span>
                        </div>
                    </ng-template>
                </ui-virtual-scroll>
            </div>
        `,
    }),
};

export const NoMoreItems: Story = {
    args: {
        items: generateItems(30),
        hasMore: false,
    },
    render,
};

export const SmallBuffer: Story = {
    args: {
        items: generateItems(500),
        minItemHeight: 40,
        buffer: 2,
    },
    render: (args) => ({
        props: args,
        template: `
            <div class="h-[300px] w-full max-w-[400px] border rounded-lg">
                <ui-virtual-scroll [items]="items" [minItemHeight]="minItemHeight" [buffer]="buffer">
                    <ng-template uiVirtualItem let-item let-index="index">
                        <div class="px-4 py-2 border-b text-sm">
                            {{ item.title }} - {{ item.description }}
                        </div>
                    </ng-template>
                </ui-virtual-scroll>
            </div>
        `,
    }),
};

export const Horizontal: Story = {
    name: 'Horizontal virtualization',
    render: () => ({
        props: { items: generateItems(10000) },
        template: `
            <div class="space-y-2">
                <p class="text-sm text-muted-foreground">
                    10,000 cells windowed on the X axis. <code>orientation="horizontal"</code> runs the
                    same measure-and-correct machinery as the vertical axis, sized by
                    <code>minItemWidth</code>.
                </p>
                <div class="h-[140px] w-full border rounded-lg">
                    <ui-virtual-scroll [items]="items" orientation="horizontal" [minItemWidth]="160">
                        <ng-template uiVirtualItem let-item let-index="index">
                            <div class="h-full w-[160px] border-e p-3 text-sm flex flex-col justify-center">
                                <span class="font-medium">{{ item.title }}</span>
                                <span class="text-xs text-muted-foreground">#{{ index }}</span>
                            </div>
                        </ng-template>
                    </ui-virtual-scroll>
                </div>
            </div>
        `,
    }),
};

export const Grid2D: Story = {
    name: '2D virtualization (both axes)',
    render: () => ({
        props: { items: generateItems(200 * 60) },
        template: `
            <div class="space-y-2">
                <p class="text-sm text-muted-foreground">
                    12,000 cells as a 200 x 60 grid. <code>orientation="both"</code> reads
                    <code>items</code> row-major and windows BOTH axes, so only the visible
                    intersection is rendered — not a whole row or a whole column.
                </p>
                <div class="h-[320px] w-full border rounded-lg">
                    <ui-virtual-scroll
                        [items]="items"
                        orientation="both"
                        [columnCount]="60"
                        [minItemWidth]="120"
                        [minItemHeight]="48"
                    >
                        <ng-template uiVirtualItem let-item let-index="index">
                            <div class="h-[48px] w-[120px] border-b border-e p-2 text-xs flex items-center">
                                {{ item.title }}
                            </div>
                        </ng-template>
                    </ui-virtual-scroll>
                </div>
            </div>
        `,
    }),
};
