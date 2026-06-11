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
import { COMMON_LOCALES, type CommonLocale, createLocaleBindings, type LocaleInput } from '../../../lib/i18n';
import { CommandService } from '../command.component';

@Component({
  selector: 'ui-command-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center border-b px-3" [attr.data-slot]="'command-input'" [attr.dir]="dir()">
      <svg class="h-4 w-4 shrink-0 opacity-50 ltr:mr-2 rtl:ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        #inputEl
        [class]="inputClasses()"
        [placeholder]="placeholder() ?? t().searchPlaceholder"
        [value]="cmdService.search()"
        [attr.aria-label]="ariaLabel() ?? t().search"
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

  /** Override for the placeholder. Falls back to the locale's `searchPlaceholder`. */
  readonly placeholder = input<string>();
  /** Override for the aria-label. Falls back to the locale's `search`. */
  readonly ariaLabel = input<string>();
  readonly value = input<string>('');

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<CommonLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

  constructor() {
    if (this.value()) {
      this.cmdService.search.set(this.value());
    }
  }

  inputClasses = computed(() => cn(
    'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none',
    'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
  ));

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cmdService.search.set(value);
    if (this.cmdService.filteredItems().length > 0) {
      this.cmdService.activeItemId.set(this.cmdService.filteredItems()[0]);
    } else {
      this.cmdService.activeItemId.set(null);
    }
  }

  onKeydown(event: KeyboardEvent): void {
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

  focus(): void {
    this.inputEl?.nativeElement?.focus();
  }
}
