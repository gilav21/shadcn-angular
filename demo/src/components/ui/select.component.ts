
import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    InjectionToken,
    ElementRef,
    OnDestroy,
    forwardRef,
    AfterViewInit,
    effect,
    ViewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn, isRtl } from '../lib/utils';

export const SELECT = new InjectionToken<SelectComponent>('SELECT');

import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
    selector: 'ui-select',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'relative inline-block' },
    providers: [
        { provide: SELECT, useExisting: forwardRef(() => SelectComponent) },
        { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }
    ],
})
export class SelectComponent implements OnDestroy, ControlValueAccessor {
    private el = inject(ElementRef);
    private document = inject(DOCUMENT);

    value = signal<string | undefined>(undefined);
    open = signal(false);
    disabled = input(false);
    placeholder = input('Select an option');
    defaultValue = input<string | undefined>(undefined);
    position = input<'popper' | 'item-aligned'>('item-aligned');
    valueChange = output<string>();

    // CVA State
    private _onChange: (value: string) => void = () => { };
    private _onTouched: () => void = () => { };
    private _disabled = signal(false);

    isDisabled = computed(() => this.disabled() || this._disabled());

    // Track item elements for positioning
    private itemElements = new Map<string, HTMLElement>();

    private clickListener = (event: MouseEvent) => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.close();
        }
    };


    private keydownListener = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.open()) {
            this.close();
        }
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener);
        this.document.addEventListener('keydown', this.keydownListener);
        const defaultVal = this.defaultValue();
        if (defaultVal) {
            this.value.set(defaultVal);
        }
    }

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener);
        this.document.removeEventListener('keydown', this.keydownListener);
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

    select(val: string) {
        this.value.set(val);
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
        const currentValue = this.value();
        if (currentValue) {
            const element = this.itemElements.get(currentValue);
            if (element) {
                return element.offsetTop;
            }
        }
        // Default to first item if no selection
        const firstItem = this.itemElements.values().next().value;
        return firstItem ? firstItem.offsetTop : 0;
    }

    getTriggerElement(): HTMLElement | null {
        return this.el.nativeElement.querySelector('[data-slot="select-trigger"]');
    }

    /** Check if the component is in RTL mode by reading from the DOM */
    isRtl(): boolean {
        return isRtl(this.el.nativeElement);
    }

    // ControlValueAccessor implementation
    writeValue(value: string): void {
        this.value.set(value);
    }

    registerOnChange(fn: any): void {
        this._onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this._onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this._disabled.set(isDisabled);
    }
}

@Component({
    selector: 'ui-select-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      type="button"
      role="combobox"
      [class]="classes()"
      [disabled]="select?.isDisabled() ?? false"
      [attr.aria-expanded]="select?.open()"
      [attr.data-state]="select?.open() ? 'open' : 'closed'"
      [attr.aria-label]="ariaLabel()"
      [attr.data-slot]="'select-trigger'"
      (click)="onClick($event)"
      (keydown)="onKeyDown($event)"
    >
      <ng-content />
      <svg
        [class]="chevronClasses()"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  `,
    host: { class: 'contents' },
})
export class SelectTriggerComponent {
    select = inject(SELECT, { optional: true });
    class = input('');
    ariaLabel = input<string | undefined>(undefined);

    classes = computed(() =>
        cn(
            'border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9 [&>span]:line-clamp-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 dark:bg-input/50 dark:hover:bg-input/70',
            this.class()
        )
    );

    chevronClasses = computed(() =>
        cn(
            'size-4 opacity-50 shrink-0'
        )
    );

    onClick(event: MouseEvent) {
        event.stopPropagation();
        this.select?.toggle();
    }

    onKeyDown(event: KeyboardEvent) {
        if (this.select?.isDisabled()) return;

        switch (event.key) {
            case 'Enter':
            case ' ':
            case 'ArrowDown':
                event.preventDefault();
                if (!this.select?.open()) {
                    this.select?.open.set(true);
                }
                break;
        }
    }
}

@Component({
    selector: 'ui-select-value',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (hasValue()) {
      <span class="truncate">{{ shownValue() }}</span>
    } @else {
      <span class="text-muted-foreground truncate">{{ placeholder() }}</span>
    }
  `,
    host: {
        '[class]': 'hostClasses()',
        '[attr.data-slot]': '"select-value"'
    },
})
export class SelectValueComponent {
    private select = inject(SELECT, { optional: true });
    placeholder = input('Select an option');
    displayValue = input<string | undefined>(undefined);

    hasValue = computed(() => !!this.select?.value());
    shownValue = computed(() => this.displayValue() ?? this.select?.value() ?? '');

    hostClasses = computed(() =>
        cn(
            'flex-1 truncate ltr:text-left rtl:text-right'
        )
    );
}

