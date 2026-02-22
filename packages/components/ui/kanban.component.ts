import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    output,
    ContentChildren,
    QueryList,
    AfterContentInit,
    forwardRef,
    InjectionToken,
    inject,
    ElementRef,
    ViewChild,
} from '@angular/core';
import { cn } from '../lib/utils';
import { BadgeComponent } from './badge.component';
import { AvatarComponent } from './avatar.component';
import { ScrollAreaComponent } from './scroll-area.component';
import { SeparatorComponent } from './separator.component';

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

export interface KanbanCard {
    id: string;
    columnId: string;
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
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

// ────────────────────────────────────────────────────────────────
// Injection token for parent-child communication
// ────────────────────────────────────────────────────────────────

export const KANBAN = new InjectionToken<KanbanComponent>('KANBAN');
export const KANBAN_COLUMN = new InjectionToken<KanbanColumnComponent>('KANBAN_COLUMN');

// ────────────────────────────────────────────────────────────────
// KanbanColumnHeaderComponent — projection slot
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban-column-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="classes()" [attr.data-slot]="'kanban-column-header'">
            <ng-content />
        </div>
    `,
    host: { class: 'contents' },
})
export class KanbanColumnHeaderComponent {
    class = input('');
    classes = computed(() => cn('flex items-center justify-between p-3', this.class()));
}

// ────────────────────────────────────────────────────────────────
// KanbanCardContentComponent — projection slot
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban-card-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="classes()" [attr.data-slot]="'kanban-card-content'">
            <ng-content />
        </div>
    `,
    host: { class: 'contents' },
})
export class KanbanCardContentComponent {
    class = input('');
    classes = computed(() => cn('p-3', this.class()));
}

// ────────────────────────────────────────────────────────────────
// KanbanCardComponent — card with priority, labels, drag source
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent, AvatarComponent],
    template: `
        <div
            [class]="classes()"
            [attr.data-slot]="'kanban-card'"
            [attr.data-card-id]="cardId()"
            [attr.draggable]="'true'"
            (dragstart)="onDragStart($event)"
            (dragend)="onDragEnd()"
        >
            @if (hasCustomContent()) {
                <ng-content />
            } @else {
                <div class="p-3 space-y-2">
                    @if (card()?.labels?.length) {
                        <div class="flex flex-wrap gap-1">
                            @for (label of card()!.labels!; track label.text) {
                                <ui-badge
                                    class="text-[10px] px-1.5 py-0"
                                    [label]="label.text"
                                    [style.backgroundColor]="label.color"
                                    [style.color]="'white'"
                                />
                            }
                        </div>
                    }
                    @if (card()?.title) {
                        <p class="text-sm font-medium leading-snug">{{ card()!.title }}</p>
                    }
                    @if (card()?.description) {
                        <p class="text-xs text-muted-foreground line-clamp-2">{{ card()!.description }}</p>
                    }
                    @if (card()?.assignees?.length) {
                        <div class="flex items-center -space-x-1 pt-1">
                            @for (assignee of card()!.assignees!; track assignee.name) {
                                <ui-avatar
                                    class="h-6 w-6 border-2 border-background"
                                    [src]="assignee.avatar ?? ''"
                                    [fallback]="assignee.name.charAt(0).toUpperCase()"
                                    [alt]="assignee.name"
                                />
                            }
                        </div>
                    }
                </div>
            }
        </div>
    `,
    host: { class: 'contents' },
})
export class KanbanCardComponent implements AfterContentInit {
    private readonly kanban = inject(KANBAN, { optional: true });
    private readonly column = inject(KANBAN_COLUMN, { optional: true });

    class = input('');
    card = input<KanbanCard>();
    cardId = input('');

    @ContentChildren(KanbanCardContentComponent) customContentChildren!: QueryList<KanbanCardContentComponent>;

    private _hasCustomContent = signal(false);
    hasCustomContent = this._hasCustomContent.asReadonly();

    ngAfterContentInit() {
        this._hasCustomContent.set(this.customContentChildren.length > 0);
    }

    private priorityBorder = computed(() => {
        const p = this.card()?.priority;
        if (p === 'low') return 'border-l-green-500';
        if (p === 'medium') return 'border-l-yellow-500';
        if (p === 'high') return 'border-l-orange-500';
        if (p === 'urgent') return 'border-l-red-500';
        return '';
    });

    classes = computed(() => cn(
        'bg-card text-card-foreground rounded-lg border shadow-sm cursor-grab active:cursor-grabbing',
        'transition-all duration-200 hover:shadow-md',
        this.card()?.priority ? 'border-l-[3px]' : '',
        this.priorityBorder(),
        this.kanban?.draggedCardId() === this.resolvedCardId()
            ? 'opacity-50 scale-[0.98] shadow-lg ring-2 ring-primary/20'
            : '',
        this.class()
    ));

    private resolvedCardId(): string {
        return this.cardId() || this.card()?.id || '';
    }

