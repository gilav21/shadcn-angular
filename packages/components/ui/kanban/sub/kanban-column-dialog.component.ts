import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    DialogComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogFooterComponent,
} from '../../dialog';
import { InputComponent } from '../../input';
import { ButtonComponent } from '../../button';
import { LabelComponent } from '../../label';
import { type KanbanLocale, KANBAN_LOCALES } from '../kanban-locales';
import { type KanbanColumn, type KanbanColumnDialogMode } from '../kanban.component';

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
    /** Accepted for API symmetry with the other kanban parts; the form renders inside the dialog overlay and these classes are not applied to any element. */
    class = input('');
    /** Translated strings for the title, field labels, placeholders and the submit button, all of which vary with the mode set by {@link openAddColumn} / {@link openRenameColumn} / {@link openSetWip}. */
    locale = input<KanbanLocale>(KANBAN_LOCALES['en']);

    /**
     * Emits the form values when the user submits, tagged with the `mode` the
     * dialog was opened in — `add-column` carries `name` (+ optional
     * `wipLimit`), the other two carry `columnId` plus whichever field that
     * mode showed. `name` is trimmed and `wipLimit` is normalised to a positive
     * integer or `undefined` (blank, zero, negative and non-numeric all mean
     * "no limit"). The dialog owns no board state — create, rename or re-cap the
     * column yourself from the payload. Cancelling emits nothing.
     */
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

    /** Opens the dialog empty in `add-column` mode, showing both the name and WIP-limit fields. Submit stays disabled until a non-blank name is typed. */
    openAddColumn(): void {
        this.mode.set('add-column');
        this.formName.set('');
        this.formWip.set('');
        this.editingColumnId.set('');
        this.dialogOpen.set(true);
    }

    /** Opens the dialog in `rename-column` mode prefilled with `column.title`, hiding the WIP field. {@link submitted} then carries the column's id, so the caller knows which one to rename; the column's existing `wipLimit` is untouched. */
    openRenameColumn(column: KanbanColumn): void {
        this.mode.set('rename-column');
        this.formName.set(column.title);
        this.formWip.set('');
        this.editingColumnId.set(column.id);
        this.dialogOpen.set(true);
    }

    /** Opens the dialog in `set-wip` mode prefilled with the column's current limit, hiding the name field. Submitting an empty or non-positive value clears the limit rather than rejecting it. */
    openSetWip(column: KanbanColumn): void {
        this.mode.set('set-wip');
        this.formName.set('');
        this.formWip.set(column.wipLimit?.toString() ?? '');
        this.editingColumnId.set(column.id);
        this.dialogOpen.set(true);
    }

    /** Emits {@link submitted} and closes. The typed WIP limit is parsed as an integer and normalized to `undefined` when blank, non-numeric or not positive, so zero and negatives can never reach the consumer. */
    onSubmit(): void {
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
