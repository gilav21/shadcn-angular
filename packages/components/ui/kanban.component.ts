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
    ElementRef,
    ViewChild,
    viewChild,
    OnDestroy,
    untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../lib/utils';
import { BadgeComponent } from './badge';
import { AvatarComponent } from './avatar.component';
import { ScrollAreaComponent } from './scroll-area';
import { SeparatorComponent } from './separator';
import { ButtonComponent } from './button';
import { InputComponent } from './input';
import { TextareaComponent } from './textarea';
import { LabelComponent } from './label';
import { ChipListComponent } from './chip-list';
import { AutocompleteComponent } from './autocomplete';
import {
    DialogComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogFooterComponent,
} from './dialog.component';
import {
    AlertDialogComponent,
    AlertDialogContentComponent,
    AlertDialogHeaderComponent,
    AlertDialogTitleComponent,
    AlertDialogDescriptionComponent,
    AlertDialogFooterComponent,
    AlertDialogCancelComponent,
} from './alert-dialog.component';
import {
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSeparatorComponent,
    ContextMenuSubComponent,
    ContextMenuSubTriggerComponent,
    ContextMenuSubContentComponent,
} from './context-menu.component';
import { ShortcutBindingService, ShortcutComponentHandle } from '../lib/shortcut-binding.service';
import { type KanbanLocale, KANBAN_LOCALES } from './kanban-locales';

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

const LABEL_PRESETS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

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

    private readonly _hasCustomContent = signal(false);
    hasCustomContent = this._hasCustomContent.asReadonly();

    ngAfterContentInit() {
        this._hasCustomContent.set(this.customContentChildren.length > 0);
    }

    private readonly priorityBorder = computed(() => {
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

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        const c = this.card();
        if (c) {
            this.kanban?.showCardContextMenu(event.clientX, event.clientY, c);
        }
    }
}

