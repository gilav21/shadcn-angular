import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    output,
    effect,
    model,
    ContentChildren,
    QueryList,
    AfterContentInit,
    forwardRef,
    InjectionToken,
    inject,
    viewChild,
    OnDestroy,
    untracked,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { ButtonComponent } from '../button';
import { BadgeComponent } from '../badge';
import {
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSeparatorComponent,
    ContextMenuSubComponent,
    ContextMenuSubTriggerComponent,
    ContextMenuSubContentComponent,
} from '../context-menu';
import { ShortcutBindingService, ShortcutComponentHandle } from '../../lib/shortcut-binding.service';
import { type KanbanLocale, KANBAN_LOCALES } from './kanban-locales';
import { createLocaleBindings, provideComponentLocale, type LocaleInput } from '../../lib/i18n';
import { KanbanColumnComponent } from './sub/kanban-column.component';
import { KanbanCardDialogComponent } from './sub/kanban-card-dialog.component';
import { KanbanColumnDialogComponent } from './sub/kanban-column-dialog.component';
import { KanbanDeleteColumnDialogComponent } from './sub/kanban-delete-column-dialog.component';

// ────────────────────────────────────────────────────────────────
// Data structures
// ────────────────────────────────────────────────────────────────

export interface KanbanColumn {
    id: string;
    title: string;
    wipLimit?: number;
    collapsed?: boolean;
    order: number;
}

export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent';

export type KanbanColumnDialogMode = 'add-column' | 'rename-column' | 'set-wip';

export interface KanbanCard {
    id: string;
    columnId: string;
    title: string;
    description?: string;
    priority?: KanbanPriority;
    labels?: { text: string; color: string }[];
    assignees?: { name: string; avatar?: string }[];
    order: number;
}

export interface KanbanCardMoveEvent {
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    newOrder: number;
    /** Swimlane the card came from. Present only while `swimlaneBy` is set. */
    fromSwimlaneId?: string;
    /** Swimlane the card landed in. Present only while `swimlaneBy` is set. */
    toSwimlaneId?: string;
}

/**
 * How cards are bucketed into swimlanes — the board's optional second axis.
 *
 * A **string** names a property on `KanbanCard`; that is the form that lets the
 * board reassign the lane on a cross-lane drop, since it knows which field to
 * write. A **function** derives a lane from anything (a joined record, a date
 * bucket), but the board cannot invert it, so a cross-lane drop keeps the card
 * in its original lane and it is yours to move via `cardUpdated`.
 */
export type KanbanSwimlaneBy = string | ((card: KanbanCard) => string) | null;

/** One horizontal band of the board, derived from {@link KanbanSwimlaneBy}. */
export interface KanbanSwimlane {
    /** The lane's grouping value. Cards with no value land in the `''` lane. */
    id: string;
    /** Heading text — the `id`, unless `swimlaneLabel` supplies something friendlier. */
    label: string;
    /** Cards in this lane across every column, after the search filter. */
    count: number;
}

export interface KanbanCardAddEvent {
    columnId: string;
    title: string;
    description?: string;
    priority?: KanbanPriority;
    labels?: { text: string; color: string }[];
    assignees?: { name: string; avatar?: string }[];
}

export interface KanbanColumnDeleteEvent {
    columnId: string;
    moveCardsTo?: string;
}

export interface KanbanHistoryState {
    canUndo: boolean;
    canRedo: boolean;
}

interface KanbanHistorySnapshot {
    cards: KanbanCard[];
    columns: KanbanColumn[];
}

// ────────────────────────────────────────────────────────────────
// Injection token for parent-child communication
// ────────────────────────────────────────────────────────────────

export const KANBAN = new InjectionToken<KanbanComponent>('KANBAN');


