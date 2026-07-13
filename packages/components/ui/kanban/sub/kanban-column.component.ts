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

    class = input('');
    columnId = input('');
    title = input('');
    wipLimit = input<number | undefined>(undefined);
    collapsible = input(true);
    locale = input<KanbanLocale>(KANBAN_LOCALES['en']);

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
        'bg-muted/50 rounded-lg border flex flex-col w-[260px] sm:w-[300px] min-w-[240px] sm:min-w-[280px] sm:max-w-[350px] shrink-0',
        'transition-colors duration-200',
        this.isOverWipLimit() ? 'border-destructive/50' : '',
        this.isDragOver() ? 'border-primary/50 bg-accent/30 ring-1 ring-primary/20' : '',
        this.class()
    ));

    toggleCollapse(): void {
        this.collapsed.update(v => !v);
    }

    onAddCard(): void {
        this.kanban?.onAddCard(this.columnId());
    }

    onHeaderContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const col = this.kanban?.columns().find(c => c.id === this.columnId());
        if (col) this.kanban?.showColumnContextMenu(event.clientX, event.clientY, col);
    }

    onDragEnter(event: DragEvent): void {
        if (!this.kanban?.draggedCardId()) return;
        event.preventDefault();
        this.dragEnterCount++;
        this.isDragOver.set(true);
    }

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

    onDragLeave(): void {
        this.dragEnterCount--;
        if (this.dragEnterCount <= 0) {
            this.dragEnterCount = 0;
            this.dropIndicatorIndex.set(-1);
            this.dropIndicatorTop.set(-1);
            this.isDragOver.set(false);
        }
    }

    onDrop(event: DragEvent): void {
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
