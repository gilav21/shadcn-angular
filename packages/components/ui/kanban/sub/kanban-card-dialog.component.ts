import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../../../lib/utils';
import { ButtonComponent } from '../../button';
import { InputComponent } from '../../input';
import { TextareaComponent } from '../../textarea';
import { LabelComponent } from '../../label';
import { ChipListComponent } from '../../chip-list';
import { AutocompleteComponent } from '../../autocomplete';
import {
    DialogComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogFooterComponent,
} from '../../dialog';
import { type KanbanLocale, KANBAN_LOCALES } from '../kanban-locales';
import { type KanbanCard, type KanbanCardAddEvent } from '../kanban.component';

const LABEL_PRESETS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

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

    open(mode: 'add' | 'edit', columnId: string, card?: KanbanCard): void {
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

    onLabelChipAdded(text: string): void {
        this.formLabels.update(labels => [...labels, { text, color: this.newLabelColor() }]);
    }

    onLabelChipRemoved(text: string): void {
        this.formLabels.update(labels => labels.filter(l => l.text !== text));
    }

    onAssigneeChipAdded(name: string): void {
        const option = this.assigneeOptions().find(a => a.name === name);
        this.formAssignees.update(assignees => [...assignees, option ?? { name }]);
    }

    onAssigneeChipRemoved(name: string): void {
        this.formAssignees.update(assignees => assignees.filter(a => a.name !== name));
    }

    onAssigneeSelectionChange(names: string[]): void {
        const newAssignees = names.map(name => {
            const existing = this.formAssignees().find(a => a.name === name);
            if (existing) return existing;
            const option = this.assigneeOptions().find(a => a.name === name);
            return option ?? { name };
        });
        this.formAssignees.set(newAssignees);
    }

    onSubmit(): void {
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