// ────────────────────────────────────────────────────────────────
// KanbanComponent — main container, state, drag coordination
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        forwardRef(() => KanbanColumnComponent),
        forwardRef(() => KanbanCardDialogComponent),
        forwardRef(() => KanbanColumnDialogComponent),
        forwardRef(() => KanbanDeleteColumnDialogComponent),
        ContextMenuComponent, ContextMenuContentComponent, ContextMenuItemComponent,
        ContextMenuSeparatorComponent, ContextMenuSubComponent,
        ContextMenuSubTriggerComponent, ContextMenuSubContentComponent,
        ButtonComponent,
        BadgeComponent,
    ],
    providers: [
        { provide: KANBAN, useExisting: forwardRef(() => KanbanComponent) },
        provideComponentLocale(() => KanbanComponent),
    ],
    template: `
        <div [dir]="isRtl() ? 'rtl' : 'ltr'">
            @if (hasCustomColumns()) {
                <div [class]="classes()" [attr.data-slot]="'kanban'" (contextmenu)="onBoardContextMenu($event)">
                    <ng-content />
                </div>
            } @else if (hasSwimlanes()) {
                <div class="flex flex-col" [attr.data-slot]="'kanban-swimlanes'" (contextmenu)="onBoardContextMenu($event)">
                    @for (lane of swimlanes(); track lane.id) {
                        <section
                            class="border-b last:border-b-0"
                            [attr.data-slot]="'kanban-swimlane'"
                            [attr.data-swimlane-id]="lane.id"
                            [attr.data-collapsed]="isSwimlaneCollapsed(lane.id) || null"
                        >
                            <button
                                type="button"
                                class="flex w-full flex-wrap items-center gap-2 px-2 sm:px-4 py-2 text-start hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                data-slot="kanban-swimlane-header"
                                [attr.aria-expanded]="!isSwimlaneCollapsed(lane.id)"
                                (click)="toggleSwimlane(lane.id)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                                     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                     stroke-linejoin="round" class="transition-transform shrink-0"
                                     [class.-rotate-90]="isSwimlaneCollapsed(lane.id)">
                                    <path d="m6 9 6 6 6-6" />
                                </svg>
                                <span class="text-sm font-semibold truncate max-w-[160px] sm:max-w-[280px]">{{ lane.label }}</span>
                                <ui-badge [label]="lane.count + ''" variant="secondary" class="text-xs" />
                            </button>
                            @if (!isSwimlaneCollapsed(lane.id)) {
                                <div [class]="classes()" [attr.data-slot]="'kanban'">
                                    @for (col of sortedColumns(); track col.id) {
                                        <ui-kanban-column
                                            [columnId]="col.id"
                                            [swimlaneId]="lane.id"
                                            [title]="col.title"
                                            [wipLimit]="col.wipLimit"
                                            [collapsible]="true"
                                            [locale]="resolvedLocale()"
                                        />
                                    }
                                </div>
                            }
                        </section>
                    }
                </div>
            } @else {
                <div [class]="classes()" [attr.data-slot]="'kanban'" (contextmenu)="onBoardContextMenu($event)">
                    @for (col of sortedColumns(); track col.id) {
                        <ui-kanban-column
                            [columnId]="col.id"
                            [title]="col.title"
                            [wipLimit]="col.wipLimit"
                            [collapsible]="true"
                            [locale]="resolvedLocale()"
                        />
                    }
                </div>
            }

            <!-- Delete Toast (top center) -->
            @if (deleteToastVisible()) {
                <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[420px] px-4"
                     data-slot="kanban-delete-toast">
                    <div class="group pointer-events-auto relative flex w-full items-center justify-between gap-2 overflow-hidden rounded-md border bg-background text-foreground p-4 ltr:pr-6 rtl:pl-6 shadow-lg">
                        <div class="grid gap-1 flex-1">
                            <div class="text-sm font-semibold">{{ resolvedLocale().cardDeleted }}</div>
                            <div class="text-sm opacity-90">"{{ deleteToastCardTitle() }}" {{ resolvedLocale().cardRemovedDescription }}</div>
                        </div>
                        <ui-button variant="outline" size="sm" (clicked)="undoCardDelete()">
                            {{ resolvedLocale().undo }}@if (deleteCountdown() > 0) {
                                <span class="ltr:ml-1 rtl:mr-1">({{ deleteCountdown() }}s)</span>
                            }
                        </ui-button>
                        <button
                            class="absolute ltr:right-1 rtl:left-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                            (click)="dismissDeleteToast()"
                            aria-label="Close"
                        >
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
                            <div
                                class="h-full bg-foreground/30 transition-[width] duration-1000 ease-linear"
                                [style.width.%]="deleteProgressPercent()"
                            ></div>
                        </div>
                    </div>
                </div>
            }

            <!-- Card Context Menu -->
            <ui-context-menu #cardMenu>
                <ui-context-menu-content class="w-52">
                    <ui-context-menu-item (click)="onEditCard(asCard(cardMenu.data()))">
                        {{ resolvedLocale().editCardMenu }}
                    </ui-context-menu-item>
                    <ui-context-menu-item (click)="onDuplicateCard(asCard(cardMenu.data()))">
                        {{ resolvedLocale().duplicateCard }}
                    </ui-context-menu-item>
                    <ui-context-menu-sub>
                        <ui-context-menu-sub-trigger>{{ resolvedLocale().moveTo }}</ui-context-menu-sub-trigger>
                        <ui-context-menu-sub-content>
                            @for (col of sortedColumns(); track col.id) {
                                <ui-context-menu-item
                                    [disabled]="col.id === asCard(cardMenu.data())?.columnId"
                                    (click)="onMoveCardToColumn(asCard(cardMenu.data()), col.id)">
                                    {{ col.title }}
                                </ui-context-menu-item>
                            }
                        </ui-context-menu-sub-content>
                    </ui-context-menu-sub>
                    <ui-context-menu-sub>
                        <ui-context-menu-sub-trigger>{{ resolvedLocale().setPriority }}</ui-context-menu-sub-trigger>
                        <ui-context-menu-sub-content>
                            @for (p of localizedPriorityOptions(); track p.value) {
                                <ui-context-menu-item (click)="onSetCardPriority(asCard(cardMenu.data()), p.value)">
                                    {{ p.label }}
                                </ui-context-menu-item>
                            }
                        </ui-context-menu-sub-content>
                    </ui-context-menu-sub>
                    <ui-context-menu-separator />
                    <ui-context-menu-item variant="destructive" (click)="onDeleteCard(asCard(cardMenu.data()))">
                        {{ resolvedLocale().deleteCardMenu }}
                    </ui-context-menu-item>
                </ui-context-menu-content>
            </ui-context-menu>

            <!-- Column Context Menu -->
            <ui-context-menu #columnMenu>
                <ui-context-menu-content class="w-52">
                    <ui-context-menu-item (click)="onAddCard(asColumn(columnMenu.data())?.id)">
                        {{ resolvedLocale().addCardMenu }}
                    </ui-context-menu-item>
                    <ui-context-menu-separator />
                    <ui-context-menu-item (click)="onRenameColumn(asColumn(columnMenu.data()))">
                        {{ resolvedLocale().renameColumnMenu }}
                    </ui-context-menu-item>
                    <ui-context-menu-item (click)="onSetWipLimit(asColumn(columnMenu.data()))">
                        {{ resolvedLocale().setWipLimitMenu }}
                    </ui-context-menu-item>
                    <ui-context-menu-separator />
                    <ui-context-menu-item
                        [disabled]="isFirstColumn(asColumn(columnMenu.data()))"
                        (click)="onMoveColumnLeft(asColumn(columnMenu.data()))">
                        {{ resolvedLocale().moveLeft }}
                    </ui-context-menu-item>
                    <ui-context-menu-item
                        [disabled]="isLastColumnCheck(asColumn(columnMenu.data()))"
                        (click)="onMoveColumnRight(asColumn(columnMenu.data()))">
                        {{ resolvedLocale().moveRight }}
                    </ui-context-menu-item>
                    <ui-context-menu-separator />
                    <ui-context-menu-item variant="destructive" (click)="onDeleteColumn(asColumn(columnMenu.data()))">
                        {{ resolvedLocale().deleteColumnMenu }}
                    </ui-context-menu-item>
                </ui-context-menu-content>
            </ui-context-menu>

            <!-- Board Context Menu -->
            <ui-context-menu #boardMenu>
                <ui-context-menu-content class="w-44">
                    <ui-context-menu-item (click)="onAddColumn()">{{ resolvedLocale().addColumnMenu }}</ui-context-menu-item>
                </ui-context-menu-content>
            </ui-context-menu>

            <!-- Dialogs -->
            <ui-kanban-card-dialog
                [locale]="resolvedLocale()"
                [haveLabels]="haveLabels()"
                [haveAssignees]="haveAssignees()"
                [assigneeOptions]="assigneeOptions()"
                (submitted)="onCardDialogSubmitted($event)"
            />
            <ui-kanban-column-dialog [locale]="resolvedLocale()" (submitted)="onColumnDialogSubmitted($event)" />
            <ui-kanban-delete-column-dialog [locale]="resolvedLocale()" [columns]="columns()" (confirmed)="onDeleteColumnConfirmed($event)" />
        </div>
    `,
    host: { class: 'block' },
})
export class KanbanComponent implements AfterContentInit, OnDestroy {
    private readonly shortcuts = inject(ShortcutBindingService);

