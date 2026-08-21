import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  Injectable,
} from '@angular/core';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../lib/i18n/common.locales';
import { cva, type VariantProps } from 'class-variance-authority';

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between ltr:space-x-2 rtl:space-x-reverse overflow-hidden rounded-md border p-4 ltr:pr-6 rtl:pl-6 shadow-lg transition-all',
  {
    variants: {
      variant: {
        default: 'border bg-background text-foreground',
        destructive: 'destructive group border-destructive bg-destructive text-white',
        success: 'border-green-500 bg-green-500 text-white',
        info: 'border-blue-600 bg-blue-600 text-white',
        warning: 'border-amber-500 bg-amber-500 text-amber-950',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type ToastVariant = VariantProps<typeof toastVariants>['variant'];

export interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: NonNullable<ToastVariant>;
  duration?: number;
  action?: { label: string; onClick: () => void };
  showCountdown?: boolean;
  countdownSeconds?: number;
  createdAt?: number;
  /**
   * Renders a spinner ahead of the title. Additive — it does not replace the
   * countdown or the action button. Set by {@link ToastService.loading} and
   * cleared by {@link ToastService.promise} when the promise settles.
   */
  loading?: boolean;
}

/** Fields {@link ToastService.update} may patch — everything but the immutable `id`. */
export type ToastPatch = Partial<Omit<ToastData, 'id'>>;

/** A result message for {@link ToastService.promise}: a fixed string, or one derived from the settled value. */
export type ToastPromiseMessage<T> = string | ((value: T) => string);

/**
 * Copy for the three phases of {@link ToastService.promise}. `success` and
 * `error` may be functions so the message can quote the resolved value or the
 * thrown error.
 */
export interface ToastPromiseOptions<T> {
  /** Shown immediately, on a sticky toast, until the promise settles. */
  loading: string;
  /** Shown when the promise resolves. */
  success: ToastPromiseMessage<T>;
  /** Shown when the promise rejects. */
  error: ToastPromiseMessage<unknown>;
  /** Secondary line kept across all three phases. */
  description?: string;
  /** Auto-dismiss time of the settled toast in ms (default 5000; `0` for sticky). */
  duration?: number;
}

function resolvePromiseMessage<T>(message: ToastPromiseMessage<T>, value: T): string {
  return typeof message === 'function' ? message(value) : message;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<ToastData[]>([]);
  toasts = this.toastsSignal.asReadonly();

  private counter = 0;
  private readonly timeoutIds = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly intervalIds = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Queues a toast and returns its generated id (usable with {@link dismiss}).
   * Every call stacks a new entry — identical toasts are **not** coalesced, so
   * de-duplicate at the call site if a repeated event can fire in a loop. Auto-dismiss
   * runs after `duration` ms (default 5000); pass `duration: 0` (or a negative value)
   * for a sticky toast that only a close click or {@link dismiss} removes. With
   * `showCountdown`, a 1s interval ticks `countdownSeconds` down from
   * `ceil(duration / 1000)` and drives the progress bar. Nothing is capped or evicted:
   * the visible stack grows with the queue.
   */
  toast(options: Omit<ToastData, 'id'>): string {
    const id = `toast-${++this.counter}`;
    const duration = options.duration ?? 5000;
    const countdownSeconds = options.showCountdown ? Math.ceil(duration / 1000) : undefined;

    this.toastsSignal.update(toasts => [...toasts, {
      ...options,
      id,
      countdownSeconds,
      createdAt: Date.now(),
    }]);

    this.scheduleLifetime(id, duration, options.showCountdown ?? false);

    return id;
  }

  /** Arms (or re-arms) the auto-dismiss timeout and the optional countdown interval for one toast. */
  private scheduleLifetime(id: string, duration: number, showCountdown: boolean): void {
    if (duration <= 0) return;

    this.timeoutIds.set(id, setTimeout(() => this.dismiss(id), duration));

    if (!showCountdown) return;

    const intervalId = setInterval(() => {
      this.toastsSignal.update(toasts => toasts.map(t => {
        if (t.id !== id) return t;
        const elapsed = Date.now() - (t.createdAt ?? Date.now());
        const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
        return { ...t, countdownSeconds: remaining };
      }));
    }, 1000);
    this.intervalIds.set(id, intervalId);
  }

  /** Clears the auto-dismiss timeout and countdown interval for one toast, if any are armed. */
  private clearLifetime(id: string): void {
    const timeoutId = this.timeoutIds.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(id);
    }
    const intervalId = this.intervalIds.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(id);
    }
  }

  /**
   * Patches a toast that is already on screen, in place — same id, same position
   * in the stack, no exit/enter animation. Unknown ids are ignored. Fields absent
   * from `patch` keep their current value.
   *
   * Patching `duration` (or `showCountdown`) restarts the auto-dismiss clock from
   * now and re-seeds the countdown, so `update(id, { duration: 3000 })` gives the
   * toast a fresh three seconds regardless of how long it has been up. Patch
   * anything else and the original clock keeps running untouched.
   *
   * This is the primitive {@link promise} is built on; use it directly to turn a
   * `loading()` toast into its result without the dismiss-and-reshow flicker.
   */
  update(id: string, patch: ToastPatch): void {
    const current = this.toastsSignal().find(t => t.id === id);
    if (!current) return;

    const retimes = Object.hasOwn(patch, 'duration') || Object.hasOwn(patch, 'showCountdown');
    if (retimes) this.clearLifetime(id);

    const next: ToastData = { ...current, ...patch, id };
    if (retimes) {
      next.createdAt = Date.now();
      next.countdownSeconds = next.showCountdown
        ? Math.ceil((next.duration ?? 5000) / 1000)
        : undefined;
    }

    this.toastsSignal.update(toasts => toasts.map(t => (t.id === id ? next : t)));

    if (retimes) {
      this.scheduleLifetime(id, next.duration ?? 5000, next.showCountdown ?? false);
    }
  }

  /** {@link toast} shorthand for the green `success` variant. Returns the new toast's id. */
  success(title: string, description?: string, duration = 5000): string {
    return this.toast({ title, description, variant: 'success', duration });
  }

  /**
   * {@link toast} shorthand for the `destructive` variant, which also upgrades the
   * rendered toast to `role="alert"` / `aria-live="assertive"` so screen readers
   * interrupt. Still auto-dismisses after `duration` — pass `0` for errors that must
   * be acknowledged.
   */
  error(title: string, description?: string, duration = 5000): string {
    return this.toast({ title, description, variant: 'destructive', duration });
  }

  /** {@link toast} shorthand for the blue `info` variant. Returns the new toast's id. */
  info(title: string, description?: string, duration = 5000): string {
    return this.toast({ title, description, variant: 'info', duration });
  }

  /** {@link toast} shorthand for the amber `warning` variant. Returns the new toast's id. */
  warning(title: string, description?: string, duration = 5000): string {
    return this.toast({ title, description, variant: 'warning', duration });
  }

  /**
   * Raises a **sticky** toast with a spinner (`duration: 0`) for work that is still
   * running. Nothing dismisses it on its own — resolve it with {@link update} (to
   * turn it into the result in place) or {@link dismiss}. {@link promise} does
   * exactly that for you.
   */
  loading(title: string, description?: string): string {
    return this.toast({ title, description, duration: 0, loading: true });
  }

  /**
   * Binds a toast to a promise: raises a sticky {@link loading} toast, then
   * {@link update}s **that same toast** to the success or error message when the
   * promise settles — same id, same slot in the stack, no dismiss-and-reshow
   * flicker. Returns a promise that settles exactly as the input does, so it stays
   * `await`-able and rejections are still the caller's to handle.
   *
   * If the toast was dismissed while the promise was in flight, the settle is a
   * no-op — a toast the user closed does not come back.
   *
   * @example
   * ```ts
   * await toast.promise(saveUser(), {
   *   loading: 'Saving…',
   *   success: user => `Saved ${user.name}`,
   *   error: e => `Failed: ${(e as Error).message}`,
   * });
   * ```
   */
  promise<T>(promise: PromiseLike<T>, options: ToastPromiseOptions<T>): Promise<T> {
    const id = this.loading(options.loading, options.description);
    const duration = options.duration ?? 5000;

    return Promise.resolve(promise).then(
      value => {
        this.update(id, {
          title: resolvePromiseMessage(options.success, value),
          variant: 'success',
          loading: false,
          duration,
        });
        return value;
      },
      (error: unknown) => {
        this.update(id, {
          title: resolvePromiseMessage(options.error, error),
          variant: 'destructive',
          loading: false,
          duration,
        });
        throw error;
      }
    );
  }

  /**
   * Removes one toast immediately and clears its auto-dismiss timer and countdown
   * interval. Also what the close button and the auto-dismiss timeout call. Unknown
   * ids are ignored; there is no exit animation, the toast leaves the DOM at once.
   */
  dismiss(id: string): void {
    this.clearLifetime(id);
    this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
  }

  /**
   * Clears the whole queue and every pending timer — the service is app-wide
   * (`providedIn: 'root'`), so this drops toasts raised by other features too. Useful
   * on route changes.
   */
  dismissAll(): void {
    this.timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    this.timeoutIds.clear();
    this.intervalIds.forEach(intervalId => clearInterval(intervalId));
    this.intervalIds.clear();
    this.toastsSignal.set([]);
  }
}

