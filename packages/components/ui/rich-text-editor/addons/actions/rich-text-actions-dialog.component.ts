import {
    ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal,
    viewChild, ViewContainerRef, computed, type ComponentRef,
} from '@angular/core';
import {
    DialogComponent, DialogContentComponent, DialogHeaderComponent,
    DialogTitleComponent, DialogFooterComponent,
} from '../../../dialog';
import { ButtonComponent } from '../../../button';
import { RichTextActionsFormComponent } from './rich-text-actions-form.component';
import type {
    ActionParams, ActionParamsMode, ActionTargetKind, RichTextActionDefinition,
    RichTextActionParamsForm, RichTextActionTrigger,
} from './rich-text-actions.types';
import { RICH_TEXT_ACTIONS_LOCALES, type RichTextActionsLocale } from './rich-text-actions.locales';
import { interpolate } from '../../../../lib/i18n';

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
    /** Present when `def.combined` — per-trigger params for both attributes. */
    combinedParams?: { click: ActionParams; hover: ActionParams };
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
    readonly locale = input<RichTextActionsLocale>(RICH_TEXT_ACTIONS_LOCALES['en']);

    readonly dir = computed<'rtl' | null>(() => (this.locale().rtl ? 'rtl' : null));
    readonly attachTitle = computed(() =>
        interpolate(this.locale().dialog.attachToText, { text: this.context().selectionText }));

    readonly confirm = output<ActionsDialogConfirm>();
    readonly dismiss = output<void>();
    readonly pick = output<RichTextActionDefinition>();

    readonly formHost = viewChild('formHost', { read: ViewContainerRef });

    readonly query = signal('');
    readonly selectedDef = signal<RichTextActionDefinition | null>(null);
    readonly selectedTrigger = signal<RichTextActionTrigger | null>(null);
    readonly currentParams = signal<ActionParams>({});
    readonly formValid = signal(false);

    readonly isCombined = computed(() => this.selectedDef()?.combined === true
        && (this.selectedDef()?.triggers.length ?? 0) >= 2);

    readonly paramsMode = computed<ActionParamsMode>(() => this.resolveParamsMode(this.selectedDef()));

    /** Second params bucket used only in combined + separate mode (hover group). */
    readonly hoverParams = signal<ActionParams>({});
    readonly hoverValid = signal(true);

    private readonly customForm = signal<ComponentRef<RichTextActionParamsForm> | null>(null);
    private renderedFormForDefId: string | null = null;

    readonly visibleDefs = computed(() => {
        const kind = this.context().targetKind;
        const q = this.query().toLowerCase();
        return this.definitions()
            .filter((d) => (d.targets ?? ['text', 'image']).includes(kind))
            .filter((d) => !q || d.label.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q));
    });

    readonly occupiedByTrigger = computed(() => new Set(this.context().occupiedTriggers));

    readonly busy = signal(false);

    readonly canConfirm = computed(() => {
        const def = this.selectedDef();
        if (!def || def.resolveParams) return false;
        if (this.isCombined()) {
            return this.paramsMode() === 'separate'
                ? this.formValid() && this.hoverValid()
                : this.formValid();
        }
        if (!this.selectedTrigger()) return false;
        if (def.formComponent || (def.fields && def.fields.length > 0)) return this.formValid();
        return true;
    });

    private prefillApplied = false;

    constructor() {
        effect(() => this.applyPrefill(this.context().prefill));
        effect(() => this.syncCustomForm(this.selectedDef(), this.formHost()));
        effect(() => {
            const ref = this.customForm();
            if (!ref) return;
            this.currentParams.set(ref.instance.params());
            this.formValid.set(ref.instance.valid());
        });
        inject(DestroyRef).onDestroy(() => this.destroyCustomForm());
    }

    private applyPrefill(prefill: ActionsDialogContext['prefill']): void {
        if (this.prefillApplied || !prefill) return;
        this.prefillApplied = true;
        this.pickAction(prefill.def.id);
        this.selectedTrigger.set(prefill.trigger);
        this.currentParams.set({ ...prefill.params });
        this.formValid.set(true);
    }

    readonly confirmLabel = computed(() => {
        const trigger = this.selectedTrigger();
        const dialog = this.locale().dialog;
        return trigger && this.occupiedByTrigger().has(trigger) ? dialog.replace : dialog.attach;
    });

    pickAction(id: string): void {
        const def = this.definitions().find((d) => d.id === id) ?? null;
        this.selectedDef.set(def);
        this.selectedTrigger.set(this.initialTrigger(def));
        const prefill = this.context().prefill;
        this.currentParams.set(prefill?.def.id === id ? { ...prefill.params } : {});
        this.hoverParams.set({});
        this.formValid.set(this.initialValidity(def));
        this.hoverValid.set(true);
        if (def) this.pick.emit(def);
    }

    /**
     * `separate` requires tier-1 `fieldsByTrigger` only — a `formComponent` or
     * `resolveParams` under `separate` is an unsupported combo (§14.3) and
     * silently falls back to `shared` so the dialog renders a working form
     * instead of two empty field groups.
     */
    private resolveParamsMode(def: RichTextActionDefinition | null): ActionParamsMode {
        if (!def?.combined || def.paramsMode !== 'separate') return 'shared';
        if (def.formComponent || def.resolveParams) return 'shared';
        return 'separate';
    }

    private initialTrigger(def: RichTextActionDefinition | null): RichTextActionTrigger | null {
        if (!def) return null;
        if (def.triggers.length === 1) return def.triggers[0];
        return def.combined ? 'click' : null;
    }

    private initialValidity(def: RichTextActionDefinition | null): boolean {
        if (!def) return false;
        if (def.formComponent) return false;
        return !def.fields || def.fields.length === 0;
    }

    setBusy(value: boolean): void {
        this.busy.set(value);
    }

    private syncCustomForm(def: RichTextActionDefinition | null, anchor: ViewContainerRef | undefined): void {
        const wantId = def?.formComponent && !def.resolveParams ? def.id : null;
        if (wantId === this.renderedFormForDefId) return;
        this.destroyCustomForm();
        this.renderedFormForDefId = null;
        if (!wantId || !def?.formComponent || !anchor) return;
        anchor.clear();
        const ref = anchor.createComponent(def.formComponent);
        ref.instance.context = {
            mode: this.context().mode, trigger: this.selectedTrigger() ?? def.triggers[0],
            currentParams: this.currentParams(), selectionText: this.context().selectionText,
            targetKind: this.context().targetKind, targetElement: null,
        };
        ref.instance.params.set({ ...this.currentParams() });
        this.customForm.set(ref);
        this.renderedFormForDefId = wantId;
    }

    private destroyCustomForm(): void {
        this.customForm()?.destroy();
        this.customForm.set(null);
    }

    selectTrigger(trigger: RichTextActionTrigger): void {
        this.selectedTrigger.set(trigger);
    }

    /** Localized display name for a single trigger. */
    triggerLabel(trigger: RichTextActionTrigger): string {
        return this.locale().triggers[trigger];
    }

    /** Localized, `/`-joined labels for a list of triggers. */
    triggerLabels(triggers: readonly RichTextActionTrigger[]): string {
        return triggers.map((t) => this.triggerLabel(t)).join(' / ');
    }

    onParamsChange(params: ActionParams): void {
        this.currentParams.set(params);
    }

    onValidChange(valid: boolean): void {
        this.formValid.set(valid);
    }

    onHoverParamsChange(params: ActionParams): void {
        this.hoverParams.set(params);
    }

    onHoverValidChange(valid: boolean): void {
        this.hoverValid.set(valid);
    }

    onConfirm(): void {
        const def = this.selectedDef();
        if (!def || !this.canConfirm()) return;
        if (this.isCombined()) {
            this.confirmCombined(def);
            return;
        }
        const trigger = this.selectedTrigger();
        if (!trigger) return;
        this.confirm.emit({ def, trigger, params: this.currentParams() });
    }

    private confirmCombined(def: RichTextActionDefinition): void {
        const shared = this.currentParams();
        const combinedParams = this.paramsMode() === 'separate'
            ? { click: shared, hover: this.hoverParams() }
            : { click: shared, hover: { ...shared } };
        this.confirm.emit({ def, trigger: 'click', params: shared, combinedParams });
    }

    onOpenChange(open: boolean): void {
        if (!open) this.dismiss.emit();
    }
}