// ────────────────────────────────────────────────────────────────
// KanbanCardDialogComponent — add/edit card dialog
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban-card-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DialogComponent, DialogContentComponent, DialogHeaderComponent,
        DialogTitleComponent, DialogFooterComponent, InputComponent,
        TextareaComponent, ButtonComponent, LabelComponent, FormsModule,
        ChipListComponent, AutocompleteComponent,
    ],
    template: `
        <ui-dialog [(open)]="dialogOpen">
            <ui-dialog-content>
                <ui-dialog-header>
                    <ui-dialog-title>{{ mode() === 'add' ? locale().addCard : locale().editCard }}</ui-dialog-title>
                </ui-dialog-header>
                <div class="space-y-4" data-slot="kanban-card-dialog-form">
                    <div class="space-y-2">
                        <ui-label>{{ locale().titleRequired }}</ui-label>
                        <ui-input
                            [placeholder]="locale().cardTitlePlaceholder"
                            [ngModel]="formTitle()"
                            (ngModelChange)="formTitle.set($event)" />
                    </div>
                    <div class="space-y-2">
                        <ui-label>{{ locale().descriptionLabel }}</ui-label>
                        <ui-textarea
                            [placeholder]="locale().optionalDescriptionPlaceholder"
                            [rows]="3"
                            [ngModel]="formDescription()"
                            (ngModelChange)="formDescription.set($event)" />
                    </div>
                    <div class="space-y-2">
                        <ui-label>{{ locale().priorityLabel }}</ui-label>
                        <div class="flex flex-wrap gap-1.5">
                            @for (p of localizedPriorityOptions(); track p.value) {
                                <button
                                    type="button"
                                    [class]="priorityButtonClass(p.value)"
                                    (click)="formPriority.set(p.value === 'none' ? undefined : p.value)">
                                    {{ p.label }}
                                </button>
                            }
                        </div>
                    </div>
                    @if (haveLabels()) {
                        <div class="space-y-2">
                            <ui-label>{{ locale().labelsLabel }}</ui-label>
                            <ui-chip-list
                                [chipColors]="labelColorMap()"
                                [maxRows]="3"
                                [placeholder]="locale().labelTextPlaceholder"
                                [ngModel]="labelChipStrings()"
                                (chipAdded)="onLabelChipAdded($event)"
                                (chipRemoved)="onLabelChipRemoved($event)"
                            />
                            <div class="flex gap-1.5 items-center">
                                <span class="text-xs text-muted-foreground ltr:mr-1 rtl:ml-1">{{ locale().labelsLabel }}:</span>
                                @for (color of labelPresets; track color) {
                                    <button
                                        type="button"
                                        class="h-5 w-5 rounded-full border border-border shrink-0 transition-transform hover:scale-110"
                                        [class.ring-2]="newLabelColor() === color"
                                        [class.ring-offset-1]="newLabelColor() === color"
                                        [style.backgroundColor]="color"
                                        (click)="newLabelColor.set(color)">
                                    </button>
                                }
                            </div>
                        </div>
                    }
                    @if (haveAssignees()) {
                        <div class="space-y-2">
                            <ui-label>{{ locale().assigneesLabel }}</ui-label>
                            @if (assigneeOptions().length > 0) {
                                <ui-autocomplete
                                    [options]="assigneeOptionNames()"
                                    [multiple]="true"
                                    [placeholder]="locale().assigneePlaceholder"
                                    [ngModel]="assigneeChipStrings()"
                                    (ngModelChange)="onAssigneeSelectionChange($event)"
                                />
                            } @else {
                                <ui-chip-list
                                    [placeholder]="locale().assigneePlaceholder"
                                    [ngModel]="assigneeChipStrings()"
                                    (chipAdded)="onAssigneeChipAdded($event)"
                                    (chipRemoved)="onAssigneeChipRemoved($event)"
                                />
                            }
                        </div>
                    }
                </div>
                <ui-dialog-footer>
                    <ui-button variant="outline" (clicked)="dialogOpen.set(false)">{{ locale().cancel }}</ui-button>
                    <ui-button [disabled]="!formTitle().trim()" (clicked)="onSubmit()">
                        {{ mode() === 'add' ? locale().addCard : locale().saveChanges }}
                    </ui-button>
                </ui-dialog-footer>
            </ui-dialog-content>
        </ui-dialog>
    `,
    host: { class: 'contents' },
})
export class KanbanCardDialogComponent {
    class = input('');
    locale = input<KanbanLocale>(KANBAN_LOCALES['en']);
    haveLabels = input(true);
    haveAssignees = input(true);
    assigneeOptions = input<{ name: string; avatar?: string }[]>([]);

    submitted = output<{
        mode: 'add' | 'edit';
        columnId: string;
        card?: KanbanCard;
        data: KanbanCardAddEvent;
    }>();

    dialogOpen = signal(false);
    mode = signal<'add' | 'edit'>('add');
    formTitle = signal('');
    formDescription = signal('');
    formPriority = signal<KanbanCard['priority'] | undefined>(undefined);
    formLabels = signal<{ text: string; color: string }[]>([]);
    formAssignees = signal<{ name: string; avatar?: string }[]>([]);
    newLabelColor = signal(LABEL_PRESETS[0]);

    private readonly editingCard = signal<KanbanCard | undefined>(undefined);
    private readonly targetColumnId = signal('');

    readonly labelPresets = LABEL_PRESETS;

    localizedPriorityOptions = computed(() => {
        const l = this.locale();
        return [
            { label: l.priorityLow, value: 'low' as const },
            { label: l.priorityMedium, value: 'medium' as const },
            { label: l.priorityHigh, value: 'high' as const },
            { label: l.priorityUrgent, value: 'urgent' as const },
            { label: l.priorityNone, value: 'none' as const },
        ];
    });

    labelChipStrings = computed(() => this.formLabels().map(l => l.text));

    labelColorMap = computed(() => {
        const map: Record<string, string> = {};
        for (const label of this.formLabels()) {
            map[label.text] = label.color;
        }
        return map;
    });

    assigneeChipStrings = computed(() => this.formAssignees().map(a => a.name));

    assigneeOptionNames = computed(() => this.assigneeOptions().map(a => a.name));

