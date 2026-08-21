import {
    ChangeDetectionStrategy,
    Component,
    effect,
    ElementRef,
    forwardRef,
    inject,
    InjectionToken,
    input,
    model,
    OnDestroy,
    computed,
    signal,
    ViewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn, isRtl } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../lib/i18n/common.locales';

export const SELECT = new InjectionToken<SelectComponent<unknown>>('SELECT');

@Component({
    selector: 'ui-select',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrl: './select.component.css',
    template: `
        @if (isDataDriven()) {
            <div class="relative inline-block w-full">
                <button
                    type="button"
                    role="combobox"
                    [class]="triggerClasses()"
                    [disabled]="isDisabled()"
                    [attr.aria-expanded]="open()"
                    [attr.aria-label]="resolvedAriaLabel()"
                    [attr.aria-labelledby]="resolvedAriaLabelledby()"
                    [attr.data-state]="open() ? 'open' : 'closed'"
                    [attr.aria-controls]="listId"
                    [attr.data-slot]="'select-trigger'"
                    (click)="toggle()"
                    (keydown)="onTriggerKeyDown($event)"
                >
                    <span class="flex-1 truncate ltr:text-left rtl:text-right">
                        @if (hasValue()) {
                            {{ selectedDisplayValue() }}
                        } @else {
                            <span class="text-muted-foreground">{{ resolvedPlaceholder() }}</span>
                        }
                    </span>
                    <svg
                        class="size-4 opacity-50 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                @if (open()) {
                    <div
                        #contentEl
                        [attr.id]="listId"
                        [class]="contentClasses()"
                        role="listbox"
                        tabindex="-1"
                        (keydown)="onContentKeydown($event)"
                    >
                        <div class="p-1">
                            @for (option of options(); track getTrackBy(option); let i = $index) {
                                <div
                                    #itemEl
                                    role="option"
                                    tabindex="-1"
                                    [class]="itemClasses(option)"
                                    [attr.aria-selected]="isSelected(option)"
                                    [attr.data-state]="isSelected(option) ? 'checked' : 'unchecked'"
                                    [attr.data-index]="i"
                                    (click)="selectOption(option)"
                                    (keydown.enter)="selectOption(option)"
                                    (mouseenter)="focusedIndex.set(i)"
                                >
                                    <span class="flex-1">{{ getDisplayValue(option) }}</span>
                                    <span class="absolute flex size-3.5 items-center justify-center ltr:right-2 rtl:left-2">
                                        @if (isSelected(option)) {
                                            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        }
                                    </span>
                                </div>
                            }
                        </div>
                    </div>
                }
            </div>
        } @else {
            <ng-content />
        }
    `,
    host: { class: 'relative inline-block', '[attr.dir]': 'dir()' },
    providers: [
        { provide: SELECT, useExisting: forwardRef(() => SelectComponent) },
        { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }
    ],
})
export class SelectComponent<T = string> implements OnDestroy, ControlValueAccessor {
    private readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);

    /**
     * Disables the trigger and blocks {@link toggle}. OR-ed with the disabled
     * state pushed by a reactive form via {@link setDisabledState} — see
     * {@link isDisabled}; clearing this input will not re-enable a control the
     * form has disabled.
     */
    readonly disabled = input(false);
    /** Override for the placeholder. Falls back to the locale's `selectPlaceholder`. */
    readonly placeholder = input<string>();
    /** Forwarded to the trigger button's `aria-label` for an accessible name. */
    readonly ariaLabel = input<string | undefined>(undefined);
    /**
     * Forwarded to the trigger button's `aria-labelledby` to associate the
     * combobox with an external visible label (e.g. a `<span id>` caption).
     */
    readonly ariaLabelledby = input<string | undefined>(undefined);
    /**
     * Initial selection, applied once while the value is still `undefined` — a
     * later change is ignored, and it never overwrites a user pick. Use
     * {@link value} instead to keep the selection driven from the outside.
     */
    readonly defaultValue = input<T | undefined>(undefined);

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CommonLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;
    /** Effective placeholder — explicit input wins; otherwise falls back to the locale. */
    readonly resolvedPlaceholder = computed(() => this.placeholder() ?? this.t().selectPlaceholder);

    /**
     * `aria-labelledby` for the trigger, treating an empty string as absent — an
     * `aria-labelledby=""` references nothing and leaves the combobox unnamed.
     */
    protected readonly resolvedAriaLabelledby = computed(() => this.ariaLabelledby() || undefined);

    /**
     * Accessible name for the data-driven trigger. `role="combobox"` takes its
     * name from the author, not from its contents, so the visible placeholder
     * text inside the button does not name it (axe `button-name`). Fall back to
     * that same placeholder string unless the consumer names the control itself.
     */
    protected readonly resolvedAriaLabel = computed(() => {
        const explicit = this.ariaLabel();
        if (explicit) return explicit;
        if (this.resolvedAriaLabelledby()) return undefined;
        return this.resolvedPlaceholder();
    });
    /**
     * How a projected `<ui-select-content>` anchors itself: `item-aligned`
     * overlays the popup so the selected row sits on the trigger, `popper`
     * drops it below (or flips above when there is no room). Read by the
     * content, which falls back to its own `position` input when no select is
     * present, and downgrades to `popper` anyway if item-aligned would clip.
     * Has no effect in data-driven mode, which always renders below.
     */
    readonly position = input<'popper' | 'item-aligned'>('item-aligned');
    /**
     * Options for data-driven mode. Passing a non-empty array switches the
     * component to render its own trigger and listbox instead of projected
     * `<ui-select-trigger>` / `<ui-select-content>` content — see
     * {@link isDataDriven}. Pair with {@link displayWith},
     * {@link valueAttribute} and {@link disabledWith}.
     */
    readonly options = input<T[]>([]);
    /**
     * Maps an option to its visible label in data-driven mode. Defaults to
     * `String`, so object options need this to avoid rendering `[object
     * Object]`.
     */
    readonly displayWith = input<(option: T) => string>(String);
    /**
     * The selection, as a two-way `model()`. Any defined value written from
     * outside is pushed into the internal signal; `undefined` is ignored, so it
     * cannot be used to clear the selection. A write from outside does not emit
     * {@link valueChange} — only a user pick does.
     *
     * Being a `ModelSignal` is what makes this component a valid Signal Forms
     * `FormValueControl`, and it is also the `valueChange` output: Angular
     * derives the output from the model, so there is no separate declaration.
     */
    readonly value = model<T | undefined>(undefined);
    /**
     * Property name to read the option's value from when options are objects
     * (e.g. `'id'`). When unset the whole option object is the value, and
     * matching relies on referential equality.
     */
    readonly valueAttribute = input<string | undefined>(undefined);
    /**
     * Predicate marking individual data-driven options unselectable. Disabled
     * options are dimmed, skipped by arrow-key navigation and ignored by
     * {@link selectOption}.
     */
    readonly disabledWith = input<(option: T) => boolean>(() => false);

    /**
     * The rendered selection. Held separately from {@link value} so that
     * programmatic writes — a `writeValue` from a reactive form, or the
     * {@link defaultValue} seed — can move the selection without emitting, which
     * is the behaviour every consumer of this component was written against.
     * User picks write both, so `value` is the one that emits, exactly once.
     */
    internalValue = signal<T | undefined>(undefined);
    open = signal(false);
    focusedIndex = signal(0);

    private static nextId = 0;
    readonly listId = `select-list-${++SelectComponent.nextId}`;

    private _onChange: (value: T) => void = () => { };
    private _onTouched: () => void = () => { };
    private readonly _disabled = signal(false);

    readonly isDisabled = computed(() => this.disabled() || this._disabled());
    readonly isDataDriven = computed(() => this.options().length > 0);
    readonly hasValue = computed(() => this.internalValue() != null);

    readonly selectedDisplayValue = computed(() => {
        const val = this.internalValue();
        if (val == null) return '';

        if (this.isDataDriven()) {
            const option = this.options().find(opt => this.getValue(opt) === val);
            return option ? this.getDisplayValue(option) : String(val);
        }
        return String(val);
    });

    private readonly itemElements = new Map<string, HTMLElement>();

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private readonly clickListener = (event: MouseEvent): void => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.close();
        }
    };

    private readonly keydownListener = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && this.open()) {
            this.close();
        }
    };

    readonly triggerClasses = computed(() => cn(
        'border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50',
        'flex w-full items-center justify-between rounded-md border bg-transparent text-sm',
        'whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
        'dark:bg-input/50 dark:hover:bg-input/70'
    ));

    readonly contentClasses = computed(() => cn(
        'absolute z-50 max-h-60 min-w-[8rem] w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border bg-popover p-0 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        'top-full mt-1 ltr:left-0 rtl:right-0'
    ));

    constructor() {
        this.document.addEventListener('click', this.clickListener);
        this.document.addEventListener('keydown', this.keydownListener);

        effect(() => {
            const defaultVal = this.defaultValue();
            if (defaultVal !== undefined && this.internalValue() === undefined) {
                this.internalValue.set(defaultVal);
            }
        });

        effect(() => {
            const val = this.value();
            if (val !== undefined) {
                this.internalValue.set(val);
            }
        });

        effect(() => {
            if (this.open()) {
                const currentVal = this.internalValue();
                if (currentVal === undefined) {
                    this.focusedIndex.set(0);
                } else {
                    const index = this.options().findIndex(opt => this.getValue(opt) === currentVal);
                    this.focusedIndex.set(Math.max(index, 0));
                }

                if (this.isDataDriven()) {
                    setTimeout(() => {
                        this.focusDataDrivenContent();
                    }, 0);
                }
            }
        });
    }

    private focusDataDrivenContent(): void {
        const contentEl = this.contentEl?.nativeElement;
        if (!contentEl) return;
        const selectedItem = contentEl.querySelector<HTMLElement>('[data-state="checked"]');
        const firstItem = contentEl.querySelector<HTMLElement>('[role="option"]');

        if (selectedItem) {
            selectedItem.focus({ preventScroll: true });
        } else if (firstItem) {
            firstItem.focus({ preventScroll: true });
        } else {
            contentEl.focus({ preventScroll: true });
        }
    }

    ngOnDestroy(): void {
        this.document.removeEventListener('click', this.clickListener);
        this.document.removeEventListener('keydown', this.keydownListener);
    }

    /** Label shown for an option, via {@link displayWith}. */
    getDisplayValue(option: T): string {
        return this.displayWith()(option);
    }

    /**
     * Value an option contributes to the selection: the option's
     * {@link valueAttribute} property, or the option itself when unset.
     */
    getValue(option: T): unknown {
        const attr = this.valueAttribute();
        if (attr) {
            return (option as Record<string, unknown>)[attr];
        }
        return option;
    }

    /**
     * `@for` track key for the option list — the stringified
     * {@link getValue}, so object options must have a {@link valueAttribute}
     * that is unique across the list.
     */
    getTrackBy(option: T): string {
        return String(this.getValue(option));
    }

    /**
     * Whether an option's {@link getValue} strictly equals the current
     * selection. Object values without a {@link valueAttribute} therefore only
     * match by reference.
     */
    isSelected(option: T): boolean {
        return this.getValue(option) === this.internalValue();
    }

    /** Whether {@link disabledWith} rejects this option. */
    isOptionDisabled(option: T): boolean {
        return this.disabledWith()(option);
    }

    /**
     * Classes for one data-driven option row, folding in its disabled state and
     * whether it is the keyboard/hover-focused row.
     */
    itemClasses(option: T): string {
        const index = this.options().indexOf(option);
        const isDisabled = this.isOptionDisabled(option);
        return cn(
            'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 text-sm outline-none select-none',
            'ltr:pr-8 ltr:pl-2 rtl:pl-8 rtl:pr-2',
            isDisabled
                ? 'text-muted-foreground cursor-not-allowed opacity-50'
                : 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            !isDisabled && index === this.focusedIndex() && 'bg-accent text-accent-foreground'
        );
    }

    /**
     * Commits a data-driven option: stores its {@link getValue}, emits
     * {@link valueChange}, notifies the form, and closes the popup. A no-op for
     * options rejected by {@link disabledWith}.
     */
    selectOption(option: T): void {
        if (this.isOptionDisabled(option)) return;
        const val = this.getValue(option) as T;
        this.commit(val);
    }

    /** Opens or closes the popup; ignored while {@link isDisabled}. */
    toggle(): void {
        if (!this.isDisabled()) {
            this.open.update(v => !v);
        }
    }

    /**
     * Closes the popup and marks the control touched — so calling it also
     * triggers a reactive form's touched-state validation display.
     */
    close(): void {
        this.open.set(false);
        this._onTouched();
    }

    /**
     * Commits a raw value (used by projected `<ui-select-item>`, which has no
     * option object): stores it, emits {@link valueChange}, notifies the form
     * and closes. Unlike {@link selectOption} it applies no disabled check —
     * the caller is responsible for that.
     */
    select(val: T): void {
        this.commit(val);
    }

    /**
     * The one path a user-driven selection takes: store it, publish it through
     * the {@link value} model (which emits `valueChange` once), notify the form,
     * and close.
     */
    private commit(val: T): void {
        this.internalValue.set(val);
        this.value.set(val);
        this._onChange(val);
        this.close();
    }

    /**
     * Called by a projected `<ui-select-item>` on init so item-aligned
     * positioning can measure it. Keyed by value, so duplicate values overwrite
     * each other.
     */
    registerItem(value: string, element: HTMLElement): void {
        this.itemElements.set(value, element);
    }

    /** Undoes {@link registerItem} when a projected item is destroyed. */
    unregisterItem(value: string): void {
        this.itemElements.delete(value);
    }

    /**
     * `offsetTop` of the selected item inside the content, used to shift an
     * item-aligned popup so that row lands on the trigger. Falls back to the
     * first registered item, then `0`.
     */
    getSelectedItemOffset(): number {
        const currentValue = this.internalValue();
        if (currentValue !== undefined) {
            const element = this.itemElements.get(String(currentValue));
            if (element) {
                return element.offsetTop;
            }
        }
        const firstItem = this.itemElements.values().next().value;
        return firstItem ? firstItem.offsetTop : 0;
    }

    /**
     * The trigger button, whether rendered internally or projected as
     * `<ui-select-trigger>`; `null` before it exists. Used as the positioning
     * anchor for the content.
     */
    getTriggerElement(): HTMLElement | null {
        return this.el.nativeElement.querySelector('[data-slot="select-trigger"]')
            ?? this.el.nativeElement.querySelector('button[role="combobox"]');
    }

    /**
     * Resolved text direction from the computed style of the host, so it
     * reflects an inherited `dir` rather than only the {@link locale} input.
     */
    isRtl(): boolean {
        return isRtl(this.el.nativeElement);
    }

    /**
     * Trigger key handler: Enter, Space, ArrowUp and ArrowDown open the popup
     * (never close it — use {@link toggle} or Escape for that). Ignored while
     * {@link isDisabled}.
     */
    onTriggerKeyDown(event: KeyboardEvent): void {
        if (this.isDisabled()) return;

        switch (event.key) {
            case 'Enter':
            case ' ':
            case 'ArrowDown':
            case 'ArrowUp':
                event.preventDefault();
                if (!this.open()) {
                    this.open.set(true);
                }
                break;
        }
    }

    private findNextEnabledIndex(startIndex: number, direction: 1 | -1): number {
        const opts = this.options();
        let index = startIndex + direction;
        while (index >= 0 && index < opts.length) {
            if (!this.isOptionDisabled(opts[index])) {
                return index;
            }
            index += direction;
        }
        return startIndex; // No enabled option found, stay at current
    }

    /**
     * Listbox key handler for data-driven mode: arrows move the focused row
     * (skipping {@link disabledWith} options and stopping at the ends rather
     * than wrapping), Enter/Space commit it, Escape and Tab close. A no-op when
     * {@link options} is empty.
     */
    onContentKeydown(event: KeyboardEvent): void {
        const opts = this.options();
        if (!opts.length) return;

        const currentIndex = this.focusedIndex();

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.focusedIndex.set(this.findNextEnabledIndex(currentIndex, 1));
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.focusedIndex.set(this.findNextEnabledIndex(currentIndex, -1));
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (opts[currentIndex] && !this.isOptionDisabled(opts[currentIndex])) {
                    this.selectOption(opts[currentIndex]);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.close();
                break;
            case 'Tab':
                this.close();
                break;
        }
    }

    /**
     * `ControlValueAccessor` — accepts the form's value without emitting
     * {@link valueChange}. Note a non-`undefined` {@link value} input keeps
     * winning, since its effect re-applies on every change detection.
     */
    writeValue(value: T): void {
        this.internalValue.set(value);
    }

    /** `ControlValueAccessor` — stores the form's change callback. */
    registerOnChange(fn: (value: T) => void): void {
        this._onChange = fn;
    }

    /** `ControlValueAccessor` — stores the touched callback, fired by {@link close}. */
    registerOnTouched(fn: () => void): void {
        this._onTouched = fn;
    }

    /**
     * `ControlValueAccessor` — the form's disabled state, kept separate from
     * the {@link disabled} input and OR-ed with it in {@link isDisabled}.
     */
    setDisabledState(isDisabled: boolean): void {
        this._disabled.set(isDisabled);
    }
}