    /** Extra classes merged onto the horizontally scrolling board strip (which already carries `flex gap-3 sm:gap-4 overflow-x-auto p-2 sm:p-4`). */
    class = input('');
    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    locale = input<LocaleInput<KanbanLocale>>();
    /**
     * Text direction of the board. Two-way, but the component overwrites it from
     * {@link locale}'s `rtl` flag whenever the resolved locale changes — set a
     * locale rather than fighting this input if you need a fixed direction.
     */
    rtl = model<boolean>(false);
    /** Shows the label chip editor in the card dialog. `false` hides the field entirely; labels already on a {@link cards} entry still render on the card. */
    haveLabels = input(true);
    /** Shows the assignee editor in the card dialog. `false` hides the field entirely; assignees already on a {@link cards} entry still render as avatars. */
    haveAssignees = input(true);
    /** Known assignees offered in the card dialog. When non-empty the dialog uses a multi-select autocomplete (so avatars are preserved); when empty it falls back to a free-text chip list where typed names get no avatar. */
    assigneeOptions = input<{ name: string; avatar?: string }[]>([]);

    /** Columns to render, in any order — the board sorts them by `order`. Ignored when `<ui-kanban-column>` children are projected. */
    columns = input<KanbanColumn[]>([]);
    /** All cards on the board; each is placed by its `columnId` and sorted by `order` within the column. The component never mutates this array — apply the emitted changes yourself. */
    cards = input<KanbanCard[]>([]);
    /** Case-insensitive filter over each card's title, description and label texts. Hidden cards stay in {@link cards} but drop out of the column count badge and therefore out of the WIP-limit check, so leave it empty when the badge must be accurate. */
    searchTerm = input('');

    /**
     * Groups cards into horizontal swimlanes — the board's second axis, on top
     * of columns. `null` (the default) renders exactly one implicit lane and the
     * board looks and behaves as it always did.
     *
     * Pass a **property name** (`'assignee'`, `'epic'`) and a drag across lanes
     * reassigns that field for you. Pass a **function** and the lane is derived
     * but not invertible, so a cross-lane drop moves the card between columns
     * only — reassign it yourself from {@link cardMoved}'s `toSwimlaneId`.
     *
     * Cards whose value is missing or empty collect in a single unnamed lane,
     * rendered last, so nothing silently disappears from the board.
     */
    swimlaneBy = input<KanbanSwimlaneBy>(null);
    /** Maps a lane id to its heading. Defaults to the id itself, with the empty lane falling back to the locale's "Unassigned". */
    swimlaneLabel = input<((id: string) => string) | null>(null);
    /** Lanes collapsed on first render. After that each lane's state is the board's to own — toggle it with {@link toggleSwimlane}. */
    initiallyCollapsedSwimlanes = input<readonly string[]>([]);

