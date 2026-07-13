import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TreeComponent, TreeItemComponent, TreeLabelComponent, TreeIconComponent, TreeNode } from './tree';
import {
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuLabelComponent,
    ContextMenuSeparatorComponent,
    ContextMenuShortcutComponent,
} from './context-menu';
import { TreeContextMenuDirective, TreeContextMenuEvent } from './tree-context-menu.directive';

/**
 * Shape of the node data the directive extracts from the DOM and hands to both
 * `nodeContextMenu` and `ContextMenuComponent.data()`.
 *
 * Note: `key` is read from the tree item's `data-key` attribute. The current
 * `ui-tree-item` template does not render that attribute, so `key` is
 * `undefined` in practice — identify nodes by `label` or by `element`.
 */
interface TreeContextNode {
    key?: string;
    label: string;
    expanded: boolean;
    selected: boolean;
    element: HTMLElement;
}

// TreeContextMenuDirective is a directive, so there is no `component` target;
// every input is still exposed via argTypes so the Controls panel drives it live.
const meta: Meta = {
    title: 'UI/Tree Context Menu',
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                TreeComponent,
                TreeItemComponent,
                TreeLabelComponent,
                TreeIconComponent,
                ContextMenuComponent,
                ContextMenuContentComponent,
                ContextMenuItemComponent,
                ContextMenuLabelComponent,
                ContextMenuSeparatorComponent,
                ContextMenuShortcutComponent,
                TreeContextMenuDirective,
            ],
        }),
    ],
    argTypes: {
        uiTreeContextMenu: {
            control: false,
            description:
                'Required. The `ui-context-menu` instance to open when a tree item is right-clicked. Pass a template reference (e.g. `[uiTreeContextMenu]="menu"` with `<ui-context-menu #menu>`). The directive calls `menu.show(x, y, node)`, so the menu content can read the hit node via `menu.data()`.',
        },
        contextMenuDisabled: {
            control: 'boolean',
            description:
                'When `true`, right-clicking a tree item does nothing — no menu, no event, and the browser default context menu is left intact.',
        },
        nodeContextMenu: {
            control: false,
            action: 'nodeContextMenu',
            description:
                'Emits `TreeContextMenuEvent<T>` — `{ node, event }` — for the tree item that was hit. `node` carries `{ key, label, expanded, selected, element }` extracted from the item DOM; `event` is the original `MouseEvent` (already `preventDefault()`-ed).',
        },
    },
    args: {
        contextMenuDisabled: false,
    },
    parameters: {
        docs: {
            description: {
                component: [
                    '`TreeContextMenuDirective` (`ui-tree[uiTreeContextMenu]`) wires a `ui-context-menu` to every node of a `ui-tree`.',
                    '',
                    'It listens for `contextmenu` on the tree host, walks up from the event target to the nearest `[data-slot="tree-item"]`, extracts that node\'s data from the DOM, emits `nodeContextMenu`, and opens the menu at the cursor.',
                    '',
                    '**Touch:** the directive is right-click only — it has no built-in long-press. On touch-only devices nothing opens the menu. Until long-press lands in the directive, add a touch fallback yourself with `onLongPress()` from `lib/touch.ts` and call `menu.show(touch.clientX, touch.clientY, node)`. See the demo page for a copy-paste implementation.',
                ].join('\n'),
            },
        },
    },
};

export default meta;
type Story = StoryObj;

const FILE_TREE = `
    <ui-tree-item value="src">
        <ui-tree-label><ui-tree-icon>📁</ui-tree-icon>src</ui-tree-label>
        <ui-tree-item value="app.component.ts">
            <ui-tree-label><ui-tree-icon>📄</ui-tree-icon>app.component.ts</ui-tree-label>
        </ui-tree-item>
        <ui-tree-item value="main.ts">
            <ui-tree-label><ui-tree-icon>📄</ui-tree-icon>main.ts</ui-tree-label>
        </ui-tree-item>
    </ui-tree-item>
    <ui-tree-item value="assets">
        <ui-tree-label><ui-tree-icon>📁</ui-tree-icon>assets</ui-tree-label>
        <ui-tree-item value="logo.svg">
            <ui-tree-label><ui-tree-icon>🖼️</ui-tree-icon>logo.svg</ui-tree-label>
        </ui-tree-item>
    </ui-tree-item>
    <ui-tree-item value="readme">
        <ui-tree-label><ui-tree-icon>📄</ui-tree-icon>README.md</ui-tree-label>
    </ui-tree-item>
`;

