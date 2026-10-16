import {
    Component,
    ChangeDetectionStrategy,
    input,
    model,
    computed,
    effect,
    signal,
    InjectionToken,
    forwardRef,
    OnInit,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { ToggleGroupItemComponent } from './sub/toggle-group-item.component';

export interface ToggleGroupItem {
    value: string;
    label?: string;
    icon?: string;
    disabled?: boolean;
}

export const toggleVariants = cva(
    'inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] whitespace-nowrap',
    {
        variants: {
            variant: {
                default: 'bg-transparent',
                outline:
                    'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
            },
            size: {
                default: 'min-w-9',
                sm: 'min-w-8',
                lg: 'min-w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export type ToggleGroupVariant = VariantProps<typeof toggleVariants>['variant'];
export type ToggleGroupSize = VariantProps<typeof toggleVariants>['size'];
export type ToggleGroupType = 'single' | 'multiple';

export const TOGGLE_GROUP = new InjectionToken<ToggleGroupComponent>('TOGGLE_GROUP');

/** Normalises the public union shape into the internal array shape. */
function toArray(value: string | string[]): string[] {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
}

@Component({
    selector: 'ui-toggle-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [forwardRef(() => ToggleGroupItemComponent)],
    templateUrl: './toggle-group.component.html',
    host: { class: 'contents' },
    providers: [
        { provide: TOGGLE_GROUP, useExisting: forwardRef(() => ToggleGroupComponent) },
        { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ToggleGroupComponent), multi: true },
    ],
})
export class ToggleGroupComponent implements OnInit, ControlValueAccessor {
    /** `single` keeps at most one item on (and re-pressing it clears the selection); `multiple` accumulates. Also decides whether {@link valueChange} carries a string or a string array. */
    type = input<ToggleGroupType>('single');
    /** Item styling, read by each item through the group: `outline` adds borders (one per join between items) plus a shared shadow on the group. */
    variant = input<ToggleGroupVariant>('default');
    /** Item height/min-width preset, read by each item through the group and mirrored to `data-size`. */
    size = input<ToggleGroupSize>('default');
    /** Disables every item in the group; an item may also disable itself independently. A reactive-forms `disable()` disables it too — see {@link isDisabled}. */
    disabled = input(false);
    /** Initially pressed value(s), read once in `ngOnInit` — a bare string is wrapped into an array. Later changes are ignored. A value written by a form afterwards — `null` included, which clears — replaces it. */
    defaultValue = input<string | string[] | undefined>(undefined);
    /** Extra classes merged onto the `<fieldset>` that wraps the items. */
    class = input('');
    /** Data-driven mode: a non-empty array renders one item per entry and makes projected content be ignored. */
    items = input<ToggleGroupItem[]>([]);
    readonly isDataDriven = computed(() => this.items().length > 0);

    /**
     * The selection, as a two-way `model()`, in the shape this component has
     * always emitted: the single selected value (`''` when cleared) in `single`
     * mode, the full array in `multiple` mode.
     *
     * Being a `ModelSignal` is what makes this component a valid Signal Forms
     * `FormValueControl`, and it doubles as the `valueChange` output: Angular
     * derives the output from the model, so there is no separate declaration.
     * A write from outside is normalised into {@link selection} and stays
     * silent; only a user toggle emits. It starts `undefined` rather than empty
     * so that "nobody has written this yet" is distinguishable from "written
     * empty" — otherwise the sync effect, which runs after `ngOnInit`, would
     * clobber the {@link defaultValue} seed. Read {@link selection} for the
     * current selection; this member is the published surface. A write from a
     * form (`formControlName`, `ngModel`) lands in {@link selection} through
     * {@link writeValue} and leaves this member at its pre-write value, so read
     * {@link selection} — or the DOM — for what is rendered. Because this member
     * keeps its pre-write value, a later user toggle that lands on that same
     * string does not re-emit `valueChange` (the form still receives it).
     */
    readonly value = model<string | string[] | undefined>(undefined);

    /**
     * The pressed values as an array, whatever the mode — the shape every
     * internal calculation and every item's `data-state` reads. Held separately
     * from {@link value} so the `defaultValue` seed and external writes can move
     * the selection without emitting, and so the union type of the public model
     * never leaks into the internals.
     */
    readonly selection = signal<string[]>([]);

    private onChange: (value: string | string[]) => void = () => { };
    private onTouched: () => void = () => { };
    private readonly formDisabled = signal(false);

    /** Effective disabled state: the {@link disabled} input OR a reactive `control.disable()` relayed through {@link setDisabledState}. Items read this, never the raw input. */
    readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

    constructor() {
        effect(() => {
            const next = this.value();
            if (next === undefined) return;
            this.selection.set(toArray(next));
        });
    }

    ngOnInit(): void {
        const defaultVal = this.defaultValue();
        if (defaultVal) {
            this.selection.set(toArray(defaultVal));
        }
    }

    // Items are `display: contents` hosts around the <button> that draws the
    // box, so the joins are styled from here: `first:`/`last:` on the button
    // itself would match every item, the button being its host's only child.
    // The plain-child form keeps a consumer's own element in the group joined.
    classes = computed(() =>
        cn(
            'group/toggle-group flex w-fit items-center rounded-md',
            '[&>*:not(:first-child)]:rounded-s-none [&>.contents:not(:first-child)>*]:rounded-s-none',
            '[&>*:not(:last-child)]:rounded-e-none [&>.contents:not(:last-child)>*]:rounded-e-none',
            this.variant() === 'outline' && [
                'shadow-xs',
                '[&>*:not(:first-child)]:border-s-0 [&>.contents:not(:first-child)>*]:border-s-0',
            ],
            this.class()
        )
    );

    /** Whether the given item value is currently pressed; items call this to derive their `data-state` and `aria-pressed`. */
    isSelected(itemValue: string): boolean {
        return this.selection().includes(itemValue);
    }

    /** Flips an item's pressed state honouring {@link type} — replacing the selection in `single` mode, adding/removing in `multiple` — then emits {@link valueChange}. No-op while the group is disabled. */
    toggle(itemValue: string): void {
        if (this.isDisabled()) return;

        const current = this.selection();
        let newValue: string[];

        if (this.type() === 'single') {
            newValue = current.includes(itemValue) ? [] : [itemValue];
        } else if (current.includes(itemValue)) {
            newValue = current.filter(v => v !== itemValue);
        } else {
            newValue = [...current, itemValue];
        }

        this.commit(newValue);
    }

    /** The one place a user edit leaves the component: renders it, tells the form, and publishes it on {@link value}. */
    private commit(next: string[]): void {
        const published = this.type() === 'single' ? next[0] ?? '' : next;
        this.selection.set(next);
        this.onChange(published);
        this.value.set(published);
    }

    /** Marks the control touched when focus leaves the group, not when it moves between two items of it. */
    onFocusOut(event: FocusEvent): void {
        const group = event.currentTarget;
        const next = event.relatedTarget;
        if (group instanceof Node && next instanceof Node && group.contains(next)) return;
        this.onTouched();
    }

    /** `ControlValueAccessor`: renders a form value without emitting — `null`, `undefined` and `''` clear the selection. */
    writeValue(value: string | string[] | null | undefined): void {
        this.selection.set(toArray(value ?? ''));
    }

    /** `ControlValueAccessor`: the callback receives the group's published shape (a string in `single` mode, an array in `multiple`) on every user toggle. */
    registerOnChange(fn: (value: string | string[]) => void): void {
        this.onChange = fn;
    }

    /** `ControlValueAccessor`: invoked by {@link onFocusOut}. */
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    /** `ControlValueAccessor`: relays `control.disable()` / `enable()` into {@link isDisabled}. */
    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }
}
