import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { ActionParams, RichTextActionField } from './rich-text-actions.types';

/** Renders declarative action fields (tier 1) and emits params + validity. */
@Component({
    selector: 'ui-rich-text-actions-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-actions-form.component.html',
    host: { class: 'block', '[attr.data-slot]': "'rich-text-actions-form'" },
})
export class RichTextActionsFormComponent {
    readonly class = input('');
    readonly fields = input<RichTextActionField[]>([]);
    readonly params = input<ActionParams>({});

    readonly paramsChange = output<ActionParams>();
    readonly validChange = output<boolean>();

    private readonly model = signal<ActionParams>({});

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
        if (field.required && empty) return `${field.label} is required`;
        if (!empty && field.validate) return field.validate(value);
        return null;
    }

    stringValue(key: string): string {
        const model = this.model();
        return Object.hasOwn(model, key) ? String(model[key]) : '';
    }

    boolValue(key: string): boolean {
        return Boolean(this.model()[key]);
    }

    onFieldInput(field: RichTextActionField, raw: string | boolean): void {
        let value: string | number | boolean = String(raw);
        if (field.type === 'checkbox') value = Boolean(raw);
        else if (field.type === 'number') value = Number(raw);
        const next = { ...this.model(), [field.key]: value } as ActionParams;
        this.model.set(next);
        this.paramsChange.emit(next);
    }
}