const HINT = `
    <p class="text-xs text-muted-foreground">
        Right-click a node to open its menu. Touch devices: the directive has no long-press —
        see the docs above for the <code>onLongPress()</code> fallback.
    </p>
`;

/** Reusable mutable log holder — Angular re-renders it after each output event. */
interface StoryLog {
    entries: string[];
    last: TreeContextNode | null;
}

const makeLog = (): StoryLog => ({ entries: [], last: null });

const isFolder = (node: TreeContextNode | null): boolean =>
    !!node?.element?.querySelector('[role="group"]');

const nodeName = (node: TreeContextNode | null): string =>
    (node?.label ?? '').replace(/\s+/g, ' ').trim();

const pushEntry = (log: StoryLog, action: string, node: TreeContextNode | null): void => {
    log.entries = [`${action} → ${nodeName(node)}`, ...log.entries].slice(0, 8);
};

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => {
        const log = makeLog();
        return {
        props: {
            ...args,
            log,
            nodeName,
            onEvent: (event: TreeContextMenuEvent<TreeContextNode>): void => {
                log.last = event.node;
            },
            onAction: (action: string, node: TreeContextNode | null): void => pushEntry(log, action, node),
        },
        template: `
            <div class="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-start">
                <div class="w-full md:w-72 rounded-md border p-4">
                    <ui-tree
                        selectable="single"
                        [uiTreeContextMenu]="menu"
                        [contextMenuDisabled]="contextMenuDisabled"
                        (nodeContextMenu)="onEvent($event)">
                        ${FILE_TREE}
                    </ui-tree>

                    <ui-context-menu #menu>
                        <ui-context-menu-content class="w-56 max-w-[calc(100vw-2rem)]">
                            <ui-context-menu-item (click)="onAction('Open', menu.data())">
                                Open <ui-context-menu-shortcut>⏎</ui-context-menu-shortcut>
                            </ui-context-menu-item>
                            <ui-context-menu-item (click)="onAction('Rename', menu.data())">
                                Rename <ui-context-menu-shortcut>F2</ui-context-menu-shortcut>
                            </ui-context-menu-item>
                            <ui-context-menu-separator />
                            <ui-context-menu-item variant="destructive" (click)="onAction('Delete', menu.data())">
                                Delete <ui-context-menu-shortcut>⌘⌫</ui-context-menu-shortcut>
                            </ui-context-menu-item>
                        </ui-context-menu-content>
                    </ui-context-menu>
                </div>

                <div class="w-full md:flex-1 space-y-3 text-sm">
                    ${HINT}
                    <div class="rounded-md border p-4">
                        <p class="font-medium mb-2">Last TreeContextMenuEvent.node</p>
                        @if (log.last) {
                            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                <dt class="text-muted-foreground">label</dt><dd class="truncate">{{ nodeName(log.last) }}</dd>
                                <dt class="text-muted-foreground">key</dt><dd>{{ log.last.key ?? 'undefined' }}</dd>
                                <dt class="text-muted-foreground">expanded</dt><dd>{{ log.last.expanded }}</dd>
                                <dt class="text-muted-foreground">selected</dt><dd>{{ log.last.selected }}</dd>
                            </dl>
                        } @else {
                            <p class="text-xs text-muted-foreground">No node hit yet.</p>
                        }
                    </div>
                    <div class="rounded-md border p-4">
                        <p class="font-medium mb-2">Actions</p>
                        @if (log.entries.length) {
                            <ul class="space-y-1 text-xs">
                                @for (entry of log.entries; track $index) {
                                    <li class="truncate">{{ entry }}</li>
                                }
                            </ul>
                        } @else {
                            <p class="text-xs text-muted-foreground">Pick a menu item.</p>
                        }
                    </div>
                </div>
            </div>
        `,
        };
    },
};

