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
import { COMMON_LOCALES, type CommonLocale, createLocaleSelector, type LocaleInput } from '../../lib/i18n';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Directive({
    selector: '[uiConfirm]',
    standalone: true,
})
export class ConfirmDirective {
    readonly locale = input<LocaleInput<CommonLocale>>();
    readonly uiConfirm = input<string>();
    readonly confirmTitle = input<string>();
    readonly confirmLabel = input<string>();
    readonly cancelLabel = input<string>();

    readonly confirmed = output<void>();

    private readonly t = createLocaleSelector(this.locale, COMMON_LOCALES);
    private readonly resolvedTitle = computed(() => this.confirmTitle() ?? this.t().confirm);
    private readonly resolvedConfirmLabel = computed(() => this.confirmLabel() ?? this.t().confirm);
    private readonly resolvedCancelLabel = computed(() => this.cancelLabel() ?? this.t().cancel);
    private readonly resolvedDescription = computed(() => this.uiConfirm() ?? '');

    private readonly appRef = inject(ApplicationRef);
    private readonly injector = inject(EnvironmentInjector);
    private readonly elementInjector = inject(Injector);

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
