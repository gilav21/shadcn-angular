import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    model,
    forwardRef,
    ElementRef,
    viewChild,
    DestroyRef,
    inject,
    effect
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { Subject, debounceTime as rxDebounceTime } from 'rxjs';
import { cn, getClippingRect } from '../../lib/utils';
import { anchorToTopLayer, type TopLayerHandle } from '../../lib/top-layer';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../lib/i18n/common.locales';
import { PopoverComponent, PopoverContentComponent, PopoverTriggerComponent } from '../popover';
import { CommandComponent, CommandListComponent, CommandItemComponent, CommandEmptyComponent, CommandService } from '../command';
import { HighlightPipe } from './highlight.pipe';
import { BadgeComponent } from '../badge';

let autocompleteIdCounter = 0;

/**
 * Whether this engine can promote the dropdown into the top layer. Read once at
 * module load so the popover's own collision handling can be turned off *before*
 * the first open, rather than racing the promotion — engines without the API
 * keep that handling and the previous `absolute` behaviour untouched.
 */
const POPOVER_API_SUPPORTED =
    globalThis.HTMLElement !== undefined &&
    typeof globalThis.HTMLElement.prototype.showPopover === 'function';

export type AutocompleteValue<T> = T | T[] | null;

@Component({
    selector: 'ui-autocomplete',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        PopoverComponent,
        PopoverContentComponent,
        PopoverTriggerComponent,
        CommandComponent,
        CommandListComponent,
        CommandItemComponent,
        CommandEmptyComponent,
        HighlightPipe,
        BadgeComponent,
        FormsModule
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => AutocompleteComponent),
            multi: true,
        },
    ],
    templateUrl: './autocomplete.component.html',
    styleUrl: './autocomplete.component.css',
    host: { class: 'contents' },
})
export class AutocompleteComponent<T = unknown> implements ControlValueAccessor {
    private readonly el = inject(ElementRef);

    /**
     * The full candidate list. Every option is rendered as a `ui-command-item`
     * up front and hidden client-side by the `ui-command` substring filter — the
     * list is not virtualised, so keep it to a few hundred entries or drive it
     * server-side by narrowing `options` in response to {@link searchChange} and
     * setting {@link filter} to `false`.
     * Options are tracked by {@link getTrackBy}, so two options with the same
     * {@link getValue} collapse into one tracked row.
     */
    options = input<T[]>([]);
    /**
     * Maps an option to the text shown in the chip / closed input and to the
     * string {@link filter} matches against. Defaults to `String`, which is only
     * useful for primitive options — pass e.g. `o => o.name` for objects,
     * otherwise every row renders as `[object Object]`.
     */
    displayWith = input<(option: T) => string>(String);
    /**
     * Name of the property that identifies an option, e.g. `'id'`. When set,
     * selection, de-duplication and {@link writeValue} compare
     * `option[valueAttribute]` and the control emits… still the whole option
     * object (see {@link updateValue}) — this input only changes *comparison*,
     * not the emitted shape. When omitted, options are compared by reference,
     * so a form value that is a structurally-equal-but-distinct object will not
     * match any option and renders via `String(value)`.
     */
    valueAttribute = input<string | undefined>(undefined);
    /**
     * Whether the built-in client-side filter hides options that do not contain
     * {@link searchTerm} (case-insensitive substring on {@link getSearchValue}).
     * Set to `false` for server-driven search, where {@link options} is already
     * the result set and hiding it again would double-filter.
     */
    filter = input(true);
    /**
     * Switches to chip/tag selection: picking an option toggles it in the value
     * array instead of replacing it, the popover stays open, the search box is
     * cleared and refocused, each selection renders as a removable `ui-badge`
     * (see {@link removeItem}), and Backspace on an empty search box pops the
     * last chip. Also changes what {@link valueChange} emits — an array rather
     * than a single option or `null`.
     */
    multiple = input(false);
    /** Override for the placeholder. Falls back to the locale's `selectPlaceholder`. */
    placeholder = input<string>();
    /**
     * Disables the text box and swallows container clicks, focus-opening and
     * every {@link onKeydown} branch. OR-ed with the reactive-forms disabled
     * state (see {@link setDisabledState}) by {@link isDisabled}, so a template
     * `disabled="true"` cannot be re-enabled by `FormControl.enable()`.
     */
    disabled = input(false);
    /** Extra classes merged onto the bordered trigger container (not the popover). */
    class = input('');
    /**
     * Milliseconds to delay {@link searchChange} by, so a request per keystroke
     * is avoided. Defaults to `0` (emit synchronously from {@link onInput}).
     * Only the outgoing event is delayed — {@link searchTerm} and therefore the
     * highlight and the client-side {@link filter} update immediately.
     * NOTE: the debounce window is captured once in the constructor, before
     * inputs are set, so any value passed in behaves as `0` (asynchronous but
     * not actually delayed).
     */
    debounceTime = input(0);
    /**
     * Uncontrolled-style seed for the selection, applied by an `effect` whenever
     * it changes: an array replaces the whole selection, a non-array becomes a
     * single-item selection, `undefined` leaves the current selection alone.
     * Setting it from outside does *not* emit `valueChange`. Prefer `ngModel` /
     * `formControl` ({@link writeValue}) — mixing both means the last writer wins.
     *
     * Being a `ModelSignal` is what makes this component a valid Signal Forms
     * `FormValueControl`, and it doubles as the `valueChange` output: Angular
     * derives the output from the model, so there is no separate declaration.
     * Note that after a `writeValue` from a reactive form this still reads the
     * pre-write value — {@link internalValue} is the rendered selection.
     */
    readonly value = model<AutocompleteValue<T> | undefined>(undefined);

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CommonLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    /**
     * The raw text typed by the user, for server-side search. Fires only from
     * {@link onInput} — never when a selection clears the box, when the popover
     * closes, or when {@link searchTerm} is set programmatically. Delayed by
     * {@link debounceTime}.
     */
    searchChange = output<string>();
    open = signal(false);
    readonly dropdownSide = signal<'top' | 'bottom'>('bottom');
    /**
     * Two-way bindable query text. Drives the highlight (`highlight` pipe) and,
     * when {@link filter} is on, which options stay visible. Reset to `''` after
     * any selection and whenever the popover closes ({@link onOpenChange}), so a
     * value written into it does not survive a dismiss. Writing to it does not
     * emit {@link searchChange}.
     */
    searchTerm = model('');
    internalValue = signal<T[]>([]);