@Component({
  selector: 'ui-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast.component.html',
  host: {
    class: 'contents',
    '(keydown.escape)': 'closed.emit()',
  },
})
export class ToastComponent {
  /**
   * Visual style, which also sets the announcement politeness: `destructive` renders
   * `role="alert"` / `aria-live="assertive"`, while `default`, `success`, `info` and
   * `warning` all use `status` / `polite`.
   *
   * `warning` is deliberately polite rather than assertive: it is the "you may want
   * to know" level, and interrupting whatever a screen-reader user is currently
   * reading is reserved for `destructive`. Raise a `destructive` toast (or set
   * `role="alert"` on a standalone `ui-toast`) for a warning that genuinely must
   * interrupt.
   *
   * `info` and `warning` are also the two variants whose palette is tuned for
   * contrast rather than for matching `success`: white on `blue-600` and
   * `amber-950` on `amber-500` both clear WCAG AA for the 14px semibold title,
   * which white on `amber-500` would not.
   */
  readonly variant = input<ToastVariant>('default');
  /** Bold first line. Omit it for a description-only toast — the row is simply not rendered. */
  readonly title = input<string>();
  /** Secondary line under the title, rendered at 90% opacity. Plain text only — no markup is interpreted. */
  readonly description = input<string>();
  /**
   * Optional action button. `onClick` is invoked as-is and does **not** dismiss the
   * toast — call `ToastService.dismiss(id)` yourself if the action should close it.
   */
  readonly action = input<{ label: string; onClick: () => void }>();
  /** Shows the remaining seconds beside the action label and a draining progress bar. Requires {@link duration}. */
  readonly showCountdown = input<boolean | undefined>(false);
  /** Seconds left, ticked once per second by `ToastService`; this component only displays the value. */
  readonly countdownSeconds = input<number | undefined>(undefined);
  /**
   * Total lifetime in ms. Purely presentational here — it is the denominator of the
   * progress bar; the actual dismissal timer lives in `ToastService`.
   */
  readonly duration = input<number | undefined>(undefined);
  /** Epoch ms when the toast was raised. Supplied by `ToastService` for elapsed-time maths. */
  readonly createdAt = input<number | undefined>(undefined);
  /** Renders a spinner ahead of the title. Set by `ToastService.loading()` / `promise()` while work is in flight. */
  readonly loading = input<boolean | undefined>(false);

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<CommonLocale>>();

  /**
   * Emitted when the user clicks the close button or presses `Escape` on the toast.
   * `ui-toaster` responds by calling `ToastService.dismiss` — a standalone `ui-toast`
   * must remove itself, since the component never hides itself.
   */
  readonly closed = output<void>();

  private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

  readonly classes = computed(() => toastVariants({ variant: this.variant() }));

  readonly role = computed(() =>
    this.variant() === 'destructive' ? 'alert' : 'status'
  );
  readonly ariaLive = computed(() =>
    this.variant() === 'destructive' ? 'assertive' : 'polite'
  );

  readonly progressPercent = computed(() => {
    const dur = this.duration();
    const countdown = this.countdownSeconds();
    if (!dur || countdown == null) return 0;
    return Math.max(0, (countdown / Math.ceil(dur / 1000)) * 100);
  });
}
