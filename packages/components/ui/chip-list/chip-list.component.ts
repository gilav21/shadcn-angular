import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
  viewChild,
  ElementRef,
  afterRenderEffect,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../../lib/utils';
import { readableForeground } from '../../lib/color';
import { BadgeComponent, type BadgeVariant } from '../badge';
import { InputComponent } from '../input';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';
import { cva, type VariantProps } from 'class-variance-authority';

/** `KeyboardEvent.keyCode` an IME reports while it owns the key. */
const IME_KEY_CODE = 229;

const chipListVariants = cva(
  'w-full flex-wrap flex items-center px-1 transition-[color,box-shadow] outline-none has-[input:focus-visible]:ring-[3px]',
  {
    variants: {
      variant: {
        outline: 'rounded-md border-input shadow-xs has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50',
        underline: 'rounded-none border-input has-[input:focus-visible]:border-ring px-0 has-[input:focus-visible]:ring-0',
        ghost: 'border-none shadow-none has-[input:focus-visible]:ring-0',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  }
);

export type ChipListVariant = VariantProps<typeof chipListVariants>['variant'];

/** How large each chip is drawn; the row cap and the inline field follow whichever is chosen. */
export type ChipListSize = 'sm' | 'md' | 'lg';

/** The chip font per size. Chip height comes from the stylesheet, so a size and a density can never disagree about it. */
const CHIP_FONTS: Record<ChipListSize, string> = {
  sm: 'text-[0.6875rem] leading-[0.875rem]',
  md: '',
  lg: 'text-sm leading-5',
};

@Component({
  selector: 'ui-chip-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, InputComponent, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ChipListComponent),
      multi: true,
    },
    { provide: UI_INPUT_GROUP, useExisting: forwardRef(() => ChipListComponent) }
  ],
  templateUrl: './chip-list.component.html',
  styleUrl: './chip-list.component.css',
  host: {
    '[class]': '"contents"',
  },
})
export class ChipListComponent implements ControlValueAccessor {
  /**
   * Text shown in the inline text field, and its `aria-label`. The placeholder
   * text itself is cleared once the first chip exists (the label stays), so it
   * never competes visually with the chips beside it.
   */
  placeholder = input('Add item...');
  /**
   * Disables the whole control: the field is inert, the per-chip remove buttons
   * are removed from the DOM entirely (not just hidden), and {@link focusInput}
   * becomes a no-op. A reactive `control.disable()` disables the control too —
   * both sources are OR-ed together by {@link isDisabled}.
   */
  disabled = input(false);
  /** Shell styling of the chip container: bordered box (`outline`), a single bottom rule (`underline`), or no chrome at all (`ghost`). Only `outline`/`underline` render a focus ring. */
  variant = input<ChipListVariant>('outline');
  /** Badge variant used for every chip. Overridden per chip to `default` whenever {@link chipColors} supplies that chip a background. */
  badgeVariant = input<BadgeVariant>('default');
  /** Merged onto the chip container (after the {@link variant} classes), so it can override the border, ring, or padding. */
  class = input('');

  /**
   * Per-chip background colours keyed by the exact chip text. A matched chip is
   * forced to the `default` badge variant and painted with this background,
   * border, and a luminance-derived foreground (see {@link chipForeground}) so
   * light colours stay readable. Unlisted chips keep {@link badgeVariant}.
   */
  chipColors = input<Record<string, string>>({});
  /**
   * Caps the container at this many rows of chips and makes it scroll instead
   * of growing. The cap is derived from the same size and density variables
   * that size the chips, so it holds at any {@link size}, density or root font
   * size. `0` (default) means unlimited — the container grows with every added
   * chip.
   */
  maxRows = input(0);
  /** Chip size: `'sm'`, `'md'` (default) or `'lg'`. The chips, the inline field and the {@link maxRows} cap all scale with it, and with density. */
  size = input<ChipListSize>('md');
  /** When `false` (default), re-adding text that already exists as a chip is silently dropped and only clears the field. Set `true` to allow repeats. */
  allowDuplicates = input(false);
  /**
   * Extra `KeyboardEvent.key` values that commit the typed text as a chip, e.g.
   * `[',', ' ']`. Enter always commits regardless of this list; the keys are
   * matched exactly and are consumed (`preventDefault`) so they never reach the
   * text field.
   */
  separatorKeys = input<string[]>([]);

  /** Emits the trimmed chip text after it has been appended — not emitted for text rejected as a duplicate. */
  chipAdded = output<string>();
  /** Emits the removed chip's text, both for the remove button ({@link removeChip}) and for the Backspace-on-empty-field shortcut. */
  chipRemoved = output<string>();

  chips = signal<string[]>([]);
  inputValue = signal('');

  /**
   * Text colour for a chip painted with a caller-supplied background. Hardcoding
   * white failed WCAG AA on any light chip colour; deriving it from the
   * background's luminance keeps the caller's colour and stays legible.
   */
  chipForeground(chip: string): string | null {
    const background = this.chipColors()[chip];
    return background ? readableForeground(background) : null;
  }

  inputComponent = viewChild.required(InputComponent);

  private onChange: (value: string[]) => void = () => { };
  private onTouched: () => void = () => { };

  private readonly formDisabled = signal(false);