    onDragStart(event: DragEvent) {
        const id = this.resolvedCardId();
        const colId = this.column?.columnId() || this.card()?.columnId || '';
        if (!event.dataTransfer || !id) return;

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
        this.kanban?.startDrag(id, colId);
    }

    onDragEnd() {
        this.kanban?.endDrag();
    }
}

// ────────────────────────────────────────────────────────────────
// KanbanColumnComponent — column with header, WIP, collapse, drop
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban-column',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent, SeparatorComponent, ScrollAreaComponent, KanbanCardComponent],
    providers: [{ provide: KANBAN_COLUMN, useExisting: forwardRef(() => KanbanColumnComponent) }],
    template: `
        <div
            [class]="classes()"
            [attr.data-slot]="'kanban-column'"
            [attr.data-column-id]="columnId()"
            [attr.data-drag-over]="isDragOver() || null"
            (dragenter)="onDragEnter($event)"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave()"
            (drop)="onDrop($event)"
        >
            @if (hasCustomHeader()) {
                <ng-content select="ui-kanban-column-header" />
            } @else {
                <div class="flex items-center justify-between p-3" data-slot="kanban-column-header">
                    <div class="flex items-center gap-2">
                        <h3 class="text-sm font-semibold">{{ title() }}</h3>
                        <ui-badge
                            [label]="cardCount() + ''"
                            [variant]="isOverWipLimit() ? 'destructive' : 'secondary'"
                            class="text-xs"
                        />
                        @if (wipLimit()) {
                            <span class="text-xs text-muted-foreground">/ {{ wipLimit() }}</span>
                        }
                    </div>
                    @if (collapsible()) {
                        <button
                            type="button"
                            class="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"
                            (click)="toggleCollapse()"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                [class]="collapsed() ? 'rotate-180' : ''"
                                class="transition-transform"
                            >
                                <path d="m18 15-6-6-6 6"/>
                            </svg>
                        </button>
                    }
                </div>
            }

            <ui-separator />

            @if (!collapsed()) {
                <ui-scroll-area class="flex-1 min-h-0" orientation="vertical">
                    <div class="p-3 flex flex-col gap-3 min-h-[40px] relative" #cardContainer>
                        <div
                            class="absolute left-2 right-2 pointer-events-none transition-all duration-200 ease-out"
                            [class.opacity-0]="dropIndicatorIndex() < 0"
                            [class.opacity-100]="dropIndicatorIndex() >= 0"
                            [style.top.px]="dropIndicatorTop()"
                            data-slot="kanban-drop-indicator"
                        >
                            <div class="flex items-center">
                                <div class="h-2 w-2 rounded-full bg-primary shrink-0"></div>
                                <div class="h-[3px] bg-primary rounded-full flex-1"></div>
                                <div class="h-2 w-2 rounded-full bg-primary shrink-0"></div>
                            </div>
                        </div>
                        @if (hasCustomCards()) {
                            <ng-content />
                        } @else {
                            @for (c of visibleCards(); track c.id) {
                                <ui-kanban-card [card]="c" [cardId]="c.id" />
                            }
                        }
                    </div>
                </ui-scroll-area>
            }
        </div>
    `,
    host: { class: 'contents' },
})
export class KanbanColumnComponent implements AfterContentInit {
    private readonly kanban = inject(KANBAN, { optional: true });

    @ViewChild('cardContainer') cardContainerRef?: ElementRef<HTMLElement>;

    class = input('');
    columnId = input('');
    title = input('');
    wipLimit = input<number | undefined>(undefined);
    collapsible = input(true);

    collapsed = signal(false);
    dropIndicatorIndex = signal(-1);
    dropIndicatorTop = signal(-1);
    isDragOver = signal(false);

    private dragEnterCount = 0;
    private lastDragOverTime = 0;

    @ContentChildren(forwardRef(() => KanbanColumnHeaderComponent)) customHeaders!: QueryList<KanbanColumnHeaderComponent>;
    @ContentChildren(forwardRef(() => KanbanCardComponent)) customCards!: QueryList<KanbanCardComponent>;

    private _hasCustomHeader = signal(false);
    hasCustomHeader = this._hasCustomHeader.asReadonly();
    private _hasCustomCards = signal(false);
    hasCustomCards = this._hasCustomCards.asReadonly();

    ngAfterContentInit() {
        this._hasCustomHeader.set(this.customHeaders.length > 0);
        this._hasCustomCards.set(this.customCards.length > 0);
    }

    visibleCards = computed(() => {
        if (!this.kanban) return [];
        return this.kanban.getCardsForColumn(this.columnId());
    });

    cardCount = computed(() => {
        if (this.hasCustomCards()) return this.customCards?.length ?? 0;
        return this.visibleCards().length;
    });

    isOverWipLimit = computed(() => {
        const limit = this.wipLimit();
        return limit != null && this.cardCount() > limit;
    });

    classes = computed(() => cn(
        'bg-muted/50 rounded-lg border flex flex-col min-w-[280px] max-w-[350px] w-[300px]',
        'transition-colors duration-200',
        this.isOverWipLimit() ? 'border-destructive/50' : '',
        this.isDragOver() ? 'border-primary/50 bg-accent/30 ring-1 ring-primary/20' : '',
        this.class()
    ));

