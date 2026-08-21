import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
    signal,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../lib/i18n/common.locales';
import { ButtonComponent } from '../button';

const bannerVariants = cva(
    'block w-full border-b px-4 py-3 text-sm sm:px-6',
    {
        variants: {
            variant: {
                info: 'border-border bg-muted text-foreground',
                warning: 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
                success: 'border-green-500/40 bg-green-500/10 text-green-900 dark:text-green-200',
                destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
            },
        },
        defaultVariants: {
            variant: 'info',
        },
    }
);

/** Severity treatment of a {@link BannerComponent}. */
export type BannerVariant = NonNullable<VariantProps<typeof bannerVariants>['variant']>;

/**
 * Persistent, page-level announcement bar — the slot `alert` (inline, within
 * content) and `toast` (transient) do not fill.
 *
 * Two modes, per the library's projection contract: pass {@link message} for
 * the plain-text case, or project your own content (a link, a button) and it
 * replaces the message entirely.
 */
@Component({
    selector: 'ui-banner',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    templateUrl: './banner.component.html',
    host: {
        '[class]': 'classes()',
        '[attr.role]': 'role()',
        '[attr.aria-live]': 'ariaLive()',
        '[attr.data-variant]': 'variant()',
        '[attr.data-slot]': '"banner"',
    },
})
export class BannerComponent {
    /**
     * Severity treatment. Also drives the announcement semantics: everything
     * except `'destructive'` announces politely via `role="status"`;
     * `'destructive'` uses `role="alert"` / `aria-live="assertive"`, which
     * interrupts a screen reader — reserve it for genuine failures.
     */
    readonly variant = input<BannerVariant>('info');
    /**
     * Plain-text announcement. Ignored when content is projected into the
     * banner — the projection wins so you can mix text with a link or button.
     */
    readonly message = input('');
    /**
     * Render a close control that hides the banner and emits {@link dismissed}.
     * Accepts the bare-attribute form (`<ui-banner dismissible />`).
     */
    readonly dismissible = input(false, { transform: booleanAttribute });
    /** Extra classes merged onto the host. */
    readonly class = input('');
    /** Locale dictionary or registry key, used for the dismiss button's label. */
    readonly locale = input<LocaleInput<CommonLocale>>();

    /** Emits once when the user closes a {@link dismissible} banner. */
    readonly dismissed = output<void>();

    private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
    protected readonly t = this.i18n.t;

    private readonly _visible = signal(true);
    /** `false` once the banner has been dismissed. */
    readonly visible = this._visible.asReadonly();

    readonly classes = computed(() =>
        cn(
            bannerVariants({ variant: this.variant() }),
            !this._visible() && 'hidden',
            this.class()
        )
    );

    // A dismissed banner keeps its host element (so the consumer's layout slot
    // is stable) but must stop being a live region: an empty `role="status"`
    // left behind is still announced on every subsequent mutation.
    protected readonly role = computed(() => {
        if (!this._visible()) return null;
        return this.variant() === 'destructive' ? 'alert' : 'status';
    });
    protected readonly ariaLive = computed(() => {
        if (!this._visible()) return null;
        return this.variant() === 'destructive' ? 'assertive' : 'polite';
    });

    /** Hides the banner and emits {@link dismissed}. Idempotent. */
    dismiss(): void {
        if (!this._visible()) return;
        this._visible.set(false);
        this.dismissed.emit();
    }
}

export { bannerVariants };
