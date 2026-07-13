import { JsonPipe } from '@angular/common';
import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ContextMenuAttachDirective, type ContextMenuEvent } from './context-menu-attach.directive';
import {
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuSeparatorComponent,
  ContextMenuShortcutComponent,
} from './context-menu';

// ContextMenuAttachDirective has no `component` metadata target since it's a
// directive; every input is still exposed via argTypes so the Controls panel
// drives it live.
const meta: Meta = {
    title: 'UI/Context Menu Attach',
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                JsonPipe,
                ContextMenuAttachDirective,
                ContextMenuComponent,
                ContextMenuContentComponent,
                ContextMenuItemComponent,
                ContextMenuSeparatorComponent,
                ContextMenuShortcutComponent,
            ],
        }),
    ],
    argTypes: {
        uiContextMenuAttach: {
            control: false,
            description:
                'Required. The <ui-context-menu> instance to open on right-click — pass a template reference (e.g. #menu). One menu can be shared by many hosts.',
        },
        contextMenuData: {
            control: 'object',
            description:
                'Required. Arbitrary data bound to this host. It is echoed back as `item` in the emitted ContextMenuEvent<T>.',
        },
        disabled: {
            control: 'boolean',
            description:
                'When true the directive ignores right-clicks entirely — the native browser context menu opens instead.',
        },
        contextMenuTriggered: {
            action: 'contextMenuTriggered',
            description:
                'Emits ContextMenuEvent<T> = { event: MouseEvent; item: T; index?: number } just before the menu is shown at the cursor.',
        },
    },
    args: {
        contextMenuData: { id: 'file-1', name: 'quarterly-report.pdf' },
        disabled: false,
    },
};

export default meta;
type Story = StoryObj;

const MENU = `
  <ui-context-menu #menu>
    <ui-context-menu-content class="w-52 max-w-[calc(100vw-2rem)]">
      <ui-context-menu-item>
        Open
        <ui-context-menu-shortcut>&#8984;O</ui-context-menu-shortcut>
      </ui-context-menu-item>
      <ui-context-menu-item>Rename</ui-context-menu-item>
      <ui-context-menu-item>Duplicate</ui-context-menu-item>
      <ui-context-menu-separator />
      <ui-context-menu-item variant="destructive">Delete</ui-context-menu-item>
    </ui-context-menu-content>
  </ui-context-menu>
`;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="p-8 sm:p-12">
                ${MENU}
                <div
                    [uiContextMenuAttach]="menu"
                    [contextMenuData]="contextMenuData"
                    [disabled]="disabled"
                    (contextMenuTriggered)="contextMenuTriggered($event)"
                    class="flex h-[150px] w-full sm:w-[320px] items-center justify-center rounded-lg border-2 border-dashed bg-muted/40 text-sm text-muted-foreground select-none"
                >
                    Right-click me
                </div>
            </div>
        `,
    }),
};

/** One shared menu attached to several cards, each binding its own data. */
export const AttachedToCards: Story = {
    render: (args) => ({
        props: {
            ...args,
            cards: [
                { id: 'c1', name: 'Quarterly report' },
                { id: 'c2', name: 'Design system' },
                { id: 'c3', name: 'Release notes' },
            ],
        },
        template: `
            <div class="p-8 sm:p-12">
                ${MENU}
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    @for (card of cards; track card.id) {
                        <div
                            [uiContextMenuAttach]="menu"
                            [contextMenuData]="card"
                            (contextMenuTriggered)="contextMenuTriggered($event)"
                            class="rounded-xl border bg-card p-4 shadow-sm select-none"
                        >
                            <p class="font-medium truncate">{{ card.name }}</p>
                            <p class="mt-1 text-xs text-muted-foreground">Right-click the card</p>
                        </div>
                    }
                </div>
            </div>
        `,
    }),
};

/** The host can be any element — here the image itself. */
export const AttachedToImage: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="p-8 sm:p-12">
                ${MENU}
                <img
                    src="https://picsum.photos/id/1015/400/300"
                    alt="Gallery photo"
                    [uiContextMenuAttach]="menu"
                    [contextMenuData]="{ id: 'photo-1', name: 'mountain.jpg' }"
                    (contextMenuTriggered)="contextMenuTriggered($event)"
                    class="h-48 w-full sm:w-[400px] rounded-xl border object-cover"
                />
            </div>
        `,
    }),
};

