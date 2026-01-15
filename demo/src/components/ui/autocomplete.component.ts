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
    viewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../lib/utils';
import { PopoverComponent, PopoverContentComponent, PopoverTriggerComponent } from './popover.component';
import { CommandComponent, CommandInputComponent, CommandListComponent, CommandItemComponent, CommandEmptyComponent } from './command.component';
import { HighlightPipe } from './highlight.pipe';
import { BadgeComponent } from './badge.component';

@Component({
    selector: 'ui-autocomplete',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        PopoverComponent,
        PopoverContentComponent,
        PopoverTriggerComponent,
        CommandComponent,
        CommandInputComponent,
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
            <ui-command-list>
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
export class AutocompleteComponent implements ControlValueAccessor {
    options = input<unknown[]>([]);
    displayWith = input<(option: unknown) => string>((opt) => String(opt));
    valueAttribute = input<string | undefined>(undefined);
    filter = input(true);
    multiple = input(false);
    placeholder = input('Select...');
    disabled = input(false);
    class = input('');

    search = output<string>();

    open = signal(false);
    searchTerm = model('');
    internalValue = signal<unknown[]>([]);

    // For single mode: what to show in the input
    // If open -> shows searchTerm
    // If closed -> shows selected value label
    inputValue = computed(() => {
        if (this.open()) {
            return this.searchTerm();
        }
        const selected = this.selectedItems();
        return selected.length > 0 ? this.getDisplayValue(selected[0]) : '';
    });

    inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
    command = viewChild(CommandComponent);

    private onChange: (value: unknown) => void = () => { };
    onTouched: () => void = () => { };

    private formDisabled = signal(false);

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

    getDisplayValue(option: any): string {
        return this.displayWith()(option);
    }

    getValue(option: any): any {
        if (this.valueAttribute()) {
            return option[this.valueAttribute()!];
        }
        return option;
    }

    getTrackBy(option: any): string {
        return String(this.getValue(option));
    }

    getSearchValue(option: any): string {
        return this.getDisplayValue(option);
    }

    isSelected(option: any): boolean {
        const val = this.getValue(option);
        return this.internalValue().includes(val);
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
            // If we just selected an item, skip opening immediately if that was the intent?
            // Actually, usually focusing opens the combobox
            this.open.set(true);
        }
    }

    onBlur() {
        this.onTouched();
        // If single select and we have text but no selection?
        // Usually we revert to the selected value or clear if nothing selected.
        // We let the inputValue computed handle the reversion on render.
        // The popover close might happen before or after.
        // If we click outside, popover closes -> open(false) -> inputValue recalcs -> reverts.
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
        this.search.emit(val);

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

    onSelect(option: any) {
        const val = this.getValue(option);
        let newValues: any[];

        if (this.multiple()) {
            if (this.internalValue().includes(val)) {
                newValues = this.internalValue().filter(v => v !== val);
            } else {
                newValues = [...this.internalValue(), val];
            }
            this.searchTerm.set('');
            // Keep open in multi select? user pref. usually keep open or close.
            // keeping open for multi is nice.
            this.inputEl()?.nativeElement.focus();
        } else {
            newValues = [val];
            this.open.set(false);
            this.searchTerm.set(''); // Clear search term so computed inputValue shows label effectively
        }

        this.updateValue(newValues);
    }

    removeItem(item: any, event: MouseEvent) {
        event.stopPropagation();
        const val = this.getValue(item);
        const newValues = this.internalValue().filter(v => v !== val);
        this.updateValue(newValues);
    }

    updateValue(newValues: any[]) {
        this.internalValue.set(newValues);

        if (this.multiple()) {
            this.onChange(newValues);
        } else {
            this.onChange(newValues.length ? newValues[0] : null);
        }
        this.onTouched();
    }

    writeValue(value: any): void {
        if (value === null || value === undefined) {
            this.internalValue.set([]);
        } else if (Array.isArray(value)) {
            this.internalValue.set(value);
        } else {
            this.internalValue.set([value]);
        }
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }
}