    /** Emits the full next `columns` array (a new array — never the input mutated) after a reorder, undo or redo. Assign it back to {@link columns} or the board will not change. */
    columnsChange = output<KanbanColumn[]>();
    /** Emits the full next `cards` array after a move, delete, undo or redo. The board is fully controlled: nothing changes until you assign this back to {@link cards}. Card creation/edits come through {@link cardAdded}/{@link cardUpdated} instead. */
    cardsChange = output<KanbanCard[]>();
    /** Fires alongside {@link cardsChange} when a card changes position, via drag-and-drop or the "Move to" context-menu item. Informational — the move is already reflected in the {@link cardsChange} payload; use it for logging or persistence. `newOrder` is the target index within the destination column. */
    cardMoved = output<KanbanCardMoveEvent>();
    /** Fires when a card is created from the dialog or duplicated (title suffixed `" (copy)"`). The payload has no `id` — mint one and append the card to {@link cards} yourself; no {@link cardsChange} accompanies this. */
    cardAdded = output<KanbanCardAddEvent>();
    /** Fires with the complete edited card after a dialog save or a priority change from the context menu. Replace the matching entry in {@link cards} — no {@link cardsChange} accompanies this. */
    cardUpdated = output<KanbanCard>();
    /** Emits the deleted card's id only once the 6s undo toast expires or is dismissed, so it is safe to use for irreversible cleanup. {@link cardsChange} already removed the card optimistically when the delete was requested. */
    cardDeleted = output<string>();
    /** Fires when a column is added from the board context menu. No `id` — mint one and append to {@link columns} yourself. `order` is set to the current column count. */
    columnAdded = output<Omit<KanbanColumn, 'id'>>();
    /** Fires with the complete column after a rename or a WIP-limit change. A cleared WIP limit arrives as `wipLimit: undefined`. Replace the matching entry in {@link columns}. */
    columnUpdated = output<KanbanColumn>();
    /** Fires after the delete-column dialog is confirmed. Perform the deletion yourself: `moveCardsTo` names the column to reparent the cards into, or is `undefined` when the user chose to delete them. */
    columnDeleted = output<KanbanColumnDeleteEvent>();
    /** Fires whenever the undo/redo stacks change — bind it to enable/disable your own toolbar buttons for {@link undo}/{@link redo}. */
    historyChange = output<KanbanHistoryState>();

    @ContentChildren(KanbanColumnComponent) customColumnChildren!: QueryList<KanbanColumnComponent>;

    private readonly cardMenuRef = viewChild<ContextMenuComponent>('cardMenu');
    private readonly columnMenuRef = viewChild<ContextMenuComponent>('columnMenu');
    private readonly boardMenuRef = viewChild<ContextMenuComponent>('boardMenu');
    private readonly cardDialogRef = viewChild(KanbanCardDialogComponent);
    private readonly columnDialogRef = viewChild(KanbanColumnDialogComponent);
    private readonly deleteColumnDialogRef = viewChild(KanbanDeleteColumnDialogComponent);

    private readonly _hasCustomColumns = signal(false);
    hasCustomColumns = this._hasCustomColumns.asReadonly();

    private readonly i18n = createLocaleBindings(this.locale, KANBAN_LOCALES);
    /** Resolved KanbanLocale. */
    readonly resolvedLocale = this.i18n.t;
    /** `'rtl'` when the active locale is RTL, otherwise `null` — bind to `[attr.dir]`. */
    readonly dir = this.i18n.dir;

    isRtl = computed(() => this.rtl());

    localizedPriorityOptions = computed(() => {
        const l = this.resolvedLocale();
        return [
            { label: l.priorityLow, value: 'low' as const },
            { label: l.priorityMedium, value: 'medium' as const },
            { label: l.priorityHigh, value: 'high' as const },
            { label: l.priorityUrgent, value: 'urgent' as const },
            { label: l.priorityNone, value: 'none' as const },
        ];
    });

    private readonly DELETE_DURATION = 6000;
    private readonly MAX_HISTORY = 50;
    private readonly undoStack: KanbanHistorySnapshot[] = [];
    private redoStack: KanbanHistorySnapshot[] = [];

    deleteToastVisible = signal(false);
    deleteToastCardTitle = signal('');
    deleteCountdown = signal(0);
    deleteProgressPercent = computed(() => {
        const total = Math.ceil(this.DELETE_DURATION / 1000);
        return Math.max(0, (this.deleteCountdown() / total) * 100);
    });

    private readonly pendingDeletes = new Map<string, {
        card: KanbanCard;
        timeoutId: ReturnType<typeof setTimeout>;
        countdownIntervalId: ReturnType<typeof setInterval>;
    }>();

    private readonly shortcutHandle?: ShortcutComponentHandle;

    constructor() {
        this.shortcutHandle = this.shortcuts.registerComponent('kanban', [
            {
                actionId: 'kanban.undo',
                description: 'Undo last action',
                defaultShortcut: 'Mod+Z',
                handler: () => this.undo(),
                scope: 'global',
                category: 'Kanban',
            },
            {
                actionId: 'kanban.redo',
                description: 'Redo last undone action',
                defaultShortcut: 'Mod+Shift+Z',
                handler: () => this.redo(),
                scope: 'global',
                category: 'Kanban',
            },
        ]);

        effect(() => {
            const loc = this.resolvedLocale();
            untracked(() => {
                this.rtl.set(loc.rtl ?? false);
            });
        });

        // Seeds the initial collapse state once. Re-applying it on every change
        // would fight the user: a lane they expanded would snap shut again the
        // next time `cards` changed.
        let seeded = false;
        effect(() => {
            const initial = this.initiallyCollapsedSwimlanes();
            untracked(() => {
                if (seeded || initial.length === 0) return;
                seeded = true;
                this._collapsedSwimlanes.set(new Set(initial));
            });
        });
    }

    ngAfterContentInit(): void {
        this._hasCustomColumns.set(this.customColumnChildren.length > 0);
    }