/** The most common host: a repeated list row bound to its row model. */
export const AttachedToListRows: Story = {
    render: (args) => ({
        props: {
            ...args,
            rows: [
                { id: 'r1', name: 'Ada Lovelace', role: 'Engineering' },
                { id: 'r2', name: 'Grace Hopper', role: 'Compilers' },
                { id: 'r3', name: 'Alan Turing', role: 'Research' },
            ],
        },
        template: `
            <div class="p-8 sm:p-12">
                ${MENU}
                <ul class="divide-y rounded-xl border w-full sm:w-[420px]">
                    @for (row of rows; track row.id) {
                        <li
                            [uiContextMenuAttach]="menu"
                            [contextMenuData]="row"
                            (contextMenuTriggered)="contextMenuTriggered($event)"
                            class="flex flex-wrap items-center justify-between gap-2 p-3 select-none"
                        >
                            <span class="font-medium truncate">{{ row.name }}</span>
                            <span class="text-xs text-muted-foreground">{{ row.role }}</span>
                        </li>
                    }
                </ul>
            </div>
        `,
    }),
};

/**
 * The emitted ContextMenuEvent<T> payload. `item` is whatever was bound to
 * [contextMenuData]; `event` is the raw MouseEvent; `index` is optional and is
 * only populated by the list-aware integrations (tree / table directives).
 */
export const EventPayload: Story = {
    render: (args) => {
        const state: { last: unknown } = { last: null };
        const onTriggered = (payload: ContextMenuEvent<unknown>): void => {
            state.last = {
                item: payload.item,
                index: payload.index ?? null,
                x: Math.round(payload.event.clientX),
                y: Math.round(payload.event.clientY),
            };
        };
        return {
        props: { ...args, state, onTriggered },
        template: `
            <div class="p-8 sm:p-12 space-y-4">
                ${MENU}
                <div
                    [uiContextMenuAttach]="menu"
                    [contextMenuData]="contextMenuData"
                    (contextMenuTriggered)="onTriggered($event)"
                    class="flex h-[120px] w-full sm:w-[320px] items-center justify-center rounded-lg border-2 border-dashed bg-muted/40 text-sm text-muted-foreground select-none"
                >
                    Right-click to inspect the payload
                </div>
                <pre class="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs">{{ state.last | json }}</pre>
            </div>
        `,
        };
    },
};

/**
 * Touch devices: the directive listens for `contextmenu` only — it does NOT
 * implement long-press. Pair it with a visible actions button that calls
 * `menu.show(x, y)` so touch users can reach the same menu (CLAUDE.md §6).
 */
export const TouchFallback: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="p-8 sm:p-12">
                ${MENU}
                <div
                    [uiContextMenuAttach]="menu"
                    [contextMenuData]="contextMenuData"
                    (contextMenuTriggered)="contextMenuTriggered($event)"
                    class="flex items-center justify-between gap-2 rounded-xl border bg-card p-4 shadow-sm w-full sm:w-[360px] select-none"
                >
                    <div class="min-w-0">
                        <p class="font-medium truncate">quarterly-report.pdf</p>
                        <p class="mt-1 text-xs text-muted-foreground">Right-click, or use the button</p>
                    </div>
                    <button
                        type="button"
                        aria-label="More actions"
                        class="h-11 w-11 shrink-0 rounded-md border hover:bg-accent"
                        (click)="menu.show($event.clientX, $event.clientY)"
                    >
                        &#8942;
                    </button>
                </div>
            </div>
        `,
    }),
};

/** With [disabled]="true" the native browser context menu opens instead. */
export const Disabled: Story = {
    args: { disabled: true },
    render: (args) => ({
        props: args,
        template: `
            <div class="p-8 sm:p-12">
                ${MENU}
                <div
                    [uiContextMenuAttach]="menu"
                    [contextMenuData]="contextMenuData"
                    [disabled]="disabled"
                    (contextMenuTriggered)="contextMenuTriggered($event)"
                    class="flex h-[150px] w-full sm:w-[320px] items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 text-sm text-muted-foreground select-none"
                >
                    Disabled — the browser menu opens here
                </div>
            </div>
        `,
    }),
};
