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
};

export default meta;
type Story = StoryObj<VirtualScrollComponent<ListItem>>;

export const Default: Story = {
    render: () => ({
        props: {
            items: generateItems(1000),
        },
        template: `
            <div class="h-[400px] w-[500px] border rounded-lg">
                <ui-virtual-scroll [items]="items" [minItemHeight]="60" [buffer]="5">
                    <ng-template virtualItem let-item let-index="index">
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
            </div>
        `,
    }),
};

export const WithLoading: Story = {
    render: () => ({
        props: {
            items: generateItems(50),
        },
        template: `
            <div class="h-[400px] w-[500px] border rounded-lg">
                <ui-virtual-scroll [items]="items" [minItemHeight]="50" [loading]="true" [hasMore]="true">
                    <ng-template virtualItem let-item let-index="index">
                        <div class="flex items-center gap-3 px-4 py-3 border-b">
                            <span class="text-sm font-medium">{{ item.title }}</span>
                        </div>
                    </ng-template>
                </ui-virtual-scroll>
            </div>
        `,
    }),
};

export const SmallBuffer: Story = {
    render: () => ({
        props: {
            items: generateItems(500),
        },
        template: `
            <div class="h-[300px] w-[400px] border rounded-lg">
                <ui-virtual-scroll [items]="items" [minItemHeight]="40" [buffer]="2">
                    <ng-template virtualItem let-item let-index="index">
                        <div class="px-4 py-2 border-b text-sm">
                            {{ item.title }} - {{ item.description }}
                        </div>
                    </ng-template>
                </ui-virtual-scroll>
            </div>
        `,
    }),
};
