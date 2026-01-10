import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  Injectable,
  forwardRef,
} from '@angular/core';
import { cn } from '../lib/utils';
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
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSignal = signal<ToastData[]>([]);
  toasts = this.toastsSignal.asReadonly();

  private counter = 0;

  toast(options: Omit<ToastData, 'id'>) {
    const id = `toast-${++this.counter}`;
    const duration = options.duration ?? 5000;

    this.toastsSignal.update(toasts => [...toasts, { ...options, id }]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
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
    this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
  }

  dismissAll() {
    this.toastsSignal.set([]);
  }
}

@Component({
  selector: 'ui-toaster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [forwardRef(() => ToastComponent)],
  template: `
    <div [class]="containerClasses()" [attr.data-slot]="'toaster'" [dir]="rtl() ? 'rtl' : 'ltr'">
      @for (toast of toastService.toasts(); track toast.id) {
        <ui-toast 
          [variant]="toast.variant" 
          [title]="toast.title"
          [description]="toast.description"
          [action]="toast.action"
          (close)="toastService.dismiss(toast.id)"
        />
      }
    </div>
  `,
  host: { class: 'contents' },
})
export class ToasterComponent {
  toastService = inject(ToastService);
  position = input<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'>('bottom-right');
  rtl = input(false);

  containerClasses = computed(() => {
    const pos = this.position();
    const isRtl = this.rtl();

    // Swap left/right in RTL mode
    const positionClasses: Record<string, string> = {
      'top-left': isRtl ? 'top-0 right-0' : 'top-0 left-0',
      'top-right': isRtl ? 'top-0 left-0' : 'top-0 right-0',
      'bottom-left': isRtl ? 'bottom-0 right-0' : 'bottom-0 left-0',
      'bottom-right': isRtl ? 'bottom-0 left-0' : 'bottom-0 right-0',
      'top-center': 'top-0 left-1/2 -translate-x-1/2',
      'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2',
    };
    return cn(
      'fixed z-[100] flex flex-col gap-2 p-4 w-full max-w-[420px]',
      positionClasses[pos]
    );
  });
}

@Component({
  selector: 'ui-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'toast'" role="alert">
      <div class="grid gap-1">
        @if (title()) {
          <div class="text-sm font-semibold" [attr.data-slot]="'toast-title'">{{ title() }}</div>
        }
        @if (description()) {
          <div class="text-sm opacity-90" [attr.data-slot]="'toast-description'">{{ description() }}</div>
        }
      </div>
      @if (action()) {
        <button
          class="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive"
          (click)="action()?.onClick()"
        >
          {{ action()?.label }}
        </button>
      }
      <button
        class="absolute ltr:right-1 rtl:left-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600"
        (click)="close.emit()"
        aria-label="Close"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `,
  host: { class: 'contents' },
})
export class ToastComponent {
  variant = input<ToastVariant>('default');
  title = input<string>();
  description = input<string>();
  action = input<{ label: string; onClick: () => void }>();
  close = output<void>();

  classes = computed(() => toastVariants({ variant: this.variant() }));
}
