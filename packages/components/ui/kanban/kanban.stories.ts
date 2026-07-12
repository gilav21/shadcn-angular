import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    KanbanComponent,
    KanbanColumnComponent,
    KanbanCardComponent,
    KanbanColumnHeaderComponent,
    KanbanCardContentComponent,
    KanbanColumn,
    KanbanCard,
    KanbanCardAddEvent,
    KanbanColumnDeleteEvent,
    KanbanHistoryState,
} from '../kanban';

const meta: Meta<KanbanComponent> = {
    title: 'UI/Kanban',
    component: KanbanComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                KanbanComponent,
                KanbanColumnComponent,
                KanbanCardComponent,
                KanbanColumnHeaderComponent,
                KanbanCardContentComponent,
            ],
        }),
    ],
    argTypes: {
        columns: { control: 'object', description: 'Simple-mode column definitions.' },
        cards: { control: 'object', description: 'Simple-mode card definitions.' },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Locale dictionary key (or a custom `KanbanLocale` object). Falls back to `UI_LOCALE_ID`.',
        },
        rtl: { control: 'boolean', description: 'Right-to-left layout; auto-synced from the resolved locale unless overridden.' },
        haveLabels: { control: 'boolean', description: 'Shows label chips and the labels field in the card dialog.' },
        haveAssignees: { control: 'boolean', description: 'Shows assignee avatars and the assignee field in the card dialog.' },
        assigneeOptions: { control: 'object', description: 'Selectable assignees offered in the card dialog.' },
        searchTerm: { control: 'text', description: 'Filters visible cards by title, description, or label text.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        columns: [],
        cards: [],
        locale: undefined,
        rtl: false,
        haveLabels: true,
        haveAssignees: true,
        assigneeOptions: [],
        searchTerm: '',
        class: '',
    },
};

export default meta;
type Story = StoryObj<KanbanComponent>;

const defaultColumns: KanbanColumn[] = [
    { id: 'backlog', title: 'Backlog', order: 0 },
    { id: 'in-progress', title: 'In Progress', order: 1 },
    { id: 'review', title: 'In Review', order: 2 },
    { id: 'done', title: 'Done', order: 3 },
];

const defaultCards: KanbanCard[] = [
    {
        id: 'card-1',
        columnId: 'backlog',
        title: 'Set up CI/CD pipeline',
        description: 'Configure GitHub Actions for automated testing and deployment.',
        priority: 'high',
        labels: [{ text: 'DevOps', color: '#6366f1' }],
        assignees: [{ name: 'Alice Chen' }],
        order: 0,
    },
    {
        id: 'card-2',
        columnId: 'backlog',
        title: 'Design token refresh',
        description: 'Update color palette and spacing tokens to match the new brand guidelines.',
        priority: 'medium',
        labels: [{ text: 'Design', color: '#ec4899' }],
        assignees: [{ name: 'Bob Kim' }],
        order: 1,
    },
    {
        id: 'card-3',
        columnId: 'in-progress',
        title: 'Implement Kanban board',
        description: 'Build a drag-and-drop Kanban board with WIP limits and column collapse.',
        priority: 'urgent',
        labels: [
            { text: 'Feature', color: '#8b5cf6' },
            { text: 'Angular', color: '#ef4444' },
        ],
        assignees: [{ name: 'Carol White' }, { name: 'Dave Jones' }],
        order: 0,
    },
    {
        id: 'card-4',
        columnId: 'in-progress',
        title: 'Accessibility audit',
        description: 'Run axe-core against all components and fix reported violations.',
        priority: 'medium',
        labels: [{ text: 'A11y', color: '#10b981' }],
        assignees: [{ name: 'Eve Martinez' }],
        order: 1,
    },
    {
        id: 'card-5',
        columnId: 'review',
        title: 'Storybook stories for new components',
        description: 'Write comprehensive stories for all 17 new animation and utility components.',
        priority: 'low',
        labels: [{ text: 'Docs', color: '#f97316' }],
        assignees: [{ name: 'Frank Lee' }],
        order: 0,
    },
    {
        id: 'card-6',
        columnId: 'done',
        title: 'Release v1.8.0',
        description: 'Tag release, update changelog, and publish to npm registry.',
        priority: 'high',
        labels: [{ text: 'Release', color: '#14b8a6' }],
        assignees: [{ name: 'Alice Chen' }],
        order: 0,
    },
];