    readonly instanceId = ++autocompleteIdCounter;
    readonly listId = `autocomplete-list-${this.instanceId}`;

    inputValue = computed(() => {
        if (this.open()) {
            return this.searchTerm();
        }
        const selected = this.selectedItems();
        return selected.length > 0 ? this.getDisplayValue(selected[0]) : '';
    });

    inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
    command = viewChild(CommandComponent);

    private onChange: (value: AutocompleteValue<T>) => void = () => { };
    onTouched: () => void = () => { };

    private readonly formDisabled = signal(false);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * The child `ui-command`'s service, read from that component's own injector.
     *
     * It cannot be obtained with `inject(CommandService)`: the service is
     * provided by `CommandComponent` itself (`providers: [CommandService]`),
     * which is a descendant, and an element injector never sees a child's
     * providers. Injecting it here resolved `null` on every render, so
     * {@link activeItemId} was always null and `aria-activedescendant` was
     * never emitted — the combobox announced no active option to screen
     * readers. Resolves once the panel opens and the command renders.
     */
    private readonly commandService = viewChild(CommandComponent, { read: CommandService });
    private readonly searchSubject = new Subject<string>();

    /**
     * Cleared only when a promotion attempt fails, which restores the popover's
     * own collision handling for the untouched `absolute` fallback.
     */
    private readonly topLayerAvailable = signal(POPOVER_API_SUPPORTED);
    private topLayer: TopLayerHandle | null = null;

    /**
     * The popover only flips and shifts the panel while it positions it itself.
     * Once the panel is promoted, the top layer helper owns the geometry — and
     * the popover's boundary is still measured from the clipping ancestor the
     * panel has just escaped, so letting it run would shift the panel back.
     */
    protected readonly avoidPopoverCollisions = computed(() => !this.topLayerAvailable());

    /**
     * Id of the option the command has highlighted, mirrored to the input's
     * `aria-activedescendant`. Null while the panel is closed, or before the
     * child command has rendered.
     */
    activeItemId = computed(() => this.commandService()?.activeItemId() ?? null);

    isDisabled = computed(() => this.disabled() || this.formDisabled());

    containerClasses = computed(() => cn(
        'flex w-full items-center justify-between rounded-md border border-input bg-background text-sm ring-offset-background cursor-text',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        this.isDisabled() ? 'cursor-not-allowed opacity-50' : '',
        this.class()
    ));