/** Per-node actions: the menu item reads the hit node from `menu.data()`. */
export const PerNodeActions: Story = {
    render: () => {
        const log = makeLog();
        return {
        props: {
            log,
            nodeName,
            onAction: (action: string, node: TreeContextNode | null): void => pushEntry(log, action, node),
        },
        template: `
            <div class="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-start">
                <div class="w-full md:w-72 rounded-md border p-4">
                    <ui-tree [uiTreeContextMenu]="menu">
                        ${FILE_TREE}
                    </ui-tree>
                    <ui-context-menu #menu>
                        <ui-context-menu-content class="w-56 max-w-[calc(100vw-2rem)]">
                            <ui-context-menu-label>{{ nodeName(menu.data()) || 'Node' }}</ui-context-menu-label>
                            <ui-context-menu-separator />
                            <ui-context-menu-item (click)="onAction('Copy path', menu.data())">Copy path</ui-context-menu-item>
                            <ui-context-menu-item (click)="onAction('Duplicate', menu.data())">Duplicate</ui-context-menu-item>
                            <ui-context-menu-item variant="destructive" (click)="onAction('Delete', menu.data())">Delete</ui-context-menu-item>
                        </ui-context-menu-content>
                    </ui-context-menu>
                </div>
                <ul class="w-full md:flex-1 rounded-md border p-4 space-y-1 text-xs">
                    @for (entry of log.entries; track $index) {
                        <li class="truncate">{{ entry }}</li>
                    } @empty {
                        <li class="text-muted-foreground">Right-click a node, then pick an action.</li>
                    }
                </ul>
            </div>
        `,
        };
    },
};

interface PayloadState {
    node: TreeContextNode | null;
    x: number;
    y: number;
}

/** The full `TreeContextMenuEvent` payload — node data plus the original `MouseEvent`. */
export const EventPayload: Story = {
    render: () => {
        const state: PayloadState = { node: null, x: 0, y: 0 };
        return {
        props: {
            state,
            nodeName,
            onEvent: (event: TreeContextMenuEvent<TreeContextNode>): void => {
                state.node = event.node;
                state.x = event.event.clientX;
                state.y = event.event.clientY;
            },
        },
        template: `
            <div class="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-start">
                <div class="w-full md:w-72 rounded-md border p-4">
                    <ui-tree selectable="multiple" [uiTreeContextMenu]="menu" (nodeContextMenu)="onEvent($event)">
                        ${FILE_TREE}
                    </ui-tree>
                    <ui-context-menu #menu>
                        <ui-context-menu-content class="w-48 max-w-[calc(100vw-2rem)]">
                            <ui-context-menu-item>Inspect</ui-context-menu-item>
                        </ui-context-menu-content>
                    </ui-context-menu>
                </div>
                <div class="w-full md:flex-1 rounded-md border p-4 text-xs">
                    <p class="font-medium mb-2 text-sm">TreeContextMenuEvent</p>
                    @if (state.node) {
                        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                            <dt class="text-muted-foreground">node.key</dt><dd>{{ state.node.key ?? 'undefined (tree-item renders no data-key)' }}</dd>
                            <dt class="text-muted-foreground">node.label</dt><dd class="truncate">{{ nodeName(state.node) }}</dd>
                            <dt class="text-muted-foreground">node.expanded</dt><dd>{{ state.node.expanded }}</dd>
                            <dt class="text-muted-foreground">node.selected</dt><dd>{{ state.node.selected }}</dd>
                            <dt class="text-muted-foreground">node.element</dt><dd>HTMLElement</dd>
                            <dt class="text-muted-foreground">event.clientX</dt><dd>{{ state.x }}</dd>
                            <dt class="text-muted-foreground">event.clientY</dt><dd>{{ state.y }}</dd>
                        </dl>
                    } @else {
                        <p class="text-muted-foreground">Right-click a node to see the emitted event.</p>
                    }
                </div>
            </div>
        `,
        };
    },
};

