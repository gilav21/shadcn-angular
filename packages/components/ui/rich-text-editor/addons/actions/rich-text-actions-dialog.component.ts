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
    prefill: {
        def: RichTextActionDefinition; trigger: RichTextActionTrigger; params: ActionParams;
        /** Hover-trigger params, supplied when editing a combined `paramsMode:'separate'` action. */
        hoverParams?: ActionParams;
    } | null;
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
    /**
     * The full catalogue of registered actions. The picker shows only those
     * whose `targets` include the context's `targetKind` and that match the
     * search box, so passing every definition is correct — the dialog filters.
     */
    readonly definitions = input<RichTextActionDefinition[]>([]);
    /**
     * What the dialog is being opened for: create vs edit, the target kind, the
     * selected text (used in the title), which triggers are already taken (they
     * get a "replaces existing" hint and flip the confirm button to *Replace*),
     * and an optional `prefill` for edit mode. The prefill is applied ONCE — a
     * later change to it is ignored, so open a fresh dialog per edit.
     */
    readonly context = input.required<ActionsDialogContext>();
    /**
     * Translation bundle for every string the dialog renders, and the source of
     * the `dir="rtl"` flip on the dialog content. Defaults to English.
     */
    readonly locale = input<RichTextActionsLocale>(RICH_TEXT_ACTIONS_LOCALES['en']);

    readonly dir = computed<'rtl' | null>(() => (this.locale().rtl ? 'rtl' : null));
    readonly attachTitle = computed(() =>
        interpolate(this.locale().dialog.attachToText, { text: this.context().selectionText }));

    /**
     * The user accepted the form. Fires only while {@link canConfirm} holds, so
     * the payload's params are already valid. For a combined action it carries
     * `combinedParams` (both triggers) and `trigger: 'click'`; the caller must
     * branch on `combinedParams` rather than on `trigger`. The dialog does NOT
     * close itself — the host tears it down once the action actually applied.
     */
    readonly confirm = output<ActionsDialogConfirm>();
    /**
     * The user cancelled — Cancel button, or the dialog closing itself via
     * {@link onOpenChange}. The host owns the teardown.
     */
    readonly dismiss = output<void>();
    /**
     * A definition was selected in the picker, before any params are gathered.
     * The host uses this to validate the definition and to run a tier-3
     * `resolveParams` flow (driving the dialog through {@link setBusy}). Also
     * fires for the selection restored from `context.prefill`, since that goes
     * through {@link pickAction} exactly like a user click.
     */
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
        if (prefill.hoverParams) {
            this.hoverParams.set({ ...prefill.hoverParams });
            this.hoverValid.set(true);
        }
    }

    readonly confirmLabel = computed(() => {
        const dialog = this.locale().dialog;
        return this.isOccupied() ? dialog.replace : dialog.attach;
    });

    private isOccupied(): boolean {
        const occupied = this.occupiedByTrigger();
        if (this.isCombined()) return occupied.has('click') || occupied.has('hover');
        const trigger = this.selectedTrigger();
        return !!trigger && occupied.has(trigger);
    }

    /**
     * Select the definition with `id` and reset the form around it: pick the
     * initial trigger (the only one, `click` for a combined action, otherwise
     * none — forcing an explicit choice), seed the params from `context.prefill`
     * when the prefill is for this same action and clear them otherwise, and
     * reset validity to "already valid" unless the action needs a form. Emits
     * {@link pick}. An unknown `id` clears the selection without emitting.
     */
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

    /**
     * Freeze the picker list (pointer-events off + dimmed) while the host runs
     * an async tier-3 `resolveParams` flow it started from {@link pick}. Cancel
     * and the confirm button stay live; the host normally destroys the dialog
     * when the promise settles rather than clearing this.
     */
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

    /**
     * Choose which trigger the action attaches to. Bound to the radio group the
     * template shows only for a non-combined action with more than one trigger;
     * a combined action stays on `click` and writes both attributes instead.
     * Leaves the gathered params alone.
     */
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

    /**
     * Template-only handler for the generated tier-1 form's `paramsChange`.
     * These are the params emitted on {@link confirm} — and in combined +
     * `separate` mode specifically the *click* group; hover goes through
     * {@link onHoverParamsChange}.
     */
    onParamsChange(params: ActionParams): void {
        this.currentParams.set(params);
    }

    /**
     * Template-only handler for the generated form's `validChange`; gates the
     * confirm button. A tier-2 `formComponent` does not call this — its
     * validity is mirrored from the component instance's `valid()` signal.
     */
    onValidChange(valid: boolean): void {
        this.formValid.set(valid);
    }

    /**
     * Template-only handler for the second field group, rendered only for a
     * combined action in `paramsMode: 'separate'`. Feeds `combinedParams.hover`
     * on {@link confirm}; in `shared` mode this bucket is never touched and the
     * click params are cloned onto hover instead.
     */
    onHoverParamsChange(params: ActionParams): void {
        this.hoverParams.set(params);
    }

    /**
     * Template-only handler for the hover group's validity. Defaults to `true`
     * and only participates in the confirm gate under combined + `separate`, so
     * every other mode is unaffected by it.
     */
    onHoverValidChange(valid: boolean): void {
        this.hoverValid.set(valid);
    }

    /**
     * Build and emit the {@link confirm} payload. Re-checks `canConfirm` itself,
     * so calling it while the form is incomplete (or with no trigger chosen) is
     * a silent no-op rather than an invalid emit. Combined actions take the
     * `combinedParams` path; everything else emits the single selected trigger.
     */
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

    /**
     * Bridges the inner `ui-dialog`'s own close paths (backdrop click, Escape,
     * close button) onto {@link dismiss}. The dialog's `open` is bound to a
     * constant `true`, so opening is never signalled here — only `false`
     * matters, and it is forwarded rather than acted on: the host destroys the
     * component.
     */
    onOpenChange(open: boolean): void {
        if (!open) this.dismiss.emit();
    }
}