    open(mode: 'add' | 'edit', columnId: string, card?: KanbanCard) {
        this.mode.set(mode);
        this.targetColumnId.set(columnId);
        this.editingCard.set(card);
        this.formTitle.set(card?.title ?? '');
        this.formDescription.set(card?.description ?? '');
        this.formPriority.set(card?.priority);
        this.formLabels.set(card?.labels ? [...card.labels] : []);
        this.formAssignees.set(card?.assignees ? [...card.assignees] : []);
        this.newLabelColor.set(LABEL_PRESETS[0]);
        this.dialogOpen.set(true);
    }

    priorityButtonClass(value: KanbanCard['priority'] | 'none'): string {
        const isSelected = (value === 'none' && !this.formPriority())
            || value === this.formPriority();
        return cn(
            'inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors',
            isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent'
        );
    }

    onLabelChipAdded(text: string) {
        this.formLabels.update(labels => [...labels, { text, color: this.newLabelColor() }]);
    }

    onLabelChipRemoved(text: string) {
        this.formLabels.update(labels => labels.filter(l => l.text !== text));
    }

    onAssigneeChipAdded(name: string) {
        const option = this.assigneeOptions().find(a => a.name === name);
        this.formAssignees.update(assignees => [...assignees, option ?? { name }]);
    }

    onAssigneeChipRemoved(name: string) {
        this.formAssignees.update(assignees => assignees.filter(a => a.name !== name));
    }

    onAssigneeSelectionChange(names: string[]) {
        const newAssignees = names.map(name => {
            const existing = this.formAssignees().find(a => a.name === name);
            if (existing) return existing;
            const option = this.assigneeOptions().find(a => a.name === name);
            return option ?? { name };
        });
        this.formAssignees.set(newAssignees);
    }

    onSubmit() {
        const title = this.formTitle().trim();
        if (!title) return;

        this.submitted.emit({
            mode: this.mode(),
            columnId: this.targetColumnId(),
            card: this.editingCard(),
            data: {
                columnId: this.targetColumnId(),
                title,
                description: this.formDescription().trim() || undefined,
                priority: this.formPriority(),
                labels: this.formLabels().length > 0 ? this.formLabels() : undefined,
                assignees: this.formAssignees().length > 0 ? this.formAssignees() : undefined,
            },
        });
        this.dialogOpen.set(false);
    }
}

// ────────────────────────────────────────────────────────────────
// KanbanColumnDialogComponent — add/rename column, set WIP limit
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban-column-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DialogComponent, DialogContentComponent, DialogHeaderComponent,
        DialogTitleComponent, DialogFooterComponent, InputComponent,
        ButtonComponent, LabelComponent, FormsModule,
    ],
    template: `
        <ui-dialog [(open)]="dialogOpen">
            <ui-dialog-content>
                <ui-dialog-header>
                    <ui-dialog-title>{{ dialogTitle() }}</ui-dialog-title>
                </ui-dialog-header>
                <div class="space-y-4" data-slot="kanban-column-dialog-form">
                    @if (showNameField()) {
                        <div class="space-y-2">
                            <ui-label>{{ locale().columnNameLabel }}</ui-label>
                            <ui-input
                                [placeholder]="locale().columnNamePlaceholder"
                                [ngModel]="formName()"
                                (ngModelChange)="formName.set($event)" />
                        </div>
                    }
                    @if (showWipField()) {
                        <div class="space-y-2">
                            <ui-label>{{ locale().wipLimitLabel }}</ui-label>
                            <ui-input
                                type="number"
                                [placeholder]="locale().noLimitPlaceholder"
                                [ngModel]="formWip()"
                                (ngModelChange)="formWip.set($event)" />
                        </div>
                    }
                </div>
                <ui-dialog-footer>
                    <ui-button variant="outline" (clicked)="dialogOpen.set(false)">{{ locale().cancel }}</ui-button>
                    <ui-button [disabled]="!canSubmit()" (clicked)="onSubmit()">{{ submitLabel() }}</ui-button>
                </ui-dialog-footer>
            </ui-dialog-content>
        </ui-dialog>
    `,
    host: { class: 'contents' },
})
export class KanbanColumnDialogComponent {
    class = input('');
    locale = input<KanbanLocale>(KANBAN_LOCALES['en']);

