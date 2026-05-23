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

export const CrossList: Story = {
    render: () => ({
        props: {
            todo: signal([
                { id: 1, name: 'Draft RFC' },
                { id: 2, name: 'Outline sections' },
                { id: 3, name: 'Collect feedback' },
            ]),
            doing: signal([
                { id: 4, name: 'Wire up auth flow' },
            ]),
            done: signal([
                { id: 5, name: 'Set up repo' },
                { id: 6, name: 'Pin dependencies' },
            ]),
        },
        template: `
            <div class="space-y-4">
                <p class="text-sm text-muted-foreground">Drag cards between the three lists — they share the same <code>group</code>.</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="space-y-2">
                        <h3 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">To do</h3>
                        <ui-sortable [(items)]="todo" group="board" listId="todo" class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30 data-[receiving=true]:bg-primary/10 data-[receiving=true]:border-primary">
                            <ng-template uiSortableItem let-row let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full gap-3">
                                    <span class="flex-1 text-sm">{{ row.name }}</span>
                                </ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h3 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Doing</h3>
                        <ui-sortable [(items)]="doing" group="board" listId="doing" class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30 data-[receiving=true]:bg-primary/10 data-[receiving=true]:border-primary">
                            <ng-template uiSortableItem let-row let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full gap-3">
                                    <span class="flex-1 text-sm">{{ row.name }}</span>
                                </ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h3 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Done</h3>
                        <ui-sortable [(items)]="done" group="board" listId="done" class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30 data-[receiving=true]:bg-primary/10 data-[receiving=true]:border-primary">
                            <ng-template uiSortableItem let-row let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full gap-3">
                                    <span class="flex-1 text-sm">{{ row.name }}</span>
                                </ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                </div>
            </div>
        `,
    }),
};

export const KanbanShape: Story = {
    render: () => ({
        props: {
            backlog: signal([{ id: 1, name: 'A11y audit' }, { id: 2, name: 'i18n rewrite' }]),
            inProgress: signal([{ id: 3, name: 'Sortable polish' }]),
            archived: signal<{ id: number; name: string }[]>([]),
        },
        template: `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="border rounded-md bg-muted/30 flex flex-col">
                    <ui-sortable [(items)]="backlog" group="kanban" listId="backlog" class="gap-2 p-3 flex-1 min-h-48">
                        <div uiSortableHeader class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Backlog</div>
                        <div uiSortableEmpty class="text-sm text-muted-foreground italic py-6 text-center">Drop cards here</div>
                        <ng-template uiSortableItem let-row let-i="index">
                            <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ row.name }}</ui-sortable-item>
                        </ng-template>
                        <button uiSortableFooter class="text-xs text-muted-foreground hover:text-foreground mt-2 text-left">+ Add card</button>
                    </ui-sortable>
                </div>
                <div class="border rounded-md bg-muted/30 flex flex-col">
                    <ui-sortable [(items)]="inProgress" group="kanban" listId="in-progress" class="gap-2 p-3 flex-1 min-h-48">
                        <div uiSortableHeader class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">In progress</div>
                        <div uiSortableEmpty class="text-sm text-muted-foreground italic py-6 text-center">Drop cards here</div>
                        <ng-template uiSortableItem let-row let-i="index">
                            <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ row.name }}</ui-sortable-item>
                        </ng-template>
                        <button uiSortableFooter class="text-xs text-muted-foreground hover:text-foreground mt-2 text-left">+ Add card</button>
                    </ui-sortable>
                </div>
                <div class="border rounded-md bg-muted/30 flex flex-col">
                    <ui-sortable [(items)]="archived" group="kanban" listId="archived" class="gap-2 p-3 flex-1 min-h-48">
                        <div uiSortableHeader class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Archived</div>
                        <div uiSortableEmpty class="text-sm text-muted-foreground italic py-6 text-center">Drop cards here</div>
                        <ng-template uiSortableItem let-row let-i="index">
                            <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ row.name }}</ui-sortable-item>
                        </ng-template>
                        <button uiSortableFooter class="text-xs text-muted-foreground hover:text-foreground mt-2 text-left">+ Add card</button>
                    </ui-sortable>
                </div>
            </div>
        `,
    }),
};

export const WithAccepts: Story = {
    render: () => ({
        props: {
            inbox: signal([
                { id: 1, name: 'Bug report #143' },
                { id: 2, name: 'Feature request #92' },
                { id: 3, name: 'Triaged ticket #11' },
            ]),
            triaged: signal([{ id: 10, name: 'Triaged earlier' }]),
            wipLimit: (limit: number) => (_item: { id: number; name: string }, ctx: { toIndex: number }): { ok: boolean; reason?: string } => {
                return ctx.toIndex < limit
                    ? { ok: true }
                    : { ok: false, reason: 'WIP limit reached' };
            },
        },
        template: `
            <div class="space-y-4">
                <p class="text-sm text-muted-foreground">The "Triaged" list accepts at most 2 items. Try dropping a third — it will reject.</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <h3 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Inbox</h3>
                        <ui-sortable [(items)]="inbox" group="triage" listId="inbox" class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30">
                            <ng-template uiSortableItem let-row let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ row.name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                    <div class="space-y-2">
                        <h3 class="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Triaged (WIP 2)</h3>
                        <ui-sortable
                            [(items)]="triaged"
                            group="triage"
                            listId="triaged"
                            [accepts]="wipLimit(2)"
                            class="gap-2 min-h-32 p-2 border rounded-md bg-muted/30 data-[reject]:border-destructive data-[reject]:bg-destructive/10">
                            <ng-template uiSortableItem let-row let-i="index">
                                <ui-sortable-item [index]="i" class="bg-card border rounded-md px-3 py-2 w-full">{{ row.name }}</ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </div>
                </div>
            </div>
        `,
    }),
};