    multiInputClasses = computed(() => cn(
        'flex-1 bg-transparent p-0 placeholder:text-muted-foreground outline-none min-w-[60px]',
        this.isDisabled() ? 'cursor-not-allowed' : ''
    ));

    singleInputClasses = computed(() => cn(
        'flex-1 bg-transparent p-0 placeholder:text-muted-foreground outline-none text-sm w-full',
        this.isDisabled() ? 'cursor-not-allowed' : ''
    ));

    selectedItems = computed(() => {
        return this.internalValue().map(val => {
            if (this.options().length > 0) {
                const found = this.options().find(opt => this.getValue(opt) === val);
                if (found) return found;
            }
            return val;
        });
    });

    constructor() {
        this.searchSubject.pipe(
            rxDebounceTime(this.debounceTime()),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(val => this.searchChange.emit(val));

        effect(() => {
            const val = this.value();
            if (val === undefined) return;
            if (val === null) {
                this.internalValue.set([]);
            } else if (Array.isArray(val)) {
                this.internalValue.set(val);
            } else {
                this.internalValue.set([val]);
            }
        });

        effect(() => {
            if (this.open()) {
                requestAnimationFrame(() => this.promoteDropdown());
            } else {
                this.releaseDropdown();
            }
        });

        this.destroyRef.onDestroy(() => this.releaseDropdown());
    }

    /**
     * Lift the listbox into the top layer so it is not clipped by a card, an
     * accordion panel or a scroll area around the input. The panel keeps its DOM
     * position, so `aria-controls` / `aria-activedescendant` and the popover's
     * own outside-click detection continue to resolve. Deferred by a frame
     * because the panel is only rendered once the popover has opened.
     */
    private promoteDropdown(): void {
        if (this.topLayer || !this.open()) return;

        const root = this.el.nativeElement as HTMLElement;
        const anchor = root.querySelector<HTMLElement>('[data-slot="autocomplete-container"]');
        const panel = root.querySelector<HTMLElement>('[data-slot="popover-content"]');
        if (!anchor || !panel) return;

        const handle = anchorToTopLayer(panel, anchor, {
            side: this.dropdownSide(),
            align: this.dir() === 'rtl' ? 'end' : 'start',
        });

        if (handle.promoted) {
            this.topLayer = handle;
        } else {
            this.topLayerAvailable.set(false);
        }
    }

    /** Return the panel to normal flow; skipping this leaks the top-layer listeners. */
    private releaseDropdown(): void {
        this.topLayer?.release();
        this.topLayer = null;
    }

    private resolveDropdownSide(): void {
        const triggerContainer = this.el.nativeElement.querySelector('[data-state]') as HTMLElement | null;
        if (!triggerContainer) return;

        const triggerRect = triggerContainer.getBoundingClientRect();
        const boundary = getClippingRect(triggerContainer);
        const padding = 8;
        const maxDropdownHeight = 300;

        const spaceBelow = boundary.bottom - triggerRect.bottom - padding;
        const spaceAbove = triggerRect.top - boundary.top - padding;

        if (maxDropdownHeight <= spaceBelow || spaceBelow >= spaceAbove) {
            this.dropdownSide.set('bottom');
        } else {
            this.dropdownSide.set('top');
        }
    }

    /**
     * Label for an option, via {@link displayWith}. Falls back to `String(option)`
     * when a non-function was bound, so a mis-typed `displayWith` degrades to
     * `[object Object]` rather than throwing. Used for chips, the closed input
     * text and the highlighted row label.
     */
    getDisplayValue(option: T): string {
        const displayFn = this.displayWith();
        if (typeof displayFn !== 'function') {
            return String(option);
        }
        return displayFn(option);
    }

    /**
     * The identity used for every selection comparison — `option[valueAttribute]`
     * when {@link valueAttribute} is set, otherwise the option itself (reference
     * equality). Returns `undefined` if the option lacks that property, which
     * makes all such options compare equal to each other.
     */
    getValue(option: T): unknown {
        const attr = this.valueAttribute();
        if (attr) {
            return (option as Record<string, unknown>)[attr];
        }
        return option;
    }

    /**
     * `@for` track key for the option rows — {@link getValue} stringified. Object
     * options without a {@link valueAttribute} therefore all stringify to
     * `[object Object]`; set {@link valueAttribute} so rows are not treated as
     * duplicates and re-created on every change.
     */
    getTrackBy(option: T): string {
        return String(this.getValue(option));
    }

    /**
     * The string `ui-command` substring-matches {@link searchTerm} against when
     * {@link filter} is on. Identical to {@link getDisplayValue} — override the
     * component if you need to match on text that is not displayed (e.g. an
     * ISO code behind a country name).
     */
    getSearchValue(option: T): string {
        return this.getDisplayValue(option);
    }

    /**
     * Whether the option is in the current selection, compared by
     * {@link getValue}. Drives the check mark on the row and the toggle-off
     * branch of {@link onSelect}.
     */
    isSelected(option: T): boolean {
        const val = this.getValue(option);
        return this.internalValue().some(v => this.getValue(v) === val);
    }

    /**
     * Click / Enter / Space on the bordered container: forwards focus to the
     * text box so clicking the chip whitespace starts typing. Always stops
     * propagation — when {@link isDisabled} it also calls `preventDefault()`, which
     * is what keeps the wrapping popover trigger from opening while disabled.
     */
    onContainerClick(event: Event): void {
        if (this.isDisabled()) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        this.inputEl()?.nativeElement.focus();
        event.stopPropagation();
    }

    /**
     * Opens the dropdown on focus, after measuring whether it fits below the
     * trigger and flipping it above when it does not. Wired only to the
     * single-select input — in {@link multiple} mode focusing the box does not
     * open the list; typing or ArrowDown/ArrowUp does.
     */
    onFocus(): void {
        if (!this.isDisabled() && !this.open()) {
            this.resolveDropdownSide();
            this.open.set(true);
        }
    }

    /**
     * Marks the control touched on blur. Deliberately does *not* close the
     * dropdown or revert free text — dismissal is owned by the popover
     * (outside click / Escape) so that clicking a row does not blur-close the
     * list out from under the click. Typed text that matched nothing is simply
     * discarded when the popover closes ({@link onOpenChange}).
     */
    onBlur(): void {
        this.onTouched();
    }

    /**
     * Popover open-state callback. Ignored entirely while {@link isDisabled}, so
     * the dropdown cannot be opened by the trigger. On close it clears
     * {@link searchTerm}, which restores the single-select input to the selected
     * option's label via `inputValue`.
     */
    onOpenChange(isOpen: boolean): void {
        if (!this.isDisabled()) {
            this.open.set(isOpen);
            if (!isOpen) {
                this.searchTerm.set('');
            }
        }
    }

    /**
     * Handles typing: updates {@link searchTerm} immediately, then emits
     * {@link searchChange} either synchronously or through the debounced subject
     * when {@link debounceTime} is greater than zero, and opens the dropdown if
     * it was closed. Runs even when a selection already exists, so typing over a
     * single-select value re-opens the list without clearing the selection.
     */
    onInput(event: Event): void {
        const target = event.target as HTMLInputElement;
        const val = target.value;
        this.searchTerm.set(val);

        if (this.debounceTime() > 0) {
            this.searchSubject.next(val);
        } else {
            this.searchChange.emit(val);
        }

        if (!this.open()) {
            this.resolveDropdownSide();
            this.open.set(true);
        }
    }

    /**
     * Keyboard contract for the text box; a no-op while {@link isDisabled}.
     * - `ArrowDown` / `ArrowUp` — open the list when closed, otherwise move the
     *   highlight one visible row down/up. The highlight **wraps** at both ends,
     *   and only walks options that survived the {@link filter}.
     * - `Enter` — selects the highlighted row ({@link onSelect}) when the list is
     *   open; with nothing highlighted it does nothing. Always `preventDefault`s,
     *   so Enter never submits the surrounding form while focus is here.
     * - `Escape` — closes the list (which clears {@link searchTerm}); it does not
     *   undo the current selection.
     * - `Backspace` — in {@link multiple} mode only, and only when the search box
     *   is already empty, removes the last chip and emits {@link valueChange}.
     * Other keys, including Tab and Home/End, fall through to the browser.
     */
    onKeydown(event: KeyboardEvent): void {
        if (this.isDisabled()) return;
        switch (event.key) {
            case 'ArrowDown': this.handleArrowDown(event); break;
            case 'ArrowUp': this.handleArrowUp(event); break;
            case 'Enter': this.handleEnter(event); break;
            case 'Escape': this.open.set(false); break;
            case 'Backspace': this.handleBackspace(); break;
        }
    }

    private handleArrowDown(event: KeyboardEvent): void {
        event.preventDefault();
        if (this.open()) { this.command()?.moveNext(); }
        else { this.resolveDropdownSide(); this.open.set(true); }
    }

    private handleArrowUp(event: KeyboardEvent): void {
        event.preventDefault();
        if (this.open()) { this.command()?.movePrev(); }
        else { this.resolveDropdownSide(); this.open.set(true); }
    }

    private handleEnter(event: KeyboardEvent): void {
        event.preventDefault();
        if (this.open()) { this.command()?.selectActive(); }
    }

    private handleBackspace(): void {
        if (this.multiple() && this.searchTerm() === '' && this.selectedItems().length > 0) {
            const newItems = [...this.internalValue()];
            newItems.pop();
            this.updateValue(newItems);
        }
    }

    /**
     * Commits a row. In {@link multiple} mode it toggles — re-picking a selected
     * option removes its chip — then clears the search box and refocuses the
     * input, leaving the list open for the next pick. In single mode it replaces
     * the selection and closes the list. Either way {@link updateValue} emits
     * {@link valueChange} and marks the control touched.
     */
    onSelect(option: T): void {
        const val = this.getValue(option);
        let newValues: T[];

        if (this.multiple()) {
            const currentVals = this.internalValue();
            const isAlreadySelected = currentVals.some(v => this.getValue(v) === val);

            if (isAlreadySelected) {
                newValues = currentVals.filter(v => this.getValue(v) !== val);
            } else {
                newValues = [...currentVals, option];
            }
            this.searchTerm.set('');
            this.inputEl()?.nativeElement.focus();
        } else {
            newValues = [option];
            this.open.set(false);
            this.searchTerm.set('');
        }

        this.updateValue(newValues);
    }

    /**
     * Chip "x" handler for {@link multiple} mode. Drops every selection matching
     * the item by {@link getValue} and emits {@link valueChange}. Stops
     * propagation so the click does not reach the container and re-open the
     * dropdown. Not guarded by {@link isDisabled} — but the chip buttons are only
     * reachable when the control is interactive.
     */
    removeItem(item: T, event: Event): void {
        event.stopPropagation();
        const val = this.getValue(item);
        const newValues = this.internalValue().filter(v => this.getValue(v) !== val);
        this.updateValue(newValues);
    }

    /**
     * The single write path for the selection: stores the array, then notifies
     * the reactive-forms `onChange`, emits {@link valueChange} and marks the
     * control touched. Flattens to the first entry (or `null`) unless
     * {@link multiple} is set. Call it to replace the selection imperatively —
     * unlike the {@link value} input, this *does* emit.
     */
    updateValue(newValues: T[]): void {
        this.internalValue.set(newValues);

        let emitValue: AutocompleteValue<T>;
        if (this.multiple()) {
            emitValue = newValues;
        } else {
            emitValue = newValues.length ? newValues[0] : null;
        }

        this.onChange(emitValue);
        this.value.set(emitValue);
        this.onTouched();
    }

    /**
     * `ControlValueAccessor` write. Accepts an array (used as-is, the shape to
     * use with {@link multiple}), a single value (wrapped into a one-item
     * selection) or `null`/`undefined` (clears it). Silently emits nothing back
     * to the form. The values written are matched against {@link options} by
     * {@link getValue}, so with no {@link valueAttribute} a form value must be the
     * very same object reference as an option to render its label — anything
     * else falls back to `String(value)` in the input and chips.
     */
    writeValue(value: AutocompleteValue<T>): void {
        if (value === null || value === undefined) {
            this.internalValue.set([]);
        } else if (Array.isArray(value)) {
            this.internalValue.set(value);
        } else {
            this.internalValue.set([value]);
        }
    }

    /**
     * `ControlValueAccessor` hook. The registered callback is invoked from
     * {@link updateValue} only — user selections and removals — never for
     * {@link searchTerm} edits or {@link value} input changes.
     */
    registerOnChange(fn: (value: AutocompleteValue<T>) => void): void {
        this.onChange = fn;
    }

    /**
     * `ControlValueAccessor` hook. The touched callback fires on blur of the
     * text box ({@link onBlur}) *and* on every {@link updateValue}, so selecting
     * with the keyboard marks the control touched without leaving it.
     */
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    /**
     * `ControlValueAccessor` hook, fully wired: `FormControl.disable()` greys the
     * container, disables the text box and blocks opening, exactly like the
     * {@link disabled} input. The two are OR-ed by `isDisabled`, so
     * `FormControl.enable()` cannot override `disabled="true"` bound in the
     * template — pick one mechanism per instance.
     */
    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }
}
