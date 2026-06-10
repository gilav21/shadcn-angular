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
import { COMMON_LOCALES, type CommonLocale, createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { PopoverComponent, PopoverContentComponent, PopoverTriggerComponent } from '../popover';
import { CommandComponent, CommandListComponent, CommandItemComponent, CommandEmptyComponent, CommandService } from '../command';
import { HighlightPipe } from './highlight.pipe';
import { BadgeComponent } from '../badge';

let autocompleteIdCounter = 0;

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

    options = input<T[]>([]);
    displayWith = input<(option: T) => string>(String);
    valueAttribute = input<string | undefined>(undefined);
    filter = input(true);
    multiple = input(false);
    /** Override for the placeholder. Falls back to the locale's `selectPlaceholder`. */
    placeholder = input<string>();
    disabled = input(false);
    class = input('');
    debounceTime = input(0);
    readonly value = input<T | T[] | undefined>(undefined);

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CommonLocale>>();
    private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    search = output<string>();
    valueChange = output<AutocompleteValue<T>>();

    open = signal(false);
    readonly dropdownSide = signal<'top' | 'bottom'>('bottom');
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
    private readonly commandService = inject(CommandService, { optional: true });
    private readonly searchSubject = new Subject<string>();

    activeItemId = computed(() => {
        return this.commandService?.activeItemId() ?? null;
    });

    isDisabled = computed(() => this.disabled() || this.formDisabled());

    containerClasses = computed(() => cn(
        'flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-text',
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
        ).subscribe(val => this.search.emit(val));

        effect(() => {
            const val = this.value();
            if (val !== undefined) {
                if (Array.isArray(val)) {
                    this.internalValue.set(val);
                } else {
                    this.internalValue.set([val]);
                }
            }
        });
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

    getDisplayValue(option: T): string {
        const displayFn = this.displayWith();
        if (typeof displayFn !== 'function') {
            console.warn('Autocomplete: displayWith is not a function', displayFn);
            return String(option);
        }
        return displayFn(option);
    }

    getValue(option: T): unknown {
        if (this.valueAttribute()) {
            return (option as Record<string, unknown>)[this.valueAttribute()!];
        }
        return option;
    }

    getTrackBy(option: T): string {
        return String(this.getValue(option));
    }

    getSearchValue(option: T): string {
        return this.getDisplayValue(option);
    }

    isSelected(option: T): boolean {
        const val = this.getValue(option);
        return this.internalValue().some(v => this.getValue(v) === val);
    }

    onContainerClick(event: MouseEvent) {
        if (this.isDisabled()) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        this.inputEl()?.nativeElement.focus();
        event.stopPropagation();
    }

    onFocus() {
        if (!this.isDisabled() && !this.open()) {
            this.resolveDropdownSide();
            this.open.set(true);
        }
    }

    onBlur() {
        this.onTouched();
    }

    onOpenChange(isOpen: boolean) {
        if (!this.isDisabled()) {
            this.open.set(isOpen);
            if (!isOpen) {
                this.searchTerm.set('');
            }
        }
    }

    onInput(event: Event) {
        const target = event.target as HTMLInputElement;
        const val = target.value;
        this.searchTerm.set(val);

        if (this.debounceTime() > 0) {
            this.searchSubject.next(val);
        } else {
            this.search.emit(val);
        }

        if (!this.open()) {
            this.resolveDropdownSide();
            this.open.set(true);
        }
    }

    onKeydown(event: KeyboardEvent) {
        if (this.isDisabled()) return;

        const cmd = this.command();

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (this.open()) {cmd?.moveNext();}
            else { this.resolveDropdownSide(); this.open.set(true); }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (this.open()) {cmd?.movePrev();}
            else { this.resolveDropdownSide(); this.open.set(true); }
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (this.open()) {
                cmd?.selectActive();
            }
        } else if (event.key === 'Escape') {
            this.open.set(false);
        } else if (event.key === 'Backspace' && this.multiple() && this.searchTerm() === '' && this.selectedItems().length > 0) {
            const newItems = [...this.internalValue()];
            newItems.pop();
            this.updateValue(newItems);
        }
    }

    onSelect(option: T) {
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

    removeItem(item: T, event: MouseEvent) {
        event.stopPropagation();
        const val = this.getValue(item);
        const newValues = this.internalValue().filter(v => this.getValue(v) !== val);
        this.updateValue(newValues);
    }

    updateValue(newValues: T[]) {
        this.internalValue.set(newValues);

        let emitValue: AutocompleteValue<T>;
        if (this.multiple()) {
            emitValue = newValues;
        } else {
            emitValue = newValues.length ? newValues[0] : null;
        }

        this.onChange(emitValue);
        this.valueChange.emit(emitValue);
        this.onTouched();
    }

    writeValue(value: AutocompleteValue<T>): void {
        if (value === null || value === undefined) {
            this.internalValue.set([]);
        } else if (Array.isArray(value)) {
            this.internalValue.set(value);
        } else {
            this.internalValue.set([value]);
        }
    }

    registerOnChange(fn: (value: AutocompleteValue<T>) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }
}
