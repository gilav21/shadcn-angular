import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../../lib/i18n/common.locales';
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
export class CommandInputComponent implements OnInit {
  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;
  readonly cmdService = inject(CommandService);

  /** Override for the placeholder. Falls back to the locale's `searchPlaceholder`. */
  readonly placeholder = input<string>();
  /** Override for the aria-label. Falls back to the locale's `search`. */
  readonly ariaLabel = input<string>();
  /**
   * Seed query, applied to the shared search state once in `ngOnInit` and only
   * when non-empty — later changes to this input are ignored. Bind
   * `search` on the parent `ui-command` for a genuinely controlled query.
   */
  readonly value = input<string>('');

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<CommonLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

  ngOnInit(): void {
    if (this.value()) {
      this.cmdService.search.set(this.value());
    }
  }

  inputClasses = computed(() => cn(
    'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none',
    'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
  ));

  /**
   * Native `input` handler: publishes the typed text as the palette's search
   * query and resets the highlight to the first surviving item (or clears it
   * when nothing matches), so Enter never fires a result the user scrolled past
   * before refining the query.
   */
  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cmdService.search.set(value);
    if (this.cmdService.filteredItems().length > 0) {
      this.cmdService.activeItemId.set(this.cmdService.filteredItems()[0]);
    } else {
      this.cmdService.activeItemId.set(null);
    }
  }

  /**
   * Keyboard driver for the palette: ArrowDown/ArrowUp move the highlight
   * through the filtered items (wrapping at both ends) and Enter activates the
   * highlighted one. All three call `preventDefault()`, so the caret never
   * jumps within the text and Enter never submits a surrounding form. Every
   * other key falls through to normal typing.
   *
   * While a nested page is open, Escape and Backspace-on-an-empty-query go
   * *back* one level instead: both `preventDefault()` **and**
   * `stopPropagation()`, so the first Escape leaves the submenu rather than
   * closing the whole dialog. At the top level neither key is intercepted, so
   * Escape still closes `ui-command-dialog` exactly as before.
   */
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
    } else if (this.shouldGoBack(event)) {
      event.preventDefault();
      event.stopPropagation();
      this.cmdService.popPage();
    }
  }

  private shouldGoBack(event: KeyboardEvent): boolean {
    if (this.cmdService.currentPage() === null) return false;
    if (event.key === 'Escape') return true;
    return event.key === 'Backspace' && this.cmdService.search() === '';
  }

  /** Focuses the text field; safe to call before the view exists (it no-ops). `ui-command-dialog` calls this on every open so typing starts immediately. */
  focus(): void {
    this.inputEl?.nativeElement?.focus();
  }
}
