import {
    Directive,
    computed,
    input,
    output,
    inject,
    ApplicationRef,
    EnvironmentInjector,
    Injector,
    createComponent,
    HostListener,
} from '@angular/core';
import { createLocaleSelector, type LocaleInput } from '@/components/lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '@/components/lib/i18n/common.locales';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Directive({
    selector: '[uiConfirm]',
    standalone: true,
})
export class ConfirmDirective {
    /** Locale for the default dialog strings: a registry key (`'en'`/`'he'`/…) or a full dictionary. */
    readonly locale = input<LocaleInput<CommonLocale>>();
    /**
     * The confirmation prompt, and the directive's own selector — applying
     * `uiConfirm="Delete this file?"` is what enables the guard. The text
     * becomes the dialog's description; an empty value shows title only.
     */
    readonly uiConfirm = input<string>();
    /** Dialog heading. Defaults to the locale's "Confirm". */
    readonly confirmTitle = input<string>();
    /** Confirm button text. Defaults to the locale's "Confirm". */
    readonly confirmLabel = input<string>();
    /** Cancel button text. Defaults to the locale's "Cancel". */
    readonly cancelLabel = input<string>();

    /**
     * Emits only after the user confirms. The host's own click is stopped, so
     * this — not `(click)` — is where the guarded action belongs.
     */
    readonly confirmed = output<void>();

    private readonly t = createLocaleSelector(this.locale, COMMON_LOCALES);
    private readonly resolvedTitle = computed(() => this.confirmTitle() ?? this.t().confirm);
    private readonly resolvedConfirmLabel = computed(() => this.confirmLabel() ?? this.t().confirm);
    private readonly resolvedCancelLabel = computed(() => this.cancelLabel() ?? this.t().cancel);
    private readonly resolvedDescription = computed(() => this.uiConfirm() ?? '');

    private readonly appRef = inject(ApplicationRef);
    private readonly injector = inject(EnvironmentInjector);
    private readonly elementInjector = inject(Injector);

    /**
     * Intercept the host click and open the confirmation dialog instead.
     * Propagation is stopped so the host's own `(click)` never runs unguarded;
     * the dialog is created outside the view and torn down on either outcome.
     */
    @HostListener('click', ['$event'])
    onClick(event: MouseEvent): void {
        event.stopPropagation();

        const ref = createComponent(ConfirmDialogComponent, {
            environmentInjector: this.injector,
            elementInjector: this.elementInjector,
        });

        ref.instance.title.set(this.resolvedTitle());
        ref.instance.description.set(this.resolvedDescription());
        ref.instance.confirmLabel.set(this.resolvedConfirmLabel());
        ref.instance.cancelLabel.set(this.resolvedCancelLabel());

        this.appRef.attachView(ref.hostView);
        document.body.appendChild(ref.location.nativeElement);

        ref.instance.show();

        const confirmSub = ref.instance.confirmed.subscribe(() => {
            this.confirmed.emit();
            cleanup();
        });

        const cancelSub = ref.instance.cancelled.subscribe(() => {
            cleanup();
        });

        function cleanup(): void {
            confirmSub.unsubscribe();
            cancelSub.unsubscribe();
            ref.destroy();
        }
    }
}
