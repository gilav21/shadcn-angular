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

    if (duration > 0) {
      const timeoutId = setTimeout(() => this.dismiss(id), duration);
      this.timeoutIds.set(id, timeoutId);

      if (options.showCountdown) {
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
    }

    return id;
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

  /**
   * Removes one toast immediately and clears its auto-dismiss timer and countdown
   * interval. Also what the close button and the auto-dismiss timeout call. Unknown
   * ids are ignored; there is no exit animation, the toast leaves the DOM at once.
   */
  dismiss(id: string): void {
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
   * `role="alert"` / `aria-live="assertive"`, while `default` and `success` use
   * `status` / `polite`.
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
