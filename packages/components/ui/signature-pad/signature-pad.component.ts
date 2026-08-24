import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { isSecondaryTouch } from '../../lib/touch';
import { ButtonComponent } from '../button';
import {
  isEmpty,
  isFarEnough,
  normalisePoint,
  strokePath,
  strokesToSvg,
  type Stroke,
  type StrokePoint,
} from './signature-pad.strokes';

const signaturePadVariants = cva(
  'relative w-full overflow-hidden border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] aria-disabled:pointer-events-none aria-disabled:opacity-50',
  {
    variants: {
      variant: {
        outline: 'dark:bg-input/30 rounded-lg border',
        underline: 'rounded-none border-b border-x-0 border-t-0 shadow-none focus-within:ring-0',
        ghost: 'border-none shadow-none focus-within:ring-0',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
);

export type SignaturePadVariant = 'outline' | 'underline' | 'ghost';

/** Image formats `toDataURL` will produce. */
export type SignatureImageType = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * A hand-drawn mark.
 *
 * ### The value is a PNG data URL; the strokes are the truth
 *
 * A form value has to be a submittable scalar, and a data URL is what every
 * backend, `<img src>` and PDF renderer already accepts. But the *bitmap* is
 * only a projection: the strokes are kept normalised to the pad and re-drawn
 * whenever the size or the pixel ratio changes, so the signature neither blurs
 * on a HiDPI screen nor disappears when the layout moves (R-4).
 *
 * ### Touch is the primary input
 *
 * This is the one control in the set that most people will use with a finger.
 * `touch-action: none` so the page does not scroll out from under the stroke,
 * and a second finger **abandons** the stroke rather than drawing a spike
 * across the signature — the node editor learned that one the hard way, and
 * the check lives in `lib/touch.ts` as `isSecondaryTouch`.
 *
 * ### It cannot be made accessible by labelling it
 *
 * A drawn mark is irreducibly visual and irreducibly motor. No `aria-label`
 * changes that. Consumers **must** offer an alternative — typically a
 * typed-name field — and the demo shows one. Saying so is the honest position;
 * claiming an attribute solves it would not be. See §3.4.
 */
@Component({
  selector: 'ui-signature-pad',
  exportAs: 'uiSignaturePad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SignaturePadComponent),
      multi: true,
    },
  ],
  templateUrl: './signature-pad.component.html',
  styleUrl: './signature-pad.component.css',
  host: { class: 'contents' },
})
export class SignaturePadComponent implements ControlValueAccessor {
  /**
   * The signature as a `data:image/png;base64,…` URL, or `null` when blank.
   *
   * A `model()` named exactly `value` is what makes this a valid Signal Forms
   * `FormValueControl`, and it doubles as the `valueChange` output.
   */
  readonly value = model<string | null>(null);

  /** Ink colour. Any CSS colour; defaults to the current text colour. */
  readonly penColor = input<string>('currentColor');
  /** Ink width in CSS pixels. */
  readonly penWidth = input<number>(2);
  /** Pad height in CSS pixels. The width always follows the container. */
  readonly height = input<number>(180);
  /** OR-ed with the state a reactive form pushes via `setDisabledState`. */
  readonly disabled = input<boolean>(false);
  /** Accessible name for the drawing surface. Note that naming it does not make it operable — see the accessibility note on this component. */
  readonly ariaLabel = input<string>('Signature');
  /** Text of the Clear button. */
  readonly clearLabel = input<string>('Clear');
  /** Text of the Undo button. */
  readonly undoLabel = input<string>('Undo');
  /** Hides the built-in Clear and Undo buttons for a custom toolbar. */
  readonly hideControls = input<boolean>(false);
  /** Extra classes merged onto the wrapper. */
  readonly class = input('');
  /** Visual style of the wrapper: `outline`, `underline` or `ghost`. */
  readonly variant = input<SignaturePadVariant>('outline');

  /** Fires when a stroke finishes — after the value has been committed. */
  readonly strokeEnd = output<void>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly _strokes = signal<readonly Stroke[]>([]);
  private readonly _formDisabled = signal(false);
  private readonly _size = signal<{ width: number; height: number }>({ width: 0, height: 0 });

  /**
   * An image written in that this pad did not draw.
   *
   * A PNG cannot be turned back into strokes, so a saved signature loaded into
   * the pad is rendered underneath rather than pretended to be editable. New
   * strokes draw on top of it and the committed image contains both.
   */
  private backdrop: HTMLImageElement | null = null;
  /** The last value this pad emitted, so its own echo is recognisable. */
  private lastEmitted: string | null = null;
  private activePointerId: number | null = null;

  /** The strokes, normalised to the pad. Resolution-independent by design. */
  readonly strokes = this._strokes.asReadonly();
  readonly isDisabled = computed(() => this.disabled() || this._formDisabled());
  readonly hasSignature = computed(() => !isEmpty(this._strokes()) || this.backdrop !== null);
  readonly canUndo = computed(() => this._strokes().length > 0);

  readonly wrapperClasses = computed(() =>
    cn(signaturePadVariants({ variant: this.variant() }), this.class()),
  );

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    afterNextRender(() => {
      this.watchSize();
      this.paint();
    });

    /*
     * `untracked`, for the reason `time-picker` found the hard way: the paint
     * reads the stroke signals, and an effect that tracked them would re-run
     * on every point with a `value` that had not caught up yet.
     */
    effect(() => {
      const incoming = this.value();
      untracked(() => this.adopt(incoming));
    });
  }

  /**
   * Erase everything, including an image that was loaded in.
   *
   * Reachable from a custom toolbar — see {@link hideControls}.
   *
   * @publicApi
   */
  clear(): void {
    this._strokes.set([]);
    this.backdrop = null;
    this.paint();
    this.commit();
  }

  /**
   * Remove the last stroke. An image loaded in is not a stroke and stays.
   *
   * Reachable from a custom toolbar — see {@link hideControls}.
   *
   * @publicApi
   */
  undo(): void {
    if (!this.canUndo()) return;
    this._strokes.update(strokes => strokes.slice(0, -1));
    this.paint();
    this.commit();
  }

  /**
   * The signature in another format, without widening the value type.
   *
   * `'svg'` is line art rather than a bitmap: a tenth the size, printable at
   * any resolution, and what a PDF actually wants. The value stays a PNG on
   * purpose, so this is the only way to reach the other formats.
   *
   * @publicApi
   */
  toDataURL(type: SignatureImageType | 'svg' = 'image/png'): string | null {
    if (!this.hasSignature()) return null;
    if (type !== 'svg') return this.canvasRef().nativeElement.toDataURL(type);

    const { width, height } = this._size();
    const svg = strokesToSvg(
      this._strokes(),
      width,
      height,
      this.resolvedPenColor(),
      this.penWidth(),
    );
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  onPointerDown(event: PointerEvent): void {
    if (this.isDisabled()) return;

    /*
     * A second finger abandons the stroke rather than continuing it.
     *
     * Without this, pinching to zoom the page drags a spike straight across
     * the signature — the first finger's stroke jumps to wherever the gesture
     * takes it. Abandoning is what every drawing surface does.
     */
    if (isSecondaryTouch(event)) {
      this.abandon();
      return;
    }

    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.capture(event);
    this._strokes.update(strokes => [...strokes, [this.pointOf(event)]]);
    this.paint();
  }

  onPointerMove(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) return;
    if (isSecondaryTouch(event)) {
      this.abandon();
      return;
    }

    event.preventDefault();
    const point = this.pointOf(event);
    const strokes = this._strokes();
    if (strokes.length === 0) return;

    // The empty case is already returned above; the fallback keeps this
    // type-clean without asserting something the compiler cannot check.
    const current = strokes.at(-1) ?? [];
    if (!isFarEnough(current.at(-1), point)) return;

    this._strokes.update(all => [...all.slice(0, -1), [...current, point]]);
    this.paint();
  }

  onPointerUp(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) return;

    this.activePointerId = null;
    this.onTouched();
    this.commit();
    this.strokeEnd.emit();
  }

  onBlur(): void {
    this.onTouched();
  }

  /** Renders a form value as-is, without emitting. */
  writeValue(value: string | null): void {
    this.adopt(value);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._formDisabled.set(isDisabled);
  }

  /** `currentColor` is not a colour a canvas or an SVG file can resolve. */
  private resolvedPenColor(): string {
    const colour = this.penColor();
    if (colour !== 'currentColor') return colour;
    return getComputedStyle(this.host.nativeElement).color || '#000000';
  }

  /**
   * Take on a value that came from outside.
   *
   * An echo of this pad's own commit is ignored — re-adopting it would replace
   * the live strokes with a flat image and quietly make Undo useless.
   */
  private adopt(value: string | null): void {
    if (value === this.lastEmitted) return;

    if (value === null) {
      this._strokes.set([]);
      this.backdrop = null;
      this.paint();
      return;
    }

    const image = new Image();
    image.addEventListener('load', () => {
      this.backdrop = image;
      this._strokes.set([]);
      this.paint();
    });
    image.src = value;
  }

  private abandon(): void {
    if (this.activePointerId === null) return;
    this.activePointerId = null;
    this._strokes.update(strokes => strokes.slice(0, -1));
    this.paint();
  }

  private capture(event: PointerEvent): void {
    /*
     * Capture can fail for a pointer that is already gone. That is not an
     * error worth propagating — the stroke simply ends at the boundary.
     */
    try {
      this.canvasRef().nativeElement.setPointerCapture(event.pointerId);
    } catch {
      // Nothing to recover: the stroke just will not track outside the pad.
    }
  }

  /**
   * Where a pointer is, as a fraction of the pad.
   *
   * Measured against the live bounding rect rather than `offsetX`/`offsetY`:
   * those are relative to whatever the event happened to hit, which is not
   * always the canvas, and they are unreliable for a synthesised event.
   */
  private pointOf(event: PointerEvent): StrokePoint {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    return normalisePoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    );
  }

  /**
   * Keep the bitmap matched to the box and to the screen.
   *
   * R-4: a canvas whose backing store is not `devicePixelRatio` times its CSS
   * size renders a signature soft on every retina display. Re-measuring on
   * resize and re-painting from the strokes is what makes that fixable at all.
   */
  private watchSize(): void {
    const canvas = this.canvasRef().nativeElement;
    const observer = new ResizeObserver(() => {
      this.measure();
      this.paint();
    });

    observer.observe(canvas);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /** Read the pad's CSS size. The bitmap is sized from this, never the reverse. */
  private measure(): void {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    this._size.set({ width: rect.width, height: rect.height });
  }

  private paint(): void {
    const canvas = this.canvasRef().nativeElement;
    if (this._size().width === 0) this.measure();

    const { width, height } = this._size();
    if (width === 0 || height === 0) return;

    const ratio = globalThis.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    const context = canvas.getContext('2d');
    if (context === null) return;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (this.backdrop !== null) context.drawImage(this.backdrop, 0, 0, width, height);

    context.strokeStyle = this.resolvedPenColor();
    context.lineWidth = this.penWidth();
    context.lineCap = 'round';
    context.lineJoin = 'round';

    for (const stroke of this._strokes()) {
      if (stroke.length === 0) continue;
      context.stroke(new Path2D(strokePath(stroke, width, height)));
    }
  }

  /**
   * The one path a user-driven change takes.
   *
   * The emitted URL is remembered so the effect can tell this pad's own echo
   * from a form genuinely writing a different signature in.
   */
  private commit(): void {
    const next = this.hasSignature() ? this.canvasRef().nativeElement.toDataURL('image/png') : null;
    this.lastEmitted = next;
    this.onChange(next);
    this.value.set(next);
  }
}