/** Folder vs leaf: one menu, items shown conditionally from the hit node. */
export const FolderVsLeafMenu: Story = {
    render: () => {
        const log = makeLog();
        return {
        props: {
            log,
            nodeName,
            isFolder,
            onAction: (action: string, node: TreeContextNode | null): void => pushEntry(log, action, node),
        },
        template: `
            <div class="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-start">
                <div class="w-full md:w-72 rounded-md border p-4">
                    <ui-tree [uiTreeContextMenu]="menu">
                        ${FILE_TREE}
                    </ui-tree>
                    <ui-context-menu #menu>
                        <ui-context-menu-content class="w-56 max-w-[calc(100vw-2rem)]">
                            @if (isFolder(menu.data())) {
                                <ui-context-menu-label>Folder</ui-context-menu-label>
                                <ui-context-menu-separator />
                                <ui-context-menu-item (click)="onAction('New file', menu.data())">New file</ui-context-menu-item>
                                <ui-context-menu-item (click)="onAction('New folder', menu.data())">New folder</ui-context-menu-item>
                            } @else {
                                <ui-context-menu-label>File</ui-context-menu-label>
                                <ui-context-menu-separator />
                                <ui-context-menu-item (click)="onAction('Open', menu.data())">Open</ui-context-menu-item>
                                <ui-context-menu-item (click)="onAction('Download', menu.data())">Download</ui-context-menu-item>
                            }
                            <ui-context-menu-separator />
                            <ui-context-menu-item variant="destructive" (click)="onAction('Delete', menu.data())">Delete</ui-context-menu-item>
                        </ui-context-menu-content>
                    </ui-context-menu>
                </div>
                <ul class="w-full md:flex-1 rounded-md border p-4 space-y-1 text-xs">
                    @for (entry of log.entries; track $index) {
                        <li class="truncate">{{ entry }}</li>
                    } @empty {
                        <li class="text-muted-foreground">Right-click a folder and a file — the menu differs.</li>
                    }
                </ul>
            </div>
        `,
        };
    },
};

/** `contextMenuDisabled` — no menu, no event, browser default menu restored. */
export const Disabled: Story = {
    args: { contextMenuDisabled: true },
    render: (args) => ({
        props: args,
        template: `
            <div class="p-4 sm:p-6 space-y-3">
                <div class="w-full sm:w-72 rounded-md border p-4">
                    <ui-tree [uiTreeContextMenu]="menu" [contextMenuDisabled]="contextMenuDisabled">
                        ${FILE_TREE}
                    </ui-tree>
                    <ui-context-menu #menu>
                        <ui-context-menu-content class="w-48 max-w-[calc(100vw-2rem)]">
                            <ui-context-menu-item>Never shown</ui-context-menu-item>
                        </ui-context-menu-content>
                    </ui-context-menu>
                </div>
                <p class="text-xs text-muted-foreground">Right-click yields the browser's own menu.</p>
            </div>
        `,
    }),
};

const DATA_NODES: TreeNode[] = [
    {
        key: 'src',
        label: 'src',
        icon: '📁',
        children: [
            { key: 'app', label: 'app.component.ts', icon: '📄' },
            { key: 'main', label: 'main.ts', icon: '📄' },
        ],
    },
    { key: 'readme', label: 'README.md', icon: '📄' },
];

/** The directive works the same on a data-driven `[data]` tree. */
export const DataDrivenTree: Story = {
    render: () => {
        const picked = { label: '' };
        return {
        props: {
            nodes: DATA_NODES,
            nodeName,
            picked,
            onEvent: (event: TreeContextMenuEvent<TreeContextNode>): void => {
                picked.label = nodeName(event.node);
            },
        },
        template: `
            <div class="p-4 sm:p-6 space-y-3">
                <div class="w-full sm:w-72 rounded-md border p-4">
                    <ui-tree
                        [data]="nodes"
                        [initialExpandDepth]="1"
                        selectable="single"
                        [uiTreeContextMenu]="menu"
                        (nodeContextMenu)="onEvent($event)">
                    </ui-tree>
                    <ui-context-menu #menu>
                        <ui-context-menu-content class="w-48 max-w-[calc(100vw-2rem)]">
                            <ui-context-menu-item>Open</ui-context-menu-item>
                            <ui-context-menu-item variant="destructive">Delete</ui-context-menu-item>
                        </ui-context-menu-content>
                    </ui-context-menu>
                </div>
                <p class="text-xs text-muted-foreground">Hit node: {{ picked.label || '—' }}</p>
            </div>
        `,
        };
    },
};
