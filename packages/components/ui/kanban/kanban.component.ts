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
    ],
    providers: [
        { provide: KANBAN, useExisting: forwardRef(() => KanbanComponent) },
        provideComponentLocale(() => KanbanComponent),
    ],
    template: `
        <div [dir]="isRtl() ? 'rtl' : 'ltr'">
            <div [class]="classes()" [attr.data-slot]="'kanban'" (contextmenu)="onBoardContextMenu($event)">
                @if (hasCustomColumns()) {
                    <ng-content />
                } @else {
                    @for (col of sortedColumns(); track col.id) {
                        <ui-kanban-column
                            [columnId]="col.id"
                            [title]="col.title"
                            [wipLimit]="col.wipLimit"
                            [collapsible]="true"
                            [locale]="resolvedLocale()"
                        />
                    }
                }
            </div>

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

    class = input('');
    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    locale = input<LocaleInput<KanbanLocale>>();
    rtl = model<boolean>(false);
    haveLabels = input(true);
    haveAssignees = input(true);
    assigneeOptions = input<{ name: string; avatar?: string }[]>([]);

    columns = input<KanbanColumn[]>([]);
    cards = input<KanbanCard[]>([]);
    searchTerm = input('');

    columnsChange = output<KanbanColumn[]>();
    cardsChange = output<KanbanCard[]>();
    cardMoved = output<KanbanCardMoveEvent>();
    cardAdded = output<KanbanCardAddEvent>();
    cardUpdated = output<KanbanCard>();
    cardDeleted = output<string>();
    columnAdded = output<Omit<KanbanColumn, 'id'>>();
    columnUpdated = output<KanbanColumn>();
    columnDeleted = output<KanbanColumnDeleteEvent>();
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

    getCardsForColumn(columnId: string): KanbanCard[] {
        return this.filteredCards()
            .filter(c => c.columnId === columnId)
            .sort((a, b) => a.order - b.order);
    }

    // ── Drag & Drop ──────────────────────────────────────────────

    startDrag(cardId: string, columnId: string): void {
        this.draggedCardId.set(cardId);
        this.dragSourceColumnId.set(columnId);
    }

    endDrag(): void {
        this.draggedCardId.set(null);
        this.dragSourceColumnId.set(null);
    }

    moveCard(cardId: string, toColumnId: string, newOrder: number): void {
        const currentCards = this.cards();
        const card = currentCards.find(c => c.id === cardId);
        if (!card) return;

        this.captureSnapshot();

        const fromColumnId = card.columnId;

        const updated = currentCards.map(c => {
            if (c.id === cardId) {
                return { ...c, columnId: toColumnId, order: newOrder };
            }
            if (c.columnId === toColumnId && c.id !== cardId && c.order >= newOrder) {
                return { ...c, order: c.order + 1 };
            }
            return c;
        });

        this.cardsChange.emit(updated);
        this.cardMoved.emit({ cardId, fromColumnId, toColumnId, newOrder });
        this.endDrag();
    }

    // ── Context Menu ─────────────────────────────────────────────

    showCardContextMenu(x: number, y: number, card: KanbanCard): void {
        this.cardMenuRef()?.show(x, y, card);
    }

    showColumnContextMenu(x: number, y: number, column: KanbanColumn): void {
        this.columnMenuRef()?.show(x, y, column);
    }

    onBoardContextMenu(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (target.closest('[data-slot="kanban-column"]')) return;
        event.preventDefault();
        this.boardMenuRef()?.show(event.clientX, event.clientY);
    }

    isFirstColumn(column: KanbanColumn | undefined): boolean {
        if (!column) return true;
        const sorted = this.sortedColumns();
        return sorted.length === 0 || sorted[0].id === column.id;
    }

    isLastColumnCheck(column: KanbanColumn | undefined): boolean {
        if (!column) return true;
        const sorted = this.sortedColumns();
        return sorted.length === 0 || sorted.at(-1)?.id === column.id;
    }

    // ── Card Actions ─────────────────────────────────────────────

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

    onEditCard(card: KanbanCard | undefined): void {
        if (!card) return;
        this.cardDialogRef()?.open('edit', card.columnId, card);
    }

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

    onSetCardPriority(card: KanbanCard | undefined, priority: KanbanCard['priority'] | 'none'): void {
        if (!card) return;
        this.captureSnapshot();
        this.cardUpdated.emit({
            ...card,
            priority: priority === 'none' ? undefined : priority,
        });
    }

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

    onAddColumn(): void {
        this.columnDialogRef()?.openAddColumn();
    }

    onRenameColumn(column: KanbanColumn | undefined): void {
        if (!column) return;
        this.columnDialogRef()?.openRenameColumn(column);
    }

    onSetWipLimit(column: KanbanColumn | undefined): void {
        if (!column) return;
        this.columnDialogRef()?.openSetWip(column);
    }

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

    onDeleteColumn(column: KanbanColumn | undefined): void {
        if (!column) return;
        const cardCount = this.cards().filter(c => c.columnId === column.id).length;
        this.deleteColumnDialogRef()?.open(column, cardCount);
    }

    // ── Dialog Handlers ──────────────────────────────────────────

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
