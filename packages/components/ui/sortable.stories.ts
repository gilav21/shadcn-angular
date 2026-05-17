import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { signal } from '@angular/core';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
    SortableHandleDirective,
} from './sortable.component';

const meta: Meta<SortableComponent<unknown>> = {
    title: 'UI/Sortable',
    component: SortableComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                SortableItemComponent,
                SortableItemTemplateDirective,
                SortableHandleDirective,
            ],
        }),
    ],
    argTypes: {
        orientation: {
            control: 'select',
            options: ['vertical', 'horizontal'],
        },
        handleOnly: { control: 'boolean' },
        disabled: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<SortableComponent<unknown>>;

const ITEMS = [
    { id: 1, name: 'Design system audit' },
    { id: 2, name: 'Component library update' },
    { id: 3, name: 'Accessibility review' },
    { id: 4, name: 'Performance profiling' },
    { id: 5, name: 'Documentation refresh' },
];

export const Vertical: Story = {
    render: (args) => ({
        props: {
            ...args,
            items: signal(ITEMS),
        },
        template: `
            <div class="max-w-sm space-y-2">
                <p class="text-sm text-muted-foreground mb-4">Drag the rows to reorder.</p>
                <ui-sortable [(items)]="items" orientation="vertical">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full gap-3 cursor-grab active:cursor-grabbing">
                            <span class="text-muted-foreground text-xs w-4 shrink-0 select-none">{{ i + 1 }}</span>
                            <span class="flex-1 text-sm">{{ row.name }}</span>
                        </ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            </div>
        `,
    }),
};

export const Horizontal: Story = {
    render: (args) => ({
        props: {
            ...args,
            items: signal([
                { id: 1, name: 'Design' },
                { id: 2, name: 'Build' },
                { id: 3, name: 'Test' },
                { id: 4, name: 'Ship' },
            ]),
        },
        template: `
            <div class="space-y-4">
                <p class="text-sm text-muted-foreground">Drag cards left and right to reorder.</p>
                <ui-sortable [(items)]="items" orientation="horizontal" class="gap-2">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" class="bg-primary text-primary-foreground rounded-md px-4 py-2 cursor-grab active:cursor-grabbing text-sm font-medium shrink-0">
                            {{ row.name }}
                        </ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            </div>
        `,
    }),
};

export const HandleOnly: Story = {
    render: (args) => ({
        props: {
            ...args,
            items: signal(ITEMS),
        },
        template: `
            <div class="max-w-sm space-y-2">
                <p class="text-sm text-muted-foreground mb-4">Drag only via the grip handle on the left.</p>
                <ui-sortable [(items)]="items" [handleOnly]="true">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full gap-3">
                            <span uiSortableHandle class="cursor-grab text-muted-foreground hover:text-foreground transition-colors" title="Drag to reorder">⠿</span>
                            <span class="flex-1 text-sm">{{ row.name }}</span>
                        </ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            </div>
        `,
    }),
};

export const Disabled: Story = {
    render: (args) => ({
        props: {
            ...args,
            items: signal(ITEMS),
        },
        template: `
            <div class="max-w-sm space-y-2">
                <p class="text-sm text-muted-foreground mb-4">Reordering is disabled.</p>
                <ui-sortable [(items)]="items" [disabled]="true">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full gap-3 opacity-60 cursor-not-allowed">
                            <span class="text-muted-foreground text-xs w-4 shrink-0">{{ i + 1 }}</span>
                            <span class="flex-1 text-sm">{{ row.name }}</span>
                        </ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            </div>
        `,
    }),
};