@Component({
    selector: 'ui-select-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (select?.open()) {
      <div 
        #contentEl
        [class]="classes()" 
        [style]="positionStyles()"
        role="listbox" 
        tabindex="-1"
        [attr.data-slot]="'select-content'"
        [attr.data-position]="position()"
        (keydown)="onKeydown($event)">
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class SelectContentComponent implements AfterViewInit {
    select = inject(SELECT, { optional: true });
    private el = inject(ElementRef);
    private document = inject(DOCUMENT);

    class = input('');
    position = input<'popper' | 'item-aligned'>('item-aligned');

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private offsetY = signal(0);
    private previousActiveElement: HTMLElement | null = null;

    constructor() {
        effect(() => {
            if (this.select?.open()) {
                this.previousActiveElement = this.document.activeElement as HTMLElement;

                setTimeout(() => {
                    this.calculatePosition();
                    this.focusContent();
                }, 0);
            } else {
                // Restore focus when closing
                if (this.previousActiveElement && this.document.body.contains(this.previousActiveElement)) {
                    this.previousActiveElement.focus();
                }
                this.previousActiveElement = null;
            }
        });
    }

    ngAfterViewInit() {
        if (this.select?.open()) {
            this.calculatePosition();
            this.focusContent();
        }
    }

    private calculatePosition() {
        const pos = this.select?.position() ?? this.position();
        if (pos === 'item-aligned' && this.contentEl?.nativeElement) {
            const selectedOffset = this.select?.getSelectedItemOffset() ?? 0;
            // Add padding offset (p-1 = 4px)
            this.offsetY.set(-(selectedOffset + 4));
        } else {
            this.offsetY.set(0);
        }
    }

    private focusContent() {
        if (!this.contentEl?.nativeElement) return;

        const content = this.contentEl.nativeElement;
        const selectedItem = content.querySelector<HTMLElement>('[data-state="checked"]');

        if (selectedItem) {
            selectedItem.focus({ preventScroll: true });
        } else {
            content.focus({ preventScroll: true });
        }
    }

    onKeydown(event: KeyboardEvent) {
        if (!this.contentEl?.nativeElement) return;

        const items = Array.from(this.contentEl.nativeElement.querySelectorAll<HTMLElement>('[data-slot="select-item"]:not([data-disabled])'));

        if (!items.length) return;

        const currentFocus = this.document.activeElement as HTMLElement;
        const currentIndex = items.indexOf(currentFocus);

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = (currentIndex + 1) % items.length;
            items[nextIndex]?.focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const prevIndex = (currentIndex - 1 + items.length) % items.length;
            items[prevIndex]?.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
            // Already handled by item click/click listener, but for safety in listbox
            if (currentIndex >= 0) {
                items[currentIndex].click();
                event.preventDefault();
            }
        }
    }

    positionStyles = computed(() => {
        const pos = this.select?.position() ?? this.position();
        if (pos === 'item-aligned') {
            const offset = this.offsetY();
            return `top: ${offset}px; margin-top: 0;`;
        }
        return '';
    });

    classes = computed(() => {
        const pos = this.select?.position() ?? this.position();
        const isItemAligned = pos === 'item-aligned';

        return cn(
            'absolute z-50 max-h-96 min-w-[8rem] w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            'animate-in fade-in-0 zoom-in-95',
            isItemAligned ? 'top-0' : 'top-full mt-1',
            'ltr:left-0 rtl:right-0',
            this.class()
        );
    });
}

@Component({
    selector: 'ui-select-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <ng-content />
    <span [class]="checkmarkClasses()">
      @if (isSelected()) {
        <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      }
    </span>
  `,
    host: {
        '[class]': 'classes()',
        '[attr.role]': '"option"',
        '[attr.aria-selected]': 'isSelected()',
        '[attr.data-state]': 'isSelected() ? "checked" : "unchecked"',
        '[attr.data-slot]': '"select-item"',
        '[attr.tabindex]': '"-1"',
        '(click)': 'onClick()',
    },
})
export class SelectItemComponent implements AfterViewInit, OnDestroy {
    private select = inject(SELECT, { optional: true });
    private el = inject(ElementRef);

    value = input.required<string>();
    disabled = input(false);
    class = input('');

    isSelected = computed(() => this.select?.value() === this.value());

    classes = computed(() => {
        return cn(
            'focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
            'ltr:pr-8 ltr:pl-2 rtl:pl-8 rtl:pr-2',
            this.disabled() && 'pointer-events-none opacity-50',
            this.class()
        );
    });

    checkmarkClasses = computed(() => {
        return cn(
            'absolute flex size-3.5 items-center justify-center ltr:right-2 rtl:left-2'
        );
    });

    ngAfterViewInit() {
        this.select?.registerItem(this.value(), this.el.nativeElement);
    }

    ngOnDestroy() {
        this.select?.unregisterItem(this.value());
    }

    onClick() {
        if (!this.disabled()) {
            this.select?.select(this.value());
        }
    }
}

@Component({
    selector: 'ui-select-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': '"p-1 contents"',
        '[attr.role]': '"group"',
        '[attr.data-slot]': '"select-group"',
    },
})
export class SelectGroupComponent { }

@Component({
    selector: 'ui-select-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-muted-foreground px-2 py-1.5 text-xs',
        '[attr.data-slot]': '"select-label"',
    },
})
export class SelectLabelComponent { }

@Component({
    selector: 'ui-select-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        class: 'bg-border pointer-events-none -mx-1 my-1 h-px',
        '[attr.data-slot]': '"select-separator"',
    },
})
export class SelectSeparatorComponent { }