    toggleCollapse() {
        this.collapsed.update(v => !v);
    }

    onDragEnter(event: DragEvent) {
        if (!this.kanban?.draggedCardId()) return;
        event.preventDefault();
        this.dragEnterCount++;
        this.isDragOver.set(true);
    }

    onDragOver(event: DragEvent) {
        if (!this.kanban?.draggedCardId()) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

        const now = performance.now();
        if (now - this.lastDragOverTime < 50) return;
        this.lastDragOverTime = now;

        const container = this.cardContainerRef?.nativeElement;
        if (!container) {
            this.dropIndicatorIndex.set(0);
            this.dropIndicatorTop.set(12);
            return;
        }

        const cards = Array.from(
            container.querySelectorAll('[data-slot="kanban-card"]')
        ) as HTMLElement[];

        let index = cards.length;

        for (let i = 0; i < cards.length; i++) {
            const rect = cards[i].getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (event.clientY < midY) {
                index = i;
                break;
            }
        }

        let topPx: number;
        if (cards.length === 0) {
            topPx = 12;
        } else if (index === 0) {
            topPx = cards[0].offsetTop - 6;
        } else if (index >= cards.length) {
            const last = cards[cards.length - 1];
            topPx = last.offsetTop + last.offsetHeight + 5;
        } else {
            const prev = cards[index - 1];
            const curr = cards[index];
            topPx = prev.offsetTop + prev.offsetHeight +
                (curr.offsetTop - prev.offsetTop - prev.offsetHeight) / 2;
        }

        this.dropIndicatorIndex.set(index);
        this.dropIndicatorTop.set(topPx);
    }

    onDragLeave() {
        this.dragEnterCount--;
        if (this.dragEnterCount <= 0) {
            this.dragEnterCount = 0;
            this.dropIndicatorIndex.set(-1);
            this.dropIndicatorTop.set(-1);
            this.isDragOver.set(false);
        }
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        const cardId = event.dataTransfer?.getData('text/plain');
        if (!cardId || !this.kanban) return;

        this.kanban.moveCard(cardId, this.columnId(), this.dropIndicatorIndex());
        this.dropIndicatorIndex.set(-1);
        this.dropIndicatorTop.set(-1);
        this.isDragOver.set(false);
        this.dragEnterCount = 0;
    }
}

// ────────────────────────────────────────────────────────────────
// KanbanComponent — main container, state, drag coordination
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [KanbanColumnComponent],
    providers: [{ provide: KANBAN, useExisting: forwardRef(() => KanbanComponent) }],
    template: `
        <div [class]="classes()" [attr.data-slot]="'kanban'">
            @if (hasCustomColumns()) {
                <ng-content />
            } @else {
                @for (col of sortedColumns(); track col.id) {
                    <ui-kanban-column
                        [columnId]="col.id"
                        [title]="col.title"
                        [wipLimit]="col.wipLimit"
                        [collapsible]="true"
                    />
                }
            }
        </div>
    `,
    host: { class: 'block' },
})
export class KanbanComponent implements AfterContentInit {
    class = input('');

    columns = input<KanbanColumn[]>([]);
    cards = input<KanbanCard[]>([]);
    searchTerm = input('');

    columnsChange = output<KanbanColumn[]>();
    cardsChange = output<KanbanCard[]>();
    cardMoved = output<KanbanCardMoveEvent>();

    @ContentChildren(forwardRef(() => KanbanColumnComponent)) customColumnChildren!: QueryList<KanbanColumnComponent>;

    private _hasCustomColumns = signal(false);
    hasCustomColumns = this._hasCustomColumns.asReadonly();

    ngAfterContentInit() {
        this._hasCustomColumns.set(this.customColumnChildren.length > 0);
    }

    draggedCardId = signal<string | null>(null);
    dragSourceColumnId = signal<string | null>(null);

    classes = computed(() => cn(
        'flex gap-4 overflow-x-auto p-4',
        this.class()
    ));

    sortedColumns = computed(() =>
        [...this.columns()].sort((a, b) => a.order - b.order)
    );

    private filteredCards = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return this.cards();
        return this.cards().filter(card =>
            card.title.toLowerCase().includes(term) ||
            card.description?.toLowerCase().includes(term) ||
            card.labels?.some(l => l.text.toLowerCase().includes(term))
        );
    });

    getCardsForColumn(columnId: string): KanbanCard[] {
        return this.filteredCards()
            .filter(c => c.columnId === columnId)
            .sort((a, b) => a.order - b.order);
    }

    startDrag(cardId: string, columnId: string) {
        this.draggedCardId.set(cardId);
        this.dragSourceColumnId.set(columnId);
    }

    endDrag() {
        this.draggedCardId.set(null);
        this.dragSourceColumnId.set(null);
    }

    moveCard(cardId: string, toColumnId: string, newOrder: number) {
        const currentCards = this.cards();
        const card = currentCards.find(c => c.id === cardId);
        if (!card) return;

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
}
