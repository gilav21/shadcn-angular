import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { ActionParams, RichTextActionField } from './rich-text-actions.types';
import { interpolate } from '../../../../lib/i18n';

/** Renders declarative action fields (tier 1) and emits params + validity. */
@Component({
    selector: 'ui-rich-text-actions-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-actions-form.component.html',
    host: { class: 'block', '[attr.data-slot]': "'rich-text-actions-form'" },
})
export class RichTextActionsFormComponent {
    /**
     * Conventional style hook. The form's own markup carries fixed layout
     * classes and does not consume this value, so styling it from the outside
     * means targeting the `block` host element or `data-slot`.
     */
    readonly class = input('');
    /**
     * The tier-1 field descriptors to render, in order — one control each,
     * chosen by `field.type` (textarea / checkbox / select / number / text).
     * An empty list renders nothing and is trivially valid.
     */
    readonly fields = input<RichTextActionField[]>([]);
    /**
     * Initial values, keyed by `field.key`. Copied into internal state on every
     * change, so pushing a new object back in response to
     * {@link paramsChange} would clobber what the user is typing — treat it as
     * a seed, not two-way binding. Keys with no matching field are preserved
     * and re-emitted untouched.
     */
    readonly params = input<ActionParams>({});
    /** Localized required-field template; `{field}` is replaced with the label. */
    readonly requiredTemplate = input('{field} is required');

    /**
     * The complete params object after each edit — never a partial patch. Fires
     * on user input only; seeding via {@link params} does not re-emit it.
     */
    readonly paramsChange = output<ActionParams>();
    /**
     * Whether every field passes `required` and its own `validate`. Emitted
     * eagerly on init (so a consumer learns the starting validity without
     * touching the form) and again whenever the verdict is recomputed.
     */
    readonly validChange = output<boolean>();

    private readonly model = signal<ActionParams>({});

    /**
     * The current validation message per field key, or `null` where the field
     * passes. Exposed so a host can render errors outside this form.
     */
    readonly errors = computed<Record<string, string | null>>(() => {
        const p = this.model();
        const out: Record<string, string | null> = {};
        for (const f of this.fields()) out[f.key] = this.fieldError(f, p[f.key]);
        return out;
    });

    readonly isValid = computed(() => Object.values(this.errors()).every((e) => e === null));

    constructor() {
        effect(() => this.model.set({ ...this.params() }));
        effect(() => this.validChange.emit(this.isValid()));
    }

    private fieldError(field: RichTextActionField, value: unknown): string | null {
        const empty = value === undefined || value === '' || value === null;
        if (field.required && empty) return interpolate(this.requiredTemplate(), { field: field.label });
        if (!empty && field.validate) return field.validate(value);
        return null;
    }

    /**
     * Template binding for the text/textarea/number/select controls: the current
     * value of `key` stringified, or `''` when the key is absent — which is what
     * leaves a `select` on its disabled placeholder option. An explicit `false`
     * or `0` renders as `"false"` / `"0"`, not as empty.
     */
    stringValue(key: string): string {
        const model = this.model();
        return Object.hasOwn(model, key) ? String(model[key]) : '';
    }

    /**
     * Template binding for a checkbox's `checked`. Truthiness-based, so a
     * seeded string survives the round trip from serialized params — but note
     * `"false"` is truthy and reads as checked.
     */
    boolValue(key: string): boolean {
        return Boolean(this.model()[key]);
    }

    /**
     * Template-only handler for every control's input/change. Coerces the raw
     * DOM value by `field.type` — checkbox to boolean, number to `Number` (an
     * unparseable entry becomes `NaN`, which is non-empty and so passes the
     * `required` check), everything else to string — then merges it into the
     * model and emits {@link paramsChange}. Validity is recomputed reactively
     * and reaches the consumer through {@link validChange}, not from here.
     */
    onFieldInput(field: RichTextActionField, raw: string | boolean): void {
        let value: string | number | boolean = String(raw);
        if (field.type === 'checkbox') value = Boolean(raw);
        else if (field.type === 'number') value = Number(raw);
        const next: ActionParams = { ...this.model(), [field.key]: value };
        this.model.set(next);
        this.paramsChange.emit(next);
    }
}