    submitted = output<{
        mode: KanbanColumnDialogMode;
        name?: string;
        wipLimit?: number;
        columnId?: string;
    }>();

    dialogOpen = signal(false);
    mode = signal<KanbanColumnDialogMode>('add-column');
    formName = signal('');
    formWip = signal('');
    private readonly editingColumnId = signal('');

    dialogTitle = computed(() => {
        const m = this.mode();
        const l = this.locale();
        if (m === 'add-column') return l.addColumn;
        if (m === 'rename-column') return l.renameColumn;
        return l.setWipLimit;
    });

    submitLabel = computed(() => {
        const m = this.mode();
        const l = this.locale();
        if (m === 'add-column') return l.addColumn;
        if (m === 'rename-column') return l.rename;
        return l.setLimit;
    });

    showNameField = computed(() =>
        this.mode() === 'add-column' || this.mode() === 'rename-column'
    );

    showWipField = computed(() =>
        this.mode() === 'add-column' || this.mode() === 'set-wip'
    );

    canSubmit = computed(() => {
        if (this.showNameField()) return this.formName().trim().length > 0;
        return true;
    });

    openAddColumn() {
        this.mode.set('add-column');
        this.formName.set('');
        this.formWip.set('');
        this.editingColumnId.set('');
        this.dialogOpen.set(true);
    }

    openRenameColumn(column: KanbanColumn) {
        this.mode.set('rename-column');
        this.formName.set(column.title);
        this.formWip.set('');
        this.editingColumnId.set(column.id);
        this.dialogOpen.set(true);
    }

    openSetWip(column: KanbanColumn) {
        this.mode.set('set-wip');
        this.formName.set('');
        this.formWip.set(column.wipLimit?.toString() ?? '');
        this.editingColumnId.set(column.id);
        this.dialogOpen.set(true);
    }

    onSubmit() {
        const wipVal = Number.parseInt(this.formWip(), 10);
        this.submitted.emit({
            mode: this.mode(),
            name: this.formName().trim() || undefined,
            wipLimit: Number.isNaN(wipVal) || wipVal <= 0 ? undefined : wipVal,
            columnId: this.editingColumnId() || undefined,
        });
        this.dialogOpen.set(false);
    }
}

// ────────────────────────────────────────────────────────────────
// KanbanDeleteColumnDialogComponent — confirm column deletion
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban-delete-column-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AlertDialogComponent, AlertDialogContentComponent,
        AlertDialogHeaderComponent, AlertDialogTitleComponent,
        AlertDialogDescriptionComponent, AlertDialogFooterComponent,
        AlertDialogCancelComponent, ButtonComponent,
    ],
    template: `
        <ui-alert-dialog #alertDialog>
            <ui-alert-dialog-content>
                <ui-alert-dialog-header>
                    <ui-alert-dialog-title>{{ locale().deleteColumn }}</ui-alert-dialog-title>
                    <ui-alert-dialog-description>
                        @if (isLastColumn()) {
                            {{ locale().lastColumnWarning }}
                        } @else if (cardCount() > 0) {
                            {{ locale().columnHasCards }}
                        } @else {
                            {{ locale().deleteEmptyColumn }}
                        }
                    </ui-alert-dialog-description>
                </ui-alert-dialog-header>
                @if (!isLastColumn() && cardCount() > 0) {
                    <div class="space-y-3 py-2" data-slot="kanban-delete-column-options">
                        <div class="flex flex-col gap-2">
                            @for (option of moveOptions(); track $index) {
                                <button
                                    type="button"
                                    [class]="optionButtonClass(option.value)"
                                    (click)="selectedTarget.set(option.value)">
                                    {{ option.label }}
                                </button>
                            }
                        </div>
                    </div>
                }
                <ui-alert-dialog-footer>
                    <ui-alert-dialog-cancel>{{ locale().cancel }}</ui-alert-dialog-cancel>
                    <ui-button
                        variant="destructive"
                        [disabled]="!canConfirm()"
                        (clicked)="onConfirm()">
                        {{ locale().deleteColumn }}
                    </ui-button>
                </ui-alert-dialog-footer>
            </ui-alert-dialog-content>
        </ui-alert-dialog>
    `,
    host: { class: 'contents' },
})
export class KanbanDeleteColumnDialogComponent {
    class = input('');
    columns = input<KanbanColumn[]>([]);
    locale = input<KanbanLocale>(KANBAN_LOCALES['en']);

