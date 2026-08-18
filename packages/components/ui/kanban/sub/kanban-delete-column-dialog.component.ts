import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    output,
    viewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import {
    AlertDialogComponent,
    AlertDialogContentComponent,
    AlertDialogHeaderComponent,
    AlertDialogTitleComponent,
    AlertDialogDescriptionComponent,
    AlertDialogFooterComponent,
    AlertDialogCancelComponent,
} from '../../alert-dialog';
import { ButtonComponent } from '../../button';
import { type KanbanLocale, KANBAN_LOCALES } from '../kanban-locales';
import { type KanbanColumn, type KanbanColumnDeleteEvent } from '../kanban.component';

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
    /** Accepted for API symmetry with the other kanban parts; the dialog renders into the alert-dialog overlay and does not apply these classes to any element. */
    class = input('');
    /**
     * Every column on the board, including the one being deleted. Drives the
     * "move the cards to…" choices (the column being deleted is filtered out).
     * When it holds a single column there is nowhere to move cards to, so the
     * picker is replaced by a warning that the cards will be permanently
     * deleted — the deletion itself is still allowed.
     */
    columns = input<KanbanColumn[]>([]);
    /** Translated strings for the title, the three description variants and the move/delete options. Set by `<ui-kanban>` from its own `locale`; only override when using the dialog standalone. */
    locale = input<KanbanLocale>(KANBAN_LOCALES['en']);

    /**
     * Emits once the user confirms, with `columnId` plus `moveCardsTo` — the
     * column the orphaned cards should go to, or `undefined` meaning "delete
     * the cards with the column". Nothing is deleted by this component: you own
     * the board arrays and must apply both the column removal and the card move
     * yourself. Cancelling emits nothing.
     */
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

    /** Classes for one "move cards to" option button, highlighting it as primary while it is the selected target. `undefined` is the "delete the cards too" option, not "nothing selected". */
    optionButtonClass(value: string | undefined): string {
        const isSelected = this.selectedTarget() === value;
        return cn(
            'text-left px-3 py-2 rounded-md border text-sm transition-colors',
            isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent'
        );
    }

    /**
     * Opens the confirmation for `column`, resetting any previously chosen move
     * target. `cardCount` is passed in rather than derived — it decides whether
     * the card-destination picker is shown at all, so pass the count *after*
     * any board filtering you consider authoritative.
     */
    open(column: KanbanColumn, cardCount: number): void {
        this.columnToDelete.set(column);
        this.cardsInColumn.set(cardCount);
        this.selectedTarget.set(undefined);
        this.alertDialogRef()?.show();
    }

    /** Destructive-button handler: emits {@link confirmed} for the column passed to {@link open} and closes the dialog. No-op if the dialog was never opened. */
    onConfirm(): void {
        const col = this.columnToDelete();
        if (!col) return;
        this.confirmed.emit({
            columnId: col.id,
            moveCardsTo: this.selectedTarget(),
        });
        this.alertDialogRef()?.hide();
    }
}
