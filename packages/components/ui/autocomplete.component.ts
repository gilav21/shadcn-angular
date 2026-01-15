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
    inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { Subject, debounceTime as rxDebounceTime } from 'rxjs';
import { cn } from '../lib/utils';
import { PopoverComponent, PopoverContentComponent, PopoverTriggerComponent } from './popover.component';
import { CommandComponent, CommandListComponent, CommandItemComponent, CommandEmptyComponent, CommandService } from './command.component';
import { HighlightPipe } from './highlight.pipe';
import { BadgeComponent } from './badge.component';

let autocompleteIdCounter = 0;

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
    template: `
    <ui-popover [open]="open()" (openChange)="onOpenChange($event)">
      <ui-popover-trigger class="w-full">
        <div
          [class]="containerClasses()"
          [attr.data-state]="open() ? 'open' : 'closed'"
          [attr.data-disabled]="isDisabled() || null"
          (click)="onContainerClick($event)"
        >
          @if (multiple()) {
             <div class="flex flex-wrap items-center gap-1 w-full">
                @for (item of selectedItems(); track item; let i = $index) {
                   <ui-badge variant="secondary" class="gap-1 ltr:pr-0.5 rtl:pl-0.5">
                      {{ getDisplayValue(item) }}
                      <span
                        class="cursor-pointer rounded-full p-0.5 hover:bg-secondary-foreground/20"
                        role="button"
                        (click)="removeItem(item, $event)"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </span>
                   </ui-badge>
                }
                <input
                  #inputEl
                  type="text"
                  role="combobox"
                  aria-autocomplete="list"
                  [attr.aria-expanded]="open()"
                  [attr.aria-controls]="listId"
                  [attr.aria-activedescendant]="activeItemId()"
                  [class]="multiInputClasses()"
                  [placeholder]="selectedItems().length === 0 ? placeholder() : ''"
                  [disabled]="isDisabled()"
                  [(ngModel)]="searchTerm"
                  (input)="onInput($event)"
                  (keydown)="onKeydown($event)"
                  (blur)="onTouched()"
                />
             </div>
          } @else {
             <div class="flex items-center w-full gap-2">
                 <input
                    #inputEl
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    [attr.aria-expanded]="open()"
                    [attr.aria-controls]="listId"
                    [attr.aria-activedescendant]="activeItemId()"
                    [class]="singleInputClasses()"
                    [placeholder]="placeholder()"
                    [disabled]="isDisabled()"
                    [value]="inputValue()"
                    (input)="onInput($event)"
                    (keydown)="onKeydown($event)"
                    (blur)="onBlur()"
                    (focus)="onFocus()"
                 />
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 opacity-50 shrink-0"><path d="m6 9 6 6 6-6"/></svg>
             </div>
          }
        </div>
      </ui-popover-trigger>
      <ui-popover-content class="w-[--radix-popover-trigger-width] p-0" align="start" [restoreFocus]="false">
         <ui-command [shouldFilter]="filter()" [search]="searchTerm()">
            <ui-command-list [attr.id]="listId" role="listbox">
              <ui-command-empty>No results found.</ui-command-empty>
              
               @for (option of options(); track getTrackBy(option)) {
                 <ui-command-item
                    [value]="getSearchValue(option)"
                    [selected]="isSelected(option)"
                    (select)="onSelect(option)"
                  >
                   <span class="mr-2 flex h-4 w-4 items-center justify-center opacity-0" [class.opacity-100]="isSelected(option)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><polyline points="20 6 9 17 4 12"/></svg>
                   </span>
                   <span [innerHTML]="getDisplayValue(option) | highlight: searchTerm()"></span>
                 </ui-command-item>
               }
            </ui-command-list>
         </ui-command>
      </ui-popover-content>
    </ui-popover>
  `,
    host: { class: 'contents' },
})
export class AutocompleteComponent<T = unknown> implements ControlValueAccessor {
    options = input<T[]>([]);
    displayWith = input<(option: T) => string>((opt) => String(opt));
    valueAttribute = input<string | undefined>(undefined);
    filter = input(true);
    multiple = input(false);
    placeholder = input('Select...');
    disabled = input(false);
    class = input('');
    debounceTime = input(0);

    search = output<string>();

    open = signal(false);
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

    private onChange: (value: T | T[] | null) => void = () => { };
    onTouched: () => void = () => { };

    private formDisabled = signal(false);
    private destroyRef = inject(DestroyRef);
    private commandService = inject(CommandService, { optional: true });
    private searchSubject = new Subject<string>();

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
            return val as T;
        });
    });

    constructor() {
        this.searchSubject.pipe(
            rxDebounceTime(this.debounceTime()),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(val => this.search.emit(val));
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

    getSearchValue(option: T): string {
        return this.getDisplayValue(option);
    }

    isSelected(option: T): boolean {
        const val = this.getValue(option);
        return this.internalValue().some(v => this.getValue(v as T) === val);
    }

    onContainerClick(event: MouseEvent) {
        if (this.isDisabled()) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        this.inputEl()?.nativeElement.focus();
    }

    onFocus() {
        if (!this.isDisabled() && !this.open()) {
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
            this.open.set(true);
        }
    }

    onKeydown(event: KeyboardEvent) {
        if (this.isDisabled()) return;

        const cmd = this.command();

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!this.open()) this.open.set(true);
            else cmd?.moveNext();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!this.open()) this.open.set(true);
            else cmd?.movePrev();
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
            const isAlreadySelected = currentVals.some(v => this.getValue(v as T) === val);

            if (isAlreadySelected) {
                newValues = currentVals.filter(v => this.getValue(v as T) !== val);
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
        const newValues = this.internalValue().filter(v => this.getValue(v as T) !== val);
        this.updateValue(newValues);
    }

    updateValue(newValues: T[]) {
        this.internalValue.set(newValues);

        if (this.multiple()) {
            this.onChange(newValues);
        } else {
            this.onChange(newValues.length ? newValues[0] : null);
        }
        this.onTouched();
    }

    writeValue(value: T | T[] | null): void {
        if (value === null || value === undefined) {
            this.internalValue.set([]);
        } else if (Array.isArray(value)) {
            this.internalValue.set(value);
        } else {
            this.internalValue.set([value]);
        }
    }

    registerOnChange(fn: (value: T | T[] | null) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }
}