    ngOnDestroy(): void {
        this.shortcutHandle?.unregister();
        this.cancelAllPendingDeletes();
    }

    draggedCardId = signal<string | null>(null);
    dragSourceColumnId = signal<string | null>(null);

    classes = computed(() => cn(
        'flex gap-3 sm:gap-4 overflow-x-auto p-2 sm:p-4',
        this.class()
    ));

    sortedColumns = computed(() =>
        [...this.columns()].sort((a, b) => a.order - b.order)
    );

    private readonly filteredCards = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return this.cards();
        return this.cards().filter(card => {
            const matchesTitle = card.title.toLowerCase().includes(term);
            const matchesDescription = card.description?.toLowerCase().includes(term) || false;
            const matchesLabel = card.labels?.some(l => l.text.toLowerCase().includes(term)) ?? false;
            return matchesTitle || matchesDescription || matchesLabel;
        });
    });

    /** `true` when {@link swimlaneBy} is set and the board renders lane bands. */
    readonly hasSwimlanes = computed(() => this.swimlaneBy() !== null);

    /** Reads one card's lane id. `''` for cards with no value, or when swimlanes are off. */
    swimlaneIdOf(card: KanbanCard): string {
        const by = this.swimlaneBy();
        if (by === null) return '';
        if (typeof by === 'function') return by(card) || '';
        const value: unknown = Reflect.get(card, by);
        return typeof value === 'string' ? value : '';
    }

    /**
     * The lanes to render, in first-seen order with the unnamed lane pushed
     * last. Derived from the *filtered* cards, so a lane whose every card is
     * filtered out disappears with them.
     */
    readonly swimlanes = computed((): KanbanSwimlane[] => {
        if (!this.hasSwimlanes()) return [];

        const counts = new Map<string, number>();
        for (const card of this.filteredCards()) {
            const id = this.swimlaneIdOf(card);
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }

        const named: KanbanSwimlane[] = [];
        let unnamed: KanbanSwimlane | null = null;
        for (const [id, count] of counts) {
            const lane = { id, label: this.swimlaneLabelFor(id), count };
            if (id === '') unnamed = lane;
            else named.push(lane);
        }
        return unnamed === null ? named : [...named, unnamed];
    });

    private swimlaneLabelFor(id: string): string {
        const custom = this.swimlaneLabel();
        if (custom !== null) return custom(id);
        return id === '' ? this.resolvedLocale().unassigned ?? 'Unassigned' : id;
    }

    private readonly _collapsedSwimlanes = signal<ReadonlySet<string>>(new Set());

    /** Ids of the lanes currently collapsed. */
    readonly collapsedSwimlanes = this._collapsedSwimlanes.asReadonly();

    /** Whether one lane is collapsed. Each lane collapses independently of the others and of column collapse. */
    isSwimlaneCollapsed(id: string): boolean {
        return this._collapsedSwimlanes().has(id);
    }

    /** Collapses or expands one lane, leaving every other lane alone. */
    toggleSwimlane(id: string): void {
        this._collapsedSwimlanes.update(current => {
            const next = new Set(current);
            if (!next.delete(id)) next.add(id);
            return next;
        });
    }

    /**
     * The column's cards after {@link searchTerm} filtering, sorted by `order`.
     * Called by every `<ui-kanban-column>` on each change detection pass — keep
     * it cheap.
     *
     * `swimlaneId` narrows the result to one lane. It is optional, so the
     * pre-swimlane call `getCardsForColumn(id)` still returns the whole column.
     */
    getCardsForColumn(columnId: string, swimlaneId?: string): KanbanCard[] {
        const inColumn = this.filteredCards().filter(c => c.columnId === columnId);
        const scoped = swimlaneId === undefined
            ? inColumn
            : inColumn.filter(c => this.swimlaneIdOf(c) === swimlaneId);
        return scoped.sort((a, b) => a.order - b.order);
    }

    // ── Drag & Drop ──────────────────────────────────────────────

    /**
     * Marks a card as being dragged so columns accept drops and the source card
     * dims. Called by `<ui-kanban-card>` from the HTML5 `dragstart` handler —
     * there is no touch equivalent, so drag-and-drop is mouse/pointer only;
     * touch users move cards through the card context menu's "Move to" submenu.
     */
    startDrag(cardId: string, columnId: string): void {
        this.draggedCardId.set(cardId);
        this.dragSourceColumnId.set(columnId);
    }

    /** Clears the drag state set by {@link startDrag}. Runs on `dragend` and after a successful {@link moveCard}, so a cancelled drag leaves no state behind. */
    endDrag(): void {
        this.draggedCardId.set(null);
        this.dragSourceColumnId.set(null);
    }

    /**
     * Places a card at `newOrder` within `toColumnId`, pushing the cards at or
     * after that index down by one. Emits {@link cardsChange} with the next array
     * plus {@link cardMoved}, records an undo snapshot, and ends the drag — but
     * does not mutate {@link cards}, so nothing moves until you apply the change.
     * A `cardId` not present in {@link cards} is a no-op.
     */
    moveCard(cardId: string, toColumnId: string, newOrder: number, toSwimlaneId?: string): void {
        const currentCards = this.cards();
        const card = currentCards.find(c => c.id === cardId);
        if (!card) return;

        this.captureSnapshot();

        const fromColumnId = card.columnId;
        const fromSwimlaneId = this.swimlaneIdOf(card);

        const updated = currentCards.map(c => {
            if (c.id === cardId) {
                return this.relocate(c, toColumnId, newOrder, toSwimlaneId);
            }
            if (c.columnId === toColumnId && c.id !== cardId && c.order >= newOrder) {
                return { ...c, order: c.order + 1 };
            }
            return c;
        });

        this.cardsChange.emit(updated);
        this.cardMoved.emit(
            this.hasSwimlanes()
                ? { cardId, fromColumnId, toColumnId, newOrder, fromSwimlaneId, toSwimlaneId: toSwimlaneId ?? fromSwimlaneId }
                : { cardId, fromColumnId, toColumnId, newOrder }
        );
        this.endDrag();
    }

    /**
     * Applies a move to one card. The lane field is rewritten only when
     * {@link swimlaneBy} is a property name — a derived lane cannot be inverted,
     * so the card keeps its own value and the consumer reassigns it from
     * {@link cardMoved}.
     */
    private relocate(card: KanbanCard, toColumnId: string, newOrder: number, toSwimlaneId?: string): KanbanCard {
        const moved: KanbanCard = { ...card, columnId: toColumnId, order: newOrder };
        const by = this.swimlaneBy();
        if (toSwimlaneId === undefined || typeof by !== 'string') return moved;
        return Object.assign(moved, { [by]: toSwimlaneId });
    }

    // ── Context Menu ─────────────────────────────────────────────

    /** Opens the card context menu (edit / duplicate / move / priority / delete) at viewport coordinates `x`,`y`. Called by `<ui-kanban-card>` on right-click; call it yourself to expose the same menu from a custom trigger such as a long-press or a kebab button. */
    showCardContextMenu(x: number, y: number, card: KanbanCard): void {
        this.cardMenuRef()?.show(x, y, card);
    }

    /** Opens the column context menu (add card / rename / WIP limit / move / delete) at viewport coordinates `x`,`y`. Called by the column header on right-click; the move entries disable themselves via {@link isFirstColumn}/{@link isLastColumnCheck}. */
    showColumnContextMenu(x: number, y: number, column: KanbanColumn): void {
        this.columnMenuRef()?.show(x, y, column);
    }

    /** Host `contextmenu` handler that opens the board menu ("Add column") only on empty board space — right-clicks inside a column bubble up but are ignored here so the column menu wins. */
    onBoardContextMenu(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (target.closest('[data-slot="kanban-column"]')) return;
        event.preventDefault();
        this.boardMenuRef()?.show(event.clientX, event.clientY);
    }

    /** Whether `column` is leftmost in `order` and so cannot move further left. Returns `true` for `undefined` (the menu's data before it is populated) so the action stays disabled. */
    isFirstColumn(column: KanbanColumn | undefined): boolean {
        if (!column) return true;
        const sorted = this.sortedColumns();
        return sorted.length === 0 || sorted[0].id === column.id;
    }

    /** Whether `column` is rightmost in `order` and so cannot move further right. Returns `true` for `undefined`, mirroring {@link isFirstColumn}. */
    isLastColumnCheck(column: KanbanColumn | undefined): boolean {
        if (!column) return true;
        const sorted = this.sortedColumns();
        return sorted.length === 0 || sorted.at(-1)?.id === column.id;
    }

    // ── Card Actions ─────────────────────────────────────────────

    /** Opens the card dialog in "add" mode targeting `columnId`; a missing id is a no-op. Submitting emits {@link cardAdded}, not {@link cardsChange}. */
    onAddCard(columnId?: string): void {
        if (!columnId) return;
        this.cardDialogRef()?.open('add', columnId);
    }

    /** Narrows the context-menu's untyped `data()` to a card. */
    protected asCard(data: unknown): KanbanCard | undefined {
        return data as KanbanCard | undefined;
    }

    /** Narrows the context-menu's untyped `data()` to a column. */
    protected asColumn(data: unknown): KanbanColumn | undefined {
        return data as KanbanColumn | undefined;
    }

    /** Opens the card dialog prefilled from `card`; submitting emits {@link cardUpdated} with the merged card. `undefined` is a no-op, since the context menu may fire before its data is set. */
    onEditCard(card: KanbanCard | undefined): void {
        if (!card) return;
        this.cardDialogRef()?.open('edit', card.columnId, card);
    }

    /** Emits {@link cardAdded} for a copy of `card` in the same column, titled `"… (copy)"`, with labels and assignees shallow-copied. You mint the id and append it — the board shows nothing until you do. */
    onDuplicateCard(card: KanbanCard | undefined): void {
        if (!card) return;
        this.captureSnapshot();
        this.cardAdded.emit({
            columnId: card.columnId,
            title: card.title + ' (copy)',
            description: card.description,
            priority: card.priority,
            labels: card.labels ? [...card.labels] : undefined,
            assignees: card.assignees ? [...card.assignees] : undefined,
        });
    }

    /**
     * Context-menu move: appends `card` to the end of `targetColumnId` and emits
     * {@link cardsChange} plus {@link cardMoved}. Unlike {@link moveCard} it does
     * not shift sibling orders, since the target index is the column length.
     * A no-op when the card is already in that column. This is the touch-friendly
     * path to moving a card — HTML5 drag-and-drop does not fire on touch.
     */
    onMoveCardToColumn(card: KanbanCard | undefined, targetColumnId: string): void {
        if (!card || card.columnId === targetColumnId) return;
        this.captureSnapshot();

        const targetCards = this.getCardsForColumn(targetColumnId);
        const newOrder = targetCards.length;

        const updated = this.cards().map(c => {
            if (c.id === card.id) {
                return { ...c, columnId: targetColumnId, order: newOrder };
            }
            return c;
        });

        this.cardsChange.emit(updated);
        this.cardMoved.emit({
            cardId: card.id,
            fromColumnId: card.columnId,
            toColumnId: targetColumnId,
            newOrder,
        });
    }

    /** Emits {@link cardUpdated} with the new priority, which paints the card's coloured start border. Pass `'none'` to clear it — that is emitted as `priority: undefined`. */
    onSetCardPriority(card: KanbanCard | undefined, priority: KanbanCard['priority'] | 'none'): void {
        if (!card) return;
        this.captureSnapshot();
        this.cardUpdated.emit({
            ...card,
            priority: priority === 'none' ? undefined : priority,
        });
    }

    /**
     * Soft-deletes a card: emits {@link cardsChange} without it immediately and
     * shows a 6-second undo toast. {@link cardDeleted} — the signal to delete for
     * real — is withheld until the countdown expires or the toast is dismissed,
     * so treat {@link cardsChange} as provisional and do not persist the removal
     * before {@link cardDeleted} arrives. Only one delete can be pending; a second
     * delete finalizes the first.
     */
    onDeleteCard(card: KanbanCard | undefined): void {
        if (!card) return;
        this.captureSnapshot();

        const updatedCards = this.cards().filter(c => c.id !== card.id);
        this.cardsChange.emit(updatedCards);

        this.cancelAllPendingDeletes();

        const totalSeconds = Math.ceil(this.DELETE_DURATION / 1000);
        this.deleteToastVisible.set(true);
        this.deleteToastCardTitle.set(card.title);
        this.deleteCountdown.set(totalSeconds);

        const countdownIntervalId = setInterval(() => {
            this.deleteCountdown.update(v => {
                const next = v - 1;
                if (next <= 0) return 0;
                return next;
            });
        }, 1000);

        const timeoutId = setTimeout(() => {
            this.pendingDeletes.delete(card.id);
            this.deleteToastVisible.set(false);
            clearInterval(countdownIntervalId);
            this.cardDeleted.emit(card.id);
        }, this.DELETE_DURATION);

        this.pendingDeletes.set(card.id, { card, timeoutId, countdownIntervalId });
    }

    /** Toast "Undo" action: cancels the pending delete and emits {@link cardsChange} with the card appended back (at the end of {@link cards}, so its position within the column depends on its retained `order`). {@link cardDeleted} never fires, and the delete's undo snapshot is dropped so {@link undo} skips it. */
    undoCardDelete(): void {
        const entry = Array.from(this.pendingDeletes.entries()).pop();
        if (!entry) return;
        const [cardId, pending] = entry;

        clearTimeout(pending.timeoutId);
        clearInterval(pending.countdownIntervalId);
        this.pendingDeletes.delete(cardId);
        this.deleteToastVisible.set(false);

        const restoredCards = [...this.cards(), pending.card];
        this.cardsChange.emit(restoredCards);

        this.undoStack.pop();
        this.emitHistoryState();
    }

    /** Toast close button: forfeits the undo window and finalizes every pending delete immediately, emitting {@link cardDeleted} for each. */
    dismissDeleteToast(): void {
        this.deleteToastVisible.set(false);
        for (const [cardId, pending] of this.pendingDeletes.entries()) {
            clearTimeout(pending.timeoutId);
            clearInterval(pending.countdownIntervalId);
            this.pendingDeletes.delete(cardId);
            this.cardDeleted.emit(cardId);
        }
    }

    // ── Column Actions ───────────────────────────────────────────

    /** Opens the column dialog in "add" mode (name + optional WIP limit); submitting emits {@link columnAdded}. Also reachable by right-clicking empty board space. */
    onAddColumn(): void {
        this.columnDialogRef()?.openAddColumn();
    }

    /** Opens the column dialog prefilled with `column.title`; submitting emits {@link columnUpdated} with only the title replaced. */
    onRenameColumn(column: KanbanColumn | undefined): void {
        if (!column) return;
        this.columnDialogRef()?.openRenameColumn(column);
    }

    /** Opens the WIP-limit dialog for `column`. Submitting emits {@link columnUpdated}; a blank or non-positive entry clears the limit (`wipLimit: undefined`). Exceeding the limit only restyles the column — it never blocks a drop. */
    onSetWipLimit(column: KanbanColumn | undefined): void {
        if (!column) return;
        this.columnDialogRef()?.openSetWip(column);
    }

    /** Swaps `column`'s `order` with its left neighbour and emits {@link columnsChange}. "Left" is board order, not visual side — in RTL the column appears to move right. No-op for the first column. */
    onMoveColumnLeft(column: KanbanColumn | undefined): void {
        if (!column) return;
        const sorted = this.sortedColumns();
        const idx = sorted.findIndex(c => c.id === column.id);
        if (idx <= 0) return;

        this.captureSnapshot();
        const prev = sorted[idx - 1];
        const updated = this.columns().map(c => {
            if (c.id === column.id) return { ...c, order: prev.order };
            if (c.id === prev.id) return { ...c, order: column.order };
            return c;
        });
        this.columnsChange.emit(updated);
    }

    /** Swaps `column`'s `order` with its right neighbour and emits {@link columnsChange}. Mirror of {@link onMoveColumnLeft}; no-op for the last column. */
    onMoveColumnRight(column: KanbanColumn | undefined): void {
        if (!column) return;
        const sorted = this.sortedColumns();
        const idx = sorted.findIndex(c => c.id === column.id);
        if (idx < 0 || idx >= sorted.length - 1) return;

        this.captureSnapshot();
        const next = sorted[idx + 1];
        const updated = this.columns().map(c => {
            if (c.id === column.id) return { ...c, order: next.order };
            if (c.id === next.id) return { ...c, order: column.order };
            return c;
        });
        this.columnsChange.emit(updated);
    }

    /** Opens the confirmation dialog, which asks where to send the column's cards when it holds any. Nothing is emitted until the user confirms — see {@link onDeleteColumnConfirmed}. */
    onDeleteColumn(column: KanbanColumn | undefined): void {
        if (!column) return;
        const cardCount = this.cards().filter(c => c.columnId === column.id).length;
        this.deleteColumnDialogRef()?.open(column, cardCount);
    }

    // ── Dialog Handlers ──────────────────────────────────────────

    /** Card-dialog `submitted` handler: records an undo snapshot, then re-emits as {@link cardAdded} (add mode) or {@link cardUpdated} merged onto `event.card` (edit mode). Wired in the template; call it only when driving the dialog yourself. */
    onCardDialogSubmitted(event: {
        mode: 'add' | 'edit';
        columnId: string;
        card?: KanbanCard;
        data: KanbanCardAddEvent;
    }): void {
        this.captureSnapshot();
        if (event.mode === 'add') {
            this.cardAdded.emit(event.data);
        } else if (event.mode === 'edit' && event.card) {
            this.cardUpdated.emit({
                ...event.card,
                title: event.data.title,
                description: event.data.description,
                priority: event.data.priority,
                labels: event.data.labels,
                assignees: event.data.assignees,
            });
        }
    }

    /** Column-dialog `submitted` handler: records an undo snapshot, then emits {@link columnAdded} for `'add-column'` or {@link columnUpdated} for `'rename-column'`/`'set-wip'`. Rename and WIP modes silently do nothing if the id is no longer in {@link columns}. */
    onColumnDialogSubmitted(event: {
        mode: KanbanColumnDialogMode;
        name?: string;
        wipLimit?: number;
        columnId?: string;
    }): void {
        this.captureSnapshot();
        if (event.mode === 'add-column') {
            this.columnAdded.emit({
                title: event.name ?? '',
                wipLimit: event.wipLimit,
                order: this.columns().length,
            });
        } else if (event.mode === 'rename-column' && event.columnId) {
            const existing = this.columns().find(c => c.id === event.columnId);
            if (existing) {
                this.columnUpdated.emit({ ...existing, title: event.name ?? existing.title });
            }
        } else if (event.mode === 'set-wip' && event.columnId) {
            const existing = this.columns().find(c => c.id === event.columnId);
            if (existing) {
                this.columnUpdated.emit({ ...existing, wipLimit: event.wipLimit });
            }
        }
    }

    /** Delete-confirmation handler: records an undo snapshot and re-emits the choice as {@link columnDeleted}. It does not emit {@link columnsChange} or {@link cardsChange} — you remove the column and reparent or drop its cards. */
    onDeleteColumnConfirmed(event: KanbanColumnDeleteEvent): void {
        this.captureSnapshot();
        this.columnDeleted.emit(event);
    }

    // ── History System ───────────────────────────────────────────

    private captureSnapshot(): void {
        this.undoStack.push({
            cards: [...this.cards()],
            columns: [...this.columns()],
        });
        if (this.undoStack.length > this.MAX_HISTORY) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        this.emitHistoryState();
    }

    /**
     * Restores the previous board snapshot, emitting both {@link cardsChange} and
     * {@link columnsChange} — apply both or the board desynchronizes. Bound to
     * `Mod+Z` globally while the component is alive. History holds 50 steps and
     * snapshots the state *before* each action; since add/update actions only
     * emit events, undoing them relies on you having applied those events. A
     * pending delete is abandoned rather than finalized — its toast closes and
     * {@link cardDeleted} never fires, the restored snapshot being authoritative.
     */
    undo(): void {
        const snapshot = this.undoStack.pop();
        if (!snapshot) return;

        this.cancelAllPendingDeletes();

        this.redoStack.push({
            cards: [...this.cards()],
            columns: [...this.columns()],
        });

        this.cardsChange.emit(snapshot.cards);
        this.columnsChange.emit(snapshot.columns);
        this.emitHistoryState();
    }

    /** Reapplies the last undone snapshot, emitting {@link cardsChange} and {@link columnsChange}. Bound to `Mod+Shift+Z`. The redo stack is cleared by any new board action, so redo is only available immediately after {@link undo}. */
    redo(): void {
        const snapshot = this.redoStack.pop();
        if (!snapshot) return;

        this.cancelAllPendingDeletes();

        this.undoStack.push({
            cards: [...this.cards()],
            columns: [...this.columns()],
        });

        this.cardsChange.emit(snapshot.cards);
        this.columnsChange.emit(snapshot.columns);
        this.emitHistoryState();
    }

    private emitHistoryState(): void {
        this.historyChange.emit({
            canUndo: this.undoStack.length > 0,
            canRedo: this.redoStack.length > 0,
        });
    }

    private cancelAllPendingDeletes(): void {
        for (const [, pending] of this.pendingDeletes.entries()) {
            clearTimeout(pending.timeoutId);
            clearInterval(pending.countdownIntervalId);
        }
        this.pendingDeletes.clear();
        this.deleteToastVisible.set(false);
    }
}