    confirmed = output<KanbanColumnDeleteEvent>();

    private readonly columnToDelete = signal<KanbanColumn | undefined>(undefined);
    private readonly cardsInColumn = signal(0);
    selectedTarget = signal<string | undefined>(undefined);

    alertDialogRef = viewChild<AlertDialogComponent>('alertDialog');

    cardCount = computed(() => this.cardsInColumn());
    isLastColumn = computed(() => this.columns().length <= 1);

    moveOptions = computed(() => {
        const delCol = this.columnToDelete();
        if (!delCol) return [];
        const l = this.locale();
        const others = this.columns().filter(c => c.id !== delCol.id);
        const options: { label: string; value: string | undefined }[] =
            others.map(c => ({ label: `${l.moveToColumn} "${c.title}"`, value: c.id }));
        options.push({ label: l.deleteAllCards, value: undefined });
        return options;
    });

    canConfirm = computed(() => {
        if (this.isLastColumn()) return true;
        if (this.cardCount() === 0) return true;
        return this.selectedTarget() !== undefined
            || this.moveOptions().some(o => o.value === undefined);
    });

    optionButtonClass(value: string | undefined): string {
        const isSelected = this.selectedTarget() === value;
        return cn(
            'text-left px-3 py-2 rounded-md border text-sm transition-colors',
            isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent'
        );
    }

    open(column: KanbanColumn, cardCount: number) {
        this.columnToDelete.set(column);
        this.cardsInColumn.set(cardCount);
        this.selectedTarget.set(undefined);
        this.alertDialogRef()?.show();
    }

    onConfirm() {
        const col = this.columnToDelete();
        if (!col) return;
        this.confirmed.emit({
            columnId: col.id,
            moveCardsTo: this.selectedTarget(),
        });
        this.alertDialogRef()?.hide();
    }
}

// ────────────────────────────────────────────────────────────────
// KanbanColumnComponent — column with header, WIP, collapse, drop
// ────────────────────────────────────────────────────────────────

