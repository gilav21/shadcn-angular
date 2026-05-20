import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  ViewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CommandService } from '../command.component';

@Component({
  selector: 'ui-command-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center border-b px-3" [attr.data-slot]="'command-input'">
      <svg class="h-4 w-4 shrink-0 opacity-50 ltr:mr-2 rtl:ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        #inputEl
        [class]="inputClasses()"
        [placeholder]="placeholder()"
        [value]="cmdService.search()"
        [attr.aria-label]="ariaLabel()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
      />
    </div>
  `,
  host: { class: 'contents' },
})
export class CommandInputComponent {
  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;
  readonly cmdService = inject(CommandService);

  placeholder = input('Search...');
  ariaLabel = input('Search');
  value = input<string>('');

  constructor() {
    if (this.value()) {
      this.cmdService.search.set(this.value());
    }
  }

  inputClasses = computed(() => cn(
    'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none',
    'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
  ));

  onInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.cmdService.search.set(value);
    if (this.cmdService.filteredItems().length > 0) {
      this.cmdService.activeItemId.set(this.cmdService.filteredItems()[0]);
    } else {
      this.cmdService.activeItemId.set(null);
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.cmdService.moveNext();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.cmdService.movePrev();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.cmdService.selectActive();
    }
  }

  focus() {
    this.inputEl?.nativeElement?.focus();
  }
}