  /** Effective disabled state: the {@link disabled} input OR a reactive `control.disable()` relayed through {@link setDisabledState}. */
  readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  containerClasses = computed(() => cn(
    chipListVariants({ variant: this.variant() }),
    this.isDisabled() && 'opacity-50 cursor-not-allowed',
    this.maxRows() > 0 && 'overflow-y-auto',
    this.class()
  ));

  /** Font classes for each chip, from {@link size}. */
  chipFont = computed(() => CHIP_FONTS[this.size()]);

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private revealInputAfterRender = false;

  constructor() {
    // After a chip is added the field is on the last row; a capped list scrolls to it so the user is not typing out of sight.
    afterRenderEffect(() => {
      this.chips();
      if (!this.revealInputAfterRender) return;
      this.revealInputAfterRender = false;
      const box = this.container().nativeElement;
      box.scrollTop = box.scrollHeight;
    });
  }

  /**
   * Redirects a key pressed on the container itself to the text field. A key
   * aimed at a child control (a chip's remove button) is that control's: acting
   * on it would swallow the button's own Enter/Space activation.
   */
  focusFromContainer(event: Event): void {
    if (event.target !== event.currentTarget) return;
    this.focusInput();
  }

  /** Moves focus into the inline text field. Also bound to a click/Enter/Space anywhere on the container so the whole chip area behaves like one input. No-op while {@link isDisabled}. */
  focusInput(): void {
    if (this.isDisabled()) return;
    this.inputComponent().focus();
  }

  /** `ngModelChange` handler for the inline field; only mirrors the draft text — nothing is committed until Enter, a {@link separatorKeys} key, or an explicit {@link addChip}. */
  onInputChange(value: string): void {
    this.inputValue.set(value);
  }

  /**
   * Keyboard driver for the inline field. Enter or any {@link separatorKeys} key
   * commits the trimmed draft via {@link addChip} (and is swallowed, so Enter
   * never submits the surrounding form) — except while an IME composition is
   * active, when the key belongs to the IME; Backspace on an *empty* field pops the
   * last chip and emits {@link chipRemoved}. Everything else types normally.
   */
  onKeyDown(event: KeyboardEvent): void {
    // keyCode 229 is Safari: it fires the keydown that confirms a candidate
    // *after* compositionend, with isComposing already false.
    if (event.isComposing || event.keyCode === IME_KEY_CODE) return;

    const value = this.inputValue().trim();
    const separators = this.separatorKeys();

    if (event.key === 'Enter' || separators.includes(event.key)) {
      event.preventDefault();
      if (value) {
        this.addChip(value);
      }
      return;
    }

    if (event.key === 'Backspace' && this.inputValue() === '' && this.chips().length > 0) {
      const removed = this.chips().at(-1) ?? '';
      this.chips.update(chips => chips.slice(0, -1));
      this.onChange(this.chips());
      this.chipRemoved.emit(removed);
    }
  }

  /**
   * Appends `value` as a chip, clears the field, and notifies the form plus
   * {@link chipAdded}. Whitespace is trimmed and an all-whitespace value is
   * ignored; unless {@link allowDuplicates} is set, text equal to an existing
   * chip only clears the field and emits nothing. Public so a host can commit a
   * chip from its own UI (a paste handler, a "add" button).
   */
  addChip(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (!this.allowDuplicates() && this.chips().includes(trimmed)) {
      this.inputValue.set('');
      return;
    }

    this.chips.update(chips => [...chips, trimmed]);
    this.revealInputAfterRender = true;
    this.inputValue.set('');
    this.onChange(this.chips());
    this.chipAdded.emit(trimmed);
  }

  /**
   * Removes the chip at `index` (the per-chip ✕ button), emits
   * {@link chipRemoved}, and returns focus to the text field — including a
   * deferred re-focus, because the clicked button is destroyed by the same
   * update and would otherwise leave focus on `document.body`.
   * @param event The originating click; propagation is stopped so the
   * container's focus-the-input click handler does not also run.
   */
  removeChip(index: number, event: Event): void {
    event.stopPropagation();
    const removed = this.chips()[index];
    this.chips.update(chips => chips.filter((...[, i]) => i !== index));
    this.onChange(this.chips());
    this.chipRemoved.emit(removed);
    this.focusInput();

    // Maintain focus on input after removal
    setTimeout(() => this.focusInput());
  }

  /** Blur of the inline field; marks the form control touched. A half-typed draft is deliberately *not* committed on blur — only Enter or a {@link separatorKeys} key creates a chip. */
  onBlur(): void {
    this.onTouched();
  }

  /** `ControlValueAccessor`: replaces every chip with `value`. `null`/`undefined` resets to an empty list; the draft text in the field is left untouched. */
  writeValue(value: string[]): void {
    this.chips.set(value ?? []);
  }

  /** `ControlValueAccessor`: the registered callback receives the full chip array on every add and remove — never the in-progress text. */
  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  /** `ControlValueAccessor`: fired from {@link onBlur}, i.e. when the inline field loses focus. */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** `ControlValueAccessor`: relays `control.disable()`/`enable()` into {@link isDisabled}, which is OR-ed with the {@link disabled} input — so either source alone disables the chip list. */
  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}