@Component({
    selector: 'ui-kanban-column',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent, SeparatorComponent, ScrollAreaComponent, KanbanCardComponent, ButtonComponent],
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
        'bg-muted/50 rounded-lg border flex flex-col w-[260px] sm:w-[300px] min-w-[240px] sm:min-w-[280px] sm:max-w-[350px] shrink-0',
        'transition-colors duration-200',
        this.isOverWipLimit() ? 'border-destructive/50' : '',
        this.isDragOver() ? 'border-primary/50 bg-accent/30 ring-1 ring-primary/20' : '',
        this.class()
    ));

    toggleCollapse() {
        this.collapsed.update(v => !v);
    }

    onAddCard() {
        this.kanban?.onAddCard(this.columnId());
    }

    onHeaderContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        const col = this.kanban?.columns().find(c => c.id === this.columnId());
        if (col) this.kanban?.showColumnContextMenu(event.clientX, event.clientY, col);
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
            const last = cards.at(-1)!;
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
    imports: [
        KanbanColumnComponent,
        KanbanCardDialogComponent,
        KanbanColumnDialogComponent,
        KanbanDeleteColumnDialogComponent,
        ContextMenuComponent, ContextMenuContentComponent, ContextMenuItemComponent,
        ContextMenuSeparatorComponent, ContextMenuSubComponent,
        ContextMenuSubTriggerComponent, ContextMenuSubContentComponent,
        ButtonComponent,
    ],
    providers: [{ provide: KANBAN, useExisting: forwardRef(() => KanbanComponent) }],
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
                    <ui-context-menu-item (click)="onEditCard(cardMenu.data())">
                        {{ resolvedLocale().editCardMenu }}
                    </ui-context-menu-item>
                    <ui-context-menu-item (click)="onDuplicateCard(cardMenu.data())">
                        {{ resolvedLocale().duplicateCard }}
                    </ui-context-menu-item>
                    <ui-context-menu-sub>
                        <ui-context-menu-sub-trigger>{{ resolvedLocale().moveTo }}</ui-context-menu-sub-trigger>
                        <ui-context-menu-sub-content>
                            @for (col of sortedColumns(); track col.id) {
                                <ui-context-menu-item
                                    [disabled]="col.id === cardMenu.data()?.columnId"
                                    (click)="onMoveCardToColumn(cardMenu.data(), col.id)">
                                    {{ col.title }}
                                </ui-context-menu-item>
                            }
                        </ui-context-menu-sub-content>
                    </ui-context-menu-sub>
                    <ui-context-menu-sub>
                        <ui-context-menu-sub-trigger>{{ resolvedLocale().setPriority }}</ui-context-menu-sub-trigger>
                        <ui-context-menu-sub-content>
                            @for (p of localizedPriorityOptions(); track p.value) {
                                <ui-context-menu-item (click)="onSetCardPriority(cardMenu.data(), p.value)">
                                    {{ p.label }}
                                </ui-context-menu-item>
                            }
                        </ui-context-menu-sub-content>
                    </ui-context-menu-sub>
                    <ui-context-menu-separator />
                    <ui-context-menu-item variant="destructive" (click)="onDeleteCard(cardMenu.data())">
                        {{ resolvedLocale().deleteCardMenu }}
                    </ui-context-menu-item>
                </ui-context-menu-content>
            </ui-context-menu>

            <!-- Column Context Menu -->
            <ui-context-menu #columnMenu>
                <ui-context-menu-content class="w-52">
                    <ui-context-menu-item (click)="onAddCard(columnMenu.data()?.id)">
                        {{ resolvedLocale().addCardMenu }}
                    </ui-context-menu-item>
                    <ui-context-menu-separator />
                    <ui-context-menu-item (click)="onRenameColumn(columnMenu.data())">
                        {{ resolvedLocale().renameColumnMenu }}
                    </ui-context-menu-item>
                    <ui-context-menu-item (click)="onSetWipLimit(columnMenu.data())">
                        {{ resolvedLocale().setWipLimitMenu }}
                    </ui-context-menu-item>
                    <ui-context-menu-separator />
                    <ui-context-menu-item
                        [disabled]="isFirstColumn(columnMenu.data())"
                        (click)="onMoveColumnLeft(columnMenu.data())">
                        {{ resolvedLocale().moveLeft }}
                    </ui-context-menu-item>
                    <ui-context-menu-item
                        [disabled]="isLastColumnCheck(columnMenu.data())"
                        (click)="onMoveColumnRight(columnMenu.data())">
                        {{ resolvedLocale().moveRight }}
                    </ui-context-menu-item>
                    <ui-context-menu-separator />
                    <ui-context-menu-item variant="destructive" (click)="onDeleteColumn(columnMenu.data())">
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
    locale = input<string | KanbanLocale>('en');
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

    @ContentChildren(forwardRef(() => KanbanColumnComponent)) customColumnChildren!: QueryList<KanbanColumnComponent>;

    private readonly cardMenuRef = viewChild<ContextMenuComponent>('cardMenu');
    private readonly columnMenuRef = viewChild<ContextMenuComponent>('columnMenu');
    private readonly boardMenuRef = viewChild<ContextMenuComponent>('boardMenu');
    private readonly cardDialogRef = viewChild(KanbanCardDialogComponent);
    private readonly columnDialogRef = viewChild(KanbanColumnDialogComponent);
    private readonly deleteColumnDialogRef = viewChild(KanbanDeleteColumnDialogComponent);

    private readonly _hasCustomColumns = signal(false);
    hasCustomColumns = this._hasCustomColumns.asReadonly();

    resolvedLocale = computed((): KanbanLocale => {
        const loc = this.locale();
        if (typeof loc === 'string') {
            return KANBAN_LOCALES[loc] ?? KANBAN_LOCALES['en'];
        }
        return loc;
    });

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
                this.rtl.set(loc.rtl);
            });
        });
    }

    ngAfterContentInit() {
        this._hasCustomColumns.set(this.customColumnChildren.length > 0);
    }

    ngOnDestroy() {
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

    // ── Drag & Drop ──────────────────────────────────────────────

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

    showCardContextMenu(x: number, y: number, card: KanbanCard) {
        this.cardMenuRef()?.show(x, y, card);
    }

    showColumnContextMenu(x: number, y: number, column: KanbanColumn) {
        this.columnMenuRef()?.show(x, y, column);
    }

    onBoardContextMenu(event: MouseEvent) {
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
        return sorted.length === 0 || sorted.at(-1)!.id === column.id;
    }

    // ── Card Actions ─────────────────────────────────────────────

    onAddCard(columnId?: string) {
        if (!columnId) return;
        this.cardDialogRef()?.open('add', columnId);
    }

    onEditCard(card: KanbanCard | undefined) {
        if (!card) return;
        this.cardDialogRef()?.open('edit', card.columnId, card);
    }

    onDuplicateCard(card: KanbanCard | undefined) {
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

    onMoveCardToColumn(card: KanbanCard | undefined, targetColumnId: string) {
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

    onSetCardPriority(card: KanbanCard | undefined, priority: KanbanCard['priority'] | 'none') {
        if (!card) return;
        this.captureSnapshot();
        this.cardUpdated.emit({
            ...card,
            priority: priority === 'none' ? undefined : priority,
        });
    }

    onDeleteCard(card: KanbanCard | undefined) {
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

    undoCardDelete() {
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

    dismissDeleteToast() {
        this.deleteToastVisible.set(false);
        for (const [cardId, pending] of this.pendingDeletes.entries()) {
            clearTimeout(pending.timeoutId);
            clearInterval(pending.countdownIntervalId);
            this.pendingDeletes.delete(cardId);
            this.cardDeleted.emit(cardId);
        }
    }

    // ── Column Actions ───────────────────────────────────────────

    onAddColumn() {
        this.columnDialogRef()?.openAddColumn();
    }

    onRenameColumn(column: KanbanColumn | undefined) {
        if (!column) return;
        this.columnDialogRef()?.openRenameColumn(column);
    }

    onSetWipLimit(column: KanbanColumn | undefined) {
        if (!column) return;
        this.columnDialogRef()?.openSetWip(column);
    }

    onMoveColumnLeft(column: KanbanColumn | undefined) {
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

    onMoveColumnRight(column: KanbanColumn | undefined) {
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

    onDeleteColumn(column: KanbanColumn | undefined) {
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
    }) {
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
    }) {
        this.captureSnapshot();
        if (event.mode === 'add-column') {
            this.columnAdded.emit({
                title: event.name!,
                wipLimit: event.wipLimit,
                order: this.columns().length,
            });
        } else if (event.mode === 'rename-column' && event.columnId) {
            const existing = this.columns().find(c => c.id === event.columnId);
            if (existing) {
                this.columnUpdated.emit({ ...existing, title: event.name! });
            }
        } else if (event.mode === 'set-wip' && event.columnId) {
            const existing = this.columns().find(c => c.id === event.columnId);
            if (existing) {
                this.columnUpdated.emit({ ...existing, wipLimit: event.wipLimit });
            }
        }
    }

    onDeleteColumnConfirmed(event: KanbanColumnDeleteEvent) {
        this.captureSnapshot();
        this.columnDeleted.emit(event);
    }

    // ── History System ───────────────────────────────────────────

    private captureSnapshot() {
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

    undo() {
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

    redo() {
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

    private emitHistoryState() {
        this.historyChange.emit({
            canUndo: this.undoStack.length > 0,
            canRedo: this.redoStack.length > 0,
        });
    }

    private cancelAllPendingDeletes() {
        for (const [, pending] of this.pendingDeletes.entries()) {
            clearTimeout(pending.timeoutId);
            clearInterval(pending.countdownIntervalId);
        }
        this.pendingDeletes.clear();
        this.deleteToastVisible.set(false);
    }
}