const TEMPLATE = `
    <div class="h-[600px] overflow-auto bg-muted/30 rounded-xl border">
        <ui-kanban
            [columns]="columns" [cards]="cards" [locale]="locale" [rtl]="rtl"
            [haveLabels]="haveLabels" [haveAssignees]="haveAssignees"
            [assigneeOptions]="assigneeOptions" [searchTerm]="searchTerm" [class]="class" />
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every simple-mode input is wired to the Controls panel. */
export const Playground: Story = {
    args: { columns: defaultColumns, cards: defaultCards },
    render,
};

export const Default: Story = {
    render: () => ({
        props: {
            columns: defaultColumns,
            cards: defaultCards,
        },
        template: `
            <div class="h-[600px] overflow-auto bg-muted/30 rounded-xl border">
                <ui-kanban [columns]="columns" [cards]="cards" />
            </div>
        `,
    }),
};

export const CustomMode: Story = {
    render: () => ({
        template: `
            <div class="h-[600px] overflow-auto bg-muted/30 rounded-xl border">
                <ui-kanban>
                    <ui-kanban-column columnId="todo" [collapsible]="false">
                        <ui-kanban-column-header>
                            <div class="flex items-center gap-2 w-full">
                                <span class="h-2 w-2 rounded-full bg-slate-400"></span>
                                <h3 class="text-sm font-semibold">To Do</h3>
                                <span class="ml-auto text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-muted-foreground">2</span>
                            </div>
                        </ui-kanban-column-header>

                        <ui-kanban-card cardId="c1">
                            <ui-kanban-card-content>
                                <div class="space-y-2">
                                    <div class="flex items-center gap-1.5">
                                        <span class="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">Research</span>
                                    </div>
                                    <p class="text-sm font-semibold">Competitor analysis report</p>
                                    <p class="text-xs text-muted-foreground line-clamp-2">
                                        Evaluate top 5 competitors and summarize findings in a shareable doc.
                                    </p>
                                    <div class="flex items-center gap-1 pt-1">
                                        <span class="text-xs text-muted-foreground">📅 Mar 10</span>
                                    </div>
                                </div>
                            </ui-kanban-card-content>
                        </ui-kanban-card>

                        <ui-kanban-card cardId="c2">
                            <ui-kanban-card-content>
                                <div class="space-y-2">
                                    <div class="flex items-center gap-1.5">
                                        <span class="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded font-medium">Strategy</span>
                                    </div>
                                    <p class="text-sm font-semibold">Q2 roadmap planning</p>
                                    <p class="text-xs text-muted-foreground line-clamp-2">
                                        Align engineering, design, and product on key milestones for Q2.
                                    </p>
                                    <div class="flex items-center gap-1 pt-1">
                                        <span class="text-xs text-muted-foreground">📅 Mar 15</span>
                                    </div>
                                </div>
                            </ui-kanban-card-content>
                        </ui-kanban-card>
                    </ui-kanban-column>

                    <ui-kanban-column columnId="active" [collapsible]="false">
                        <ui-kanban-column-header>
                            <div class="flex items-center gap-2 w-full">
                                <span class="h-2 w-2 rounded-full bg-blue-500"></span>
                                <h3 class="text-sm font-semibold">Active</h3>
                                <span class="ml-auto text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">1</span>
                            </div>
                        </ui-kanban-column-header>

                        <ui-kanban-card cardId="c3">
                            <ui-kanban-card-content>
                                <div class="space-y-2">
                                    <div class="flex items-center gap-1.5">
                                        <span class="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">Engineering</span>
                                        <span class="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">Urgent</span>
                                    </div>
                                    <p class="text-sm font-semibold">Fix production memory leak</p>
                                    <p class="text-xs text-muted-foreground">Detected in APM. Affects 12% of sessions.</p>
                                    <div class="flex items-center gap-2 pt-1">
                                        <div class="flex -space-x-1">
                                            <div class="h-5 w-5 rounded-full bg-blue-500 border-2 border-background flex items-center justify-center text-[9px] text-white font-bold">C</div>
                                            <div class="h-5 w-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center text-[9px] text-white font-bold">D</div>
                                        </div>
                                        <span class="text-xs text-muted-foreground ml-auto">📅 Mar 8</span>
                                    </div>
                                </div>
                            </ui-kanban-card-content>
                        </ui-kanban-card>
                    </ui-kanban-column>

                    <ui-kanban-column columnId="complete" [collapsible]="false">
                        <ui-kanban-column-header>
                            <div class="flex items-center gap-2 w-full">
                                <span class="h-2 w-2 rounded-full bg-green-500"></span>
                                <h3 class="text-sm font-semibold">Complete</h3>
                                <span class="ml-auto text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">✓ 1</span>
                            </div>
                        </ui-kanban-column-header>

                        <ui-kanban-card cardId="c4">
                            <ui-kanban-card-content>
                                <div class="space-y-2 opacity-75">
                                    <p class="text-sm font-semibold line-through text-muted-foreground">Onboarding flow redesign</p>
                                    <p class="text-xs text-muted-foreground">Shipped to 100% of new users. +18% activation rate.</p>
                                    <div class="flex items-center gap-1 pt-1">
                                        <span class="text-xs text-green-600 dark:text-green-400 font-medium">✓ Completed Mar 5</span>
                                    </div>
                                </div>
                            </ui-kanban-card-content>
                        </ui-kanban-card>
                    </ui-kanban-column>
                </ui-kanban>
            </div>
        `,
    }),
};

export const WithWipLimits: Story = {
    render: () => ({
        props: {
            columns: [
                { id: 'todo', title: 'To Do', order: 0, wipLimit: 4 },
                { id: 'doing', title: 'Doing', order: 1, wipLimit: 2 },
                { id: 'blocked', title: 'Blocked', order: 2, wipLimit: 1 },
                { id: 'done', title: 'Done', order: 3 },
            ] as KanbanColumn[],
            cards: [
                {
                    id: 'w1', columnId: 'todo', title: 'Write unit tests for auth module',
                    priority: 'medium', labels: [{ text: 'Testing', color: '#8b5cf6' }],
                    assignees: [{ name: 'Alice Chen' }], order: 0,
                },
                {
                    id: 'w2', columnId: 'todo', title: 'Update API documentation',
                    priority: 'low', labels: [{ text: 'Docs', color: '#f97316' }],
                    assignees: [{ name: 'Bob Kim' }], order: 1,
                },
                {
                    id: 'w3', columnId: 'todo', title: 'Integrate payment gateway',
                    description: 'Stripe v3 integration with webhook support.',
                    priority: 'high', labels: [{ text: 'Backend', color: '#ef4444' }],
                    order: 2,
                },
                {
                    id: 'w4', columnId: 'doing', title: 'Dashboard analytics charts',
                    description: 'Bar, line, and pie charts for the main dashboard.',
                    priority: 'high', labels: [{ text: 'Frontend', color: '#3b82f6' }],
                    assignees: [{ name: 'Carol White' }], order: 0,
                },
                {
                    id: 'w5', columnId: 'doing', title: 'Mobile responsive fixes',
                    description: 'Address layout issues on viewport < 375px.',
                    priority: 'medium', labels: [{ text: 'CSS', color: '#ec4899' }],
                    assignees: [{ name: 'Dave Jones' }, { name: 'Eve Martinez' }], order: 1,
                },
                {
                    id: 'w6', columnId: 'doing', title: 'Refactor data fetching layer',
                    description: 'Move to Angular resource API for improved SSR support.',
                    priority: 'urgent', labels: [{ text: 'Refactor', color: '#6366f1' }],
                    assignees: [{ name: 'Frank Lee' }], order: 2,
                },
                {
                    id: 'w7', columnId: 'blocked', title: 'Third-party SSO integration',
                    description: 'Blocked by legal review of data processing agreement.',
                    priority: 'urgent', labels: [{ text: 'Auth', color: '#ef4444' }, { text: 'Blocked', color: '#6b7280' }],
                    assignees: [{ name: 'Alice Chen' }], order: 0,
                },
                {
                    id: 'w8', columnId: 'done', title: 'Set up staging environment',
                    priority: 'medium', labels: [{ text: 'Infra', color: '#10b981' }],
                    order: 0,
                },
            ] as KanbanCard[],
        },
        template: `
            <div class="space-y-3">
                <div class="flex items-center gap-3 px-4 pt-4">
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span class="w-3 h-3 rounded-sm border border-destructive/50 bg-destructive/10 inline-block"></span>
                        Column exceeding WIP limit shown in red
                    </div>
                </div>
                <div class="h-[540px] overflow-auto bg-muted/30 rounded-xl border">
                    <ui-kanban [columns]="columns" [cards]="cards" />
                </div>
            </div>
        `,
    }),
};

export const DragInteraction: Story = {
    render: () => ({
        props: {
            columns: defaultColumns,
            cards: defaultCards,
        },
        template: `
            <div class="space-y-3">
                <div class="flex items-center gap-3 px-4 pt-4">
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div class="flex items-center w-8">
                            <div class="h-1.5 w-1.5 rounded-full bg-primary shrink-0"></div>
                            <div class="h-[2px] bg-primary rounded-full flex-1"></div>
                            <div class="h-1.5 w-1.5 rounded-full bg-primary shrink-0"></div>
                        </div>
                        Drop indicator appears between cards during drag
                    </div>
                </div>
                <div class="h-[600px] overflow-auto bg-muted/30 rounded-xl border">
                    <ui-kanban [columns]="columns" [cards]="cards" />
                </div>
            </div>
        `,
    }),
};

export const WithContextMenus: Story = {
    render: () => ({
        props: {
            columns: defaultColumns,
            cards: defaultCards,
        },
        template: `
            <div class="space-y-3">
                <div class="space-y-2 px-4 pt-4">
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span class="font-medium text-foreground">Right-click</span> a card to edit, duplicate, move, set priority, or delete it.
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span class="font-medium text-foreground">Right-click</span> a column header to add a card, rename, set WIP limit, reorder, or delete the column.
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span class="font-medium text-foreground">Right-click</span> the board background to add a new column.
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span class="font-medium text-foreground">Ctrl+Z</span> to undo, <span class="font-medium text-foreground">Ctrl+Shift+Z</span> to redo.
                    </div>
                </div>
                <div class="h-[600px] overflow-auto bg-muted/30 rounded-xl border">
                    <ui-kanban [columns]="columns" [cards]="cards" />
                </div>
            </div>
        `,
    }),
};

export const WipLimitsAndLabelsToggle: Story = {
    args: { columns: defaultColumns, cards: defaultCards, haveLabels: false, haveAssignees: false },
    render,
};

export const SearchFiltered: Story = {
    args: { columns: defaultColumns, cards: defaultCards, searchTerm: 'audit' },
    render,
};

export const RtlHebrewLocale: Story = {
    args: { columns: defaultColumns, cards: defaultCards, locale: 'he' },
    render,
};

export const FullFeatured: Story = {
    render: () => ({
        props: {
            columns: [
                { id: 'backlog', title: 'Backlog', order: 0, wipLimit: 5 },
                { id: 'todo', title: 'To Do', order: 1, wipLimit: 4 },
                { id: 'in-progress', title: 'In Progress', order: 2, wipLimit: 3 },
                { id: 'review', title: 'In Review', order: 3, wipLimit: 2 },
                { id: 'done', title: 'Done', order: 4 },
            ] as KanbanColumn[],
            cards: [
                ...defaultCards,
                {
                    id: 'card-7',
                    columnId: 'backlog',
                    title: 'Migrate to standalone components',
                    description: 'Remove all NgModule usage and migrate to fully standalone Angular components.',
                    priority: 'medium',
                    labels: [{ text: 'Refactor', color: '#6366f1' }, { text: 'Angular', color: '#ef4444' }],
                    assignees: [{ name: 'Bob Kim' }, { name: 'Carol White' }],
                    order: 2,
                },
                {
                    id: 'card-8',
                    columnId: 'review',
                    title: 'End-to-end test coverage',
                    description: 'Write Playwright tests for all critical user flows.',
                    priority: 'high',
                    labels: [{ text: 'Testing', color: '#8b5cf6' }],
                    assignees: [{ name: 'Eve Martinez' }],
                    order: 1,
                },
                {
                    id: 'card-9',
                    columnId: 'done',
                    title: 'Dark mode support',
                    description: 'Full dark mode with system preference detection.',
                    priority: 'medium',
                    labels: [{ text: 'Feature', color: '#8b5cf6' }, { text: 'Design', color: '#ec4899' }],
                    order: 1,
                },
            ] as KanbanCard[],
            onCardAdded: (_event: KanbanCardAddEvent) => { /* handled by parent */ },
            onCardUpdated: (_event: KanbanCard) => { /* handled by parent */ },
            onCardDeleted: (_id: string) => { /* handled by parent */ },
            onColumnAdded: (_event: Omit<KanbanColumn, 'id'>) => { /* handled by parent */ },
            onColumnUpdated: (_event: KanbanColumn) => { /* handled by parent */ },
            onColumnDeleted: (_event: KanbanColumnDeleteEvent) => { /* handled by parent */ },
            onHistoryChange: (_state: KanbanHistoryState) => { /* handled by parent */ },
        },
        template: `
            <div class="space-y-3">
                <div class="space-y-2 px-4 pt-4">
                    <p class="text-sm text-muted-foreground">
                        Full-featured board with WIP limits, context menus, card CRUD, column management, and undo/redo.
                        Open your browser console to see emitted events.
                    </p>
                </div>
                <div class="h-[650px] overflow-auto bg-muted/30 rounded-xl border">
                    <ui-kanban
                        [columns]="columns"
                        [cards]="cards"
                        (cardAdded)="onCardAdded($event)"
                        (cardUpdated)="onCardUpdated($event)"
                        (cardDeleted)="onCardDeleted($event)"
                        (columnAdded)="onColumnAdded($event)"
                        (columnUpdated)="onColumnUpdated($event)"
                        (columnDeleted)="onColumnDeleted($event)"
                        (historyChange)="onHistoryChange($event)" />
                </div>
            </div>
        `,
    }),
};
