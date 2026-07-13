import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    ContentChildren,
    QueryList,
    AfterContentInit,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { readableForeground } from '../../../lib/color';
import { BadgeComponent } from '../../badge';
import { AvatarComponent } from '../../avatar';
import { KANBAN } from '../kanban.component';
import { KANBAN_COLUMN } from './kanban-column.component';
import { KanbanCardContentComponent } from './kanban-card-content.component';
import { type KanbanCard } from '../kanban.component';

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
            (contextmenu)="onContextMenu($event)"
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
                                    [style.color]="labelForeground(label.color)"
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

    private readonly _hasCustomContent = signal(false);
    hasCustomContent = this._hasCustomContent.asReadonly();

    ngAfterContentInit(): void {
        this._hasCustomContent.set(this.customContentChildren.length > 0);
    }

    private readonly priorityBorder = computed(() => {
        const p = this.card()?.priority;
        if (p === 'low') return 'border-s-green-500';
        if (p === 'medium') return 'border-s-yellow-500';
        if (p === 'high') return 'border-s-orange-500';
        if (p === 'urgent') return 'border-s-red-500';
        return '';
    });

    /**
     * Legible text colour for a label badge painted in the caller's `label.color`.
     * A hardcoded white failed WCAG AA on light label colours (axe `color-contrast`).
     */
    labelForeground(color: string): string {
        return readableForeground(color);
    }

    classes = computed(() => cn(
        'bg-card text-card-foreground rounded-lg border shadow-sm cursor-grab active:cursor-grabbing',
        'transition-all duration-200 hover:shadow-md',
        this.card()?.priority ? 'border-s-[3px]' : '',
        this.priorityBorder(),
        this.kanban?.draggedCardId() === this.resolvedCardId()
            ? 'opacity-50 scale-[0.98] shadow-lg ring-2 ring-primary/20'
            : '',
        this.class()
    ));

    private resolvedCardId(): string {
        return this.cardId() || this.card()?.id || '';
    }

    onDragStart(event: DragEvent): void {
        const id = this.resolvedCardId();
        const colId = this.column?.columnId() || this.card()?.columnId || '';
        if (!event.dataTransfer || !id) return;

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
        this.kanban?.startDrag(id, colId);
    }

    onDragEnd(): void {
        this.kanban?.endDrag();
    }

    onContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const c = this.card();
        if (c) {
            this.kanban?.showCardContextMenu(event.clientX, event.clientY, c);
        }
    }
}
