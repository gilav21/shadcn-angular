import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  Injectable,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { COMMON_LOCALES, type CommonLocale, createLocaleBindings, type LocaleInput } from '../../lib/i18n';
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
  variant?: ToastVariant;
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

  toast(options: Omit<ToastData, 'id'>) {
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

  success(title: string, description?: string, duration = 5000) {
    return this.toast({ title, description, variant: 'success', duration });
  }

  error(title: string, description?: string, duration = 5000) {
    return this.toast({ title, description, variant: 'destructive', duration });
  }

  dismiss(id: string) {
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

  dismissAll() {
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
  host: { class: 'contents' },
})
export class ToastComponent {
  readonly variant = input<ToastVariant>('default');
  readonly title = input<string>();
  readonly description = input<string>();
  readonly action = input<{ label: string; onClick: () => void }>();
  readonly showCountdown = input<boolean | undefined>(false);
  readonly countdownSeconds = input<number | undefined>(undefined);
  readonly duration = input<number | undefined>(undefined);
  readonly createdAt = input<number | undefined>(undefined);

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<CommonLocale>>();

  readonly close = output<void>();

  private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

  readonly classes = computed(() => toastVariants({ variant: this.variant() }));

  readonly progressPercent = computed(() => {
    const dur = this.duration();
    const countdown = this.countdownSeconds();
    if (!dur || countdown == null) return 0;
    return Math.max(0, (countdown / Math.ceil(dur / 1000)) * 100);
  });
}
