import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
    DialogComponent, DialogContentComponent, DialogHeaderComponent,
    DialogTitleComponent, DialogFooterComponent,
} from '../../../dialog';
import { ButtonComponent } from '../../../button';
import { RichTextActionsFormComponent } from './rich-text-actions-form.component';
import type {
    ActionParams, ActionTargetKind, RichTextActionDefinition, RichTextActionTrigger,
} from './rich-text-actions.types';

/** The state the directive passes into the attach/edit dialog. */
export interface ActionsDialogContext {
    mode: 'create' | 'edit';
    targetKind: ActionTargetKind;
    selectionText: string;
    occupiedTriggers: RichTextActionTrigger[];
    prefill: { def: RichTextActionDefinition; trigger: RichTextActionTrigger; params: ActionParams } | null;
}

/** The confirmed attach/edit payload emitted to the directive. */
export interface ActionsDialogConfirm {
    def: RichTextActionDefinition;
    trigger: RichTextActionTrigger;
    params: ActionParams;
}

/** Attach/edit dialog: searchable action picker + generated tier-1 form. */
@Component({
    selector: 'ui-rich-text-actions-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DialogComponent, DialogContentComponent, DialogHeaderComponent,
        DialogTitleComponent, DialogFooterComponent, ButtonComponent, RichTextActionsFormComponent,
    ],
    templateUrl: './rich-text-actions-dialog.component.html',
    host: { '[attr.data-slot]': "'rich-text-actions-dialog'" },
})
export class RichTextActionsDialogComponent {
    readonly definitions = input<RichTextActionDefinition[]>([]);
    readonly context = input.required<ActionsDialogContext>();

    readonly confirm = output<ActionsDialogConfirm>();
    readonly dismiss = output<void>();
    readonly pick = output<RichTextActionDefinition>();

    readonly query = signal('');
    readonly selectedDef = signal<RichTextActionDefinition | null>(null);
    readonly selectedTrigger = signal<RichTextActionTrigger | null>(null);
    readonly currentParams = signal<ActionParams>({});
    readonly formValid = signal(false);

    readonly visibleDefs = computed(() => {
        const kind = this.context().targetKind;
        const q = this.query().toLowerCase();
        return this.definitions()
            .filter((d) => (d.targets ?? ['text', 'image']).includes(kind))
            .filter((d) => !q || d.label.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q));
    });

    readonly occupiedByTrigger = computed(() => new Set(this.context().occupiedTriggers));

    readonly canConfirm = computed(() => {
        const def = this.selectedDef();
        if (!def || !this.selectedTrigger()) return false;
        if (def.fields && def.fields.length > 0) return this.formValid();
        return true;
    });

    readonly confirmLabel = computed(() => {
        const trigger = this.selectedTrigger();
        return trigger && this.occupiedByTrigger().has(trigger) ? 'Replace' : 'Attach';
    });

    pickAction(id: string): void {
        const def = this.definitions().find((d) => d.id === id) ?? null;
        this.selectedDef.set(def);
        this.selectedTrigger.set(def && def.triggers.length === 1 ? def.triggers[0] : null);
        const prefill = this.context().prefill;
        this.currentParams.set(prefill && prefill.def.id === id ? { ...prefill.params } : {});
        this.formValid.set(!def?.fields || def.fields.length === 0);
        if (def) this.pick.emit(def);
    }

    selectTrigger(trigger: RichTextActionTrigger): void {
        this.selectedTrigger.set(trigger);
    }

    onParamsChange(params: ActionParams): void {
        this.currentParams.set(params);
    }

    onValidChange(valid: boolean): void {
        this.formValid.set(valid);
    }

    onConfirm(): void {
        const def = this.selectedDef();
        const trigger = this.selectedTrigger();
        if (!def || !trigger || !this.canConfirm()) return;
        this.confirm.emit({ def, trigger, params: this.currentParams() });
    }

    onOpenChange(open: boolean): void {
        if (!open) this.dismiss.emit();
    }
}
