import {
    ChangeDetectionStrategy,
    Component,
    effect,
    ElementRef,
    forwardRef,
    inject,
    InjectionToken,
    input,
    OnDestroy,
    output,
    computed,
    signal,
    ViewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn, isRtl } from '../../lib/utils';
import { COMMON_LOCALES, type CommonLocale, createLocaleSelector, type LocaleInput } from '../../lib/i18n';

export const SELECT = new InjectionToken<SelectComponent<unknown>>('SELECT');

@Component({
    selector: 'ui-select',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (isDataDriven()) {
            <div class="relative inline-block w-full">
                <button
                    type="button"
                    role="combobox"
                    [class]="triggerClasses()"
                    [disabled]="isDisabled()"
                    [attr.aria-expanded]="open()"
                    [attr.data-state]="open() ? 'open' : 'closed'"
                    [attr.aria-controls]="listId"
                    (click)="toggle()"
                    (keydown)="onTriggerKeyDown($event)"
                >
                    <span class="flex-1 truncate ltr:text-left rtl:text-right">
                        @if (hasValue()) {
                            {{ selectedDisplayValue() }}
                        } @else {
                            <span class="text-muted-foreground">{{ placeholder() }}</span>
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
    host: { class: 'relative inline-block' },
    providers: [
        { provide: SELECT, useExisting: forwardRef(() => SelectComponent) },
        { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }
    ],
})
export class SelectComponent<T = string> implements OnDestroy, ControlValueAccessor {
    private readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);

    readonly disabled = input(false);
    /** Override for the placeholder. Falls back to the locale's `selectPlaceholder`. */
    readonly placeholder = input<string>();
    readonly defaultValue = input<T | undefined>(undefined);

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CommonLocale>>();
    protected readonly t = createLocaleSelector(this.locale, COMMON_LOCALES);
    /** Effective placeholder — explicit input wins; otherwise falls back to the locale. */
    readonly resolvedPlaceholder = computed(() => this.placeholder() ?? this.t().selectPlaceholder);
    readonly position = input<'popper' | 'item-aligned'>('item-aligned');
    readonly options = input<T[]>([]);
    readonly displayWith = input<(option: T) => string>(String);
    readonly value = input<T | undefined>(undefined);
    readonly valueAttribute = input<string | undefined>(undefined);
    readonly disabledWith = input<(option: T) => boolean>(() => false);

    internalValue = signal<T | undefined>(undefined);
    open = signal(false);
    focusedIndex = signal(0);

    readonly valueChange = output<T>();

    private static nextId = 0;
    readonly listId = `select-list-${++SelectComponent.nextId}`;

    private _onChange: (value: T) => void = () => { };
    private _onTouched: () => void = () => { };
    private readonly _disabled = signal(false);

    readonly isDisabled = computed(() => this.disabled() || this._disabled());
    readonly isDataDriven = computed(() => this.options().length > 0);
    readonly hasValue = computed(() => this.internalValue() !== undefined && this.internalValue() !== null);

    readonly selectedDisplayValue = computed(() => {
        const val = this.internalValue();
        if (val === undefined || val === null) return '';

        if (this.isDataDriven()) {
            const option = this.options().find(opt => this.getValue(opt) === val);
            return option ? this.getDisplayValue(option) : String(val);
        }
        return String(val);
    });

    private readonly itemElements = new Map<string, HTMLElement>();

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private readonly clickListener = (event: MouseEvent) => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.close();
        }
    };

    private readonly keydownListener = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.open()) {
            this.close();
        }
    };

    readonly triggerClasses = computed(() => cn(
        'border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50',
        'flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm',
        'whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50 h-9 [&>span]:line-clamp-1',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
        'dark:bg-input/50 dark:hover:bg-input/70'
    ));

    readonly contentClasses = computed(() => cn(
        'absolute z-50 max-h-60 min-w-[8rem] w-full overflow-y-auto rounded-md border bg-popover p-0 text-popover-foreground shadow-md',
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

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener);
        this.document.removeEventListener('keydown', this.keydownListener);
    }

    getDisplayValue(option: T): string {
        return this.displayWith()(option);
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

    isSelected(option: T): boolean {
        return this.getValue(option) === this.internalValue();
    }

    isOptionDisabled(option: T): boolean {
        return this.disabledWith()(option);
    }

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

    selectOption(option: T) {
        if (this.isOptionDisabled(option)) return;
        const val = this.getValue(option) as T;
        this.internalValue.set(val);
        this.valueChange.emit(val);
        this._onChange(val);
        this.close();
    }

    toggle() {
        if (!this.isDisabled()) {
            this.open.update(v => !v);
        }
    }

    close() {
        this.open.set(false);
        this._onTouched();
    }

    select(val: T) {
        this.internalValue.set(val);
        this.valueChange.emit(val);
        this._onChange(val);
        this.close();
    }

    registerItem(value: string, element: HTMLElement) {
        this.itemElements.set(value, element);
    }

    unregisterItem(value: string) {
        this.itemElements.delete(value);
    }

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

    getTriggerElement(): HTMLElement | null {
        return this.el.nativeElement.querySelector('[data-slot="select-trigger"]')
            || this.el.nativeElement.querySelector('button[role="combobox"]');
    }

    isRtl(): boolean {
        return isRtl(this.el.nativeElement);
    }

    onTriggerKeyDown(event: KeyboardEvent) {
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

    onContentKeydown(event: KeyboardEvent) {
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

    writeValue(value: T): void {
        this.internalValue.set(value);
    }

    registerOnChange(fn: (value: T) => void): void {
        this._onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this._onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this._disabled.set(isDisabled);
    }
}

