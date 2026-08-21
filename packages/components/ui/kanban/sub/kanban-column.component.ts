import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    ContentChildren,
    QueryList,
    AfterContentInit,
    forwardRef,
    InjectionToken,
    inject,
    ElementRef,
    ViewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { BadgeComponent } from '../../badge';
import { SeparatorComponent } from '../../separator';
import { ScrollAreaComponent } from '../../scroll-area';
import { ButtonComponent } from '../../button';
import { KANBAN } from '../kanban.component';
import { KanbanCardComponent } from './kanban-card.component';
import { KanbanColumnHeaderComponent } from './kanban-column-header.component';
import { type KanbanLocale, KANBAN_LOCALES } from '../kanban-locales';

export const KANBAN_COLUMN = new InjectionToken<KanbanColumnComponent>('KANBAN_COLUMN');

@Component({
    selector: 'ui-kanban-column',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent, SeparatorComponent, ScrollAreaComponent, forwardRef(() => KanbanCardComponent), ButtonComponent],
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
                <div class="flex items-center justify-between p-3"
                     data-slot="kanban-column-header"
                     (contextmenu)="onHeaderContextMenu($event)">
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
                    <div class="flex items-center gap-1">
                        <button
                            type="button"
                            class="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"
                            (click)="onAddCard()"
                            aria-label="Add card"
                            data-slot="kanban-add-card-button"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 5v14" /><path d="M5 12h14" />
                            </svg>
                        </button>
                        @if (collapsible()) {
                            <button
                                type="button"
                                class="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"
                                (click)="toggleCollapse()"
                                [attr.aria-label]="collapsed() ? 'Expand column' : 'Collapse column'"
                                [attr.aria-expanded]="!collapsed()"
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
                            @if (visibleCards().length === 0) {
                                <div class="flex flex-col items-center justify-center py-8 text-center"
                                     data-slot="kanban-empty-state">
                                    <p class="text-sm text-muted-foreground mb-2">{{ locale().noCardsYet }}</p>
                                    <ui-button variant="ghost" size="sm" (clicked)="onAddCard()">{{ locale().addACard }}</ui-button>
                                </div>
                            } @else {
                                @for (c of visibleCards(); track c.id) {
                                    <ui-kanban-card [card]="c" [cardId]="c.id" />
                                }
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

    /** Extra classes merged onto the column shell, after the fixed track width (`w-[260px] sm:w-[300px]`) and the over-limit / drag-over border states so they can be overridden. */
    class = input('');
    /** Links this column to the board: cards are pulled by matching `KanbanCard.columnId`, and drops are reported against it. Without it the column renders permanently empty. */
    columnId = input('');
    /** Heading text in the default header. Ignored when a `<ui-kanban-column-header>` is projected. */
    title = input('');
    /** Soft work-in-progress cap shown as `/ n` beside the count. Exceeding it turns the count badge destructive and the border red — it never blocks a drop or an add. Counts only cards visible under the board's search filter. */
    wipLimit = input<number | undefined>(undefined);
    /** Shows the chevron that collapses the card list to just the header. Collapse state is local to the column and resets when the column is re-created. */
    collapsible = input(true);
    /** Locale dictionary for the empty-state text. The board passes its own resolved locale down; set it only on a hand-placed `<ui-kanban-column>` outside a `<ui-kanban>`. */
    locale = input<KanbanLocale>(KANBAN_LOCALES['en']);
    /**
     * Narrows this column to one swimlane, so a board with lanes renders one
     * column instance per (column x lane) cell. `undefined` (the default) is
     * the whole column, which is what a board without lanes renders — and what
     * every pre-swimlane consumer keeps getting.
     *
     * A drop into this instance reports the lane along with the column, so the
     * board can reassign the card's grouping field.
     */
    swimlaneId = input<string | undefined>(undefined);

    collapsed = signal(false);
    dropIndicatorIndex = signal(-1);
    dropIndicatorTop = signal(-1);
    isDragOver = signal(false);

    private dragEnterCount = 0;
    private lastDragOverTime = 0;

    @ContentChildren(forwardRef(() => KanbanColumnHeaderComponent)) customHeaders!: QueryList<KanbanColumnHeaderComponent>;
    @ContentChildren(forwardRef(() => KanbanCardComponent)) customCards!: QueryList<KanbanCardComponent>;

    private readonly _hasCustomHeader = signal(false);
    hasCustomHeader = this._hasCustomHeader.asReadonly();
    private readonly _hasCustomCards = signal(false);
    hasCustomCards = this._hasCustomCards.asReadonly();

    ngAfterContentInit(): void {
        this._hasCustomHeader.set(this.customHeaders.length > 0);
        this._hasCustomCards.set(this.customCards.length > 0);
    }

    visibleCards = computed(() => {
        if (!this.kanban) return [];
        return this.kanban.getCardsForColumn(this.columnId(), this.swimlaneId());
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
        'bg-muted/50 rounded-lg border flex flex-col w-[260px] sm:w-[300px] min-w-[240px] sm:min-w-[280px] sm:max-w-[350px] shrink-0',
        'transition-colors duration-200',
        this.isOverWipLimit() ? 'border-destructive/50' : '',
        this.isDragOver() ? 'border-primary/50 bg-accent/30 ring-1 ring-primary/20' : '',
        this.class()
    ));

    /** Collapses or expands the card list, leaving the header and its counts visible. A collapsed column removes the card container from the DOM, so it can no longer be dropped into. */
    toggleCollapse(): void {
        this.collapsed.update(v => !v);
    }

    /** Asks the board to open its card dialog targeting this column — backing both the header `+` button and the empty-state link. Does nothing outside a `<ui-kanban>`. */
    onAddCard(): void {
        this.kanban?.onAddCard(this.columnId());
    }

    /** Opens the board's column menu at the pointer, stopping propagation so the board's own "Add column" menu does not also open. Silently does nothing if {@link columnId} matches no entry in the board's `columns`. Right-click only — no long-press fallback. */
    onHeaderContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const col = this.kanban?.columns().find(c => c.id === this.columnId());
        if (col) this.kanban?.showColumnContextMenu(event.clientX, event.clientY, col);
    }

    /** Marks the column as a drop target, but only while the board reports a card being dragged — so files and outside content dragged over the board are left to the page. Enter/leave are ref-counted, because moving between child cards fires `dragleave` on the column. */
    onDragEnter(event: DragEvent): void {
        if (!this.kanban?.draggedCardId()) return;
        event.preventDefault();
        this.dragEnterCount++;
        this.isDragOver.set(true);
    }

    /**
     * Keeps the drop allowed and positions the insertion indicator at the gap
     * nearest the pointer, computed by comparing `clientY` against each card's
     * vertical midpoint. Throttled to one measurement per 50ms since `dragover`
     * fires continuously, so the indicator can trail the cursor slightly. The
     * index it settles on is what {@link onDrop} passes to the board.
     */
    onDragOver(event: DragEvent): void {
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
            container.querySelectorAll<HTMLElement>('[data-slot="kanban-card"]')
        );

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
            const last = cards.at(-1);
            topPx = last ? last.offsetTop + last.offsetHeight + 5 : 12;
        } else {
            const prev = cards[index - 1];
            const curr = cards[index];
            topPx = prev.offsetTop + prev.offsetHeight +
                (curr.offsetTop - prev.offsetTop - prev.offsetHeight) / 2;
        }

        this.dropIndicatorIndex.set(index);
        this.dropIndicatorTop.set(topPx);
    }

    /** Decrements the enter/leave ref count and hides the indicator and highlight only once the pointer has truly left the column, not merely crossed between cards inside it. */
    onDragLeave(): void {
        this.dragEnterCount--;
        if (this.dragEnterCount <= 0) {
            this.dragEnterCount = 0;
            this.dropIndicatorIndex.set(-1);
            this.dropIndicatorTop.set(-1);
            this.isDragOver.set(false);
        }
    }

    /**
     * Reads the dragged card id from the `text/plain` transfer data and asks the
     * board to move it here at the indicator's index — the board emits the change
     * rather than mutating anything, so nothing moves until the consumer applies
     * `cardsChange`. Drag visuals are reset regardless of the outcome.
     */
    onDrop(event: DragEvent): void {
        event.preventDefault();
        const cardId = event.dataTransfer?.getData('text/plain');
        if (!cardId || !this.kanban) return;

        this.kanban.moveCard(cardId, this.columnId(), this.dropIndicatorIndex(), this.swimlaneId());
        this.dropIndicatorIndex.set(-1);
        this.dropIndicatorTop.set(-1);
        this.isDragOver.set(false);
        this.dragEnterCount = 0;
    }
}
