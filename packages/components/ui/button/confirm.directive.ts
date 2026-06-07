import {
    Directive,
    input,
    output,
    inject,
    ApplicationRef,
    EnvironmentInjector,
    Injector,
    createComponent,
    HostListener,
} from '@angular/core';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Directive({
    selector: '[uiConfirm]',
    standalone: true,
})
export class ConfirmDirective {
    readonly uiConfirm = input<string>('Are you sure?');
    readonly confirmTitle = input<string>('Confirm');
    readonly confirmLabel = input<string>('Confirm');
    readonly cancelLabel = input<string>('Cancel');

    readonly confirmed = output<void>();

    private readonly appRef = inject(ApplicationRef);
    private readonly injector = inject(EnvironmentInjector);
    private readonly elementInjector = inject(Injector);

    @HostListener('click', ['$event'])
    onClick(event: MouseEvent) {
        event.stopPropagation();

        const ref = createComponent(ConfirmDialogComponent, {
            environmentInjector: this.injector,
            elementInjector: this.elementInjector,
        });

        ref.instance.title.set(this.confirmTitle());
        ref.instance.description.set(this.uiConfirm());
        ref.instance.confirmLabel.set(this.confirmLabel());
        ref.instance.cancelLabel.set(this.cancelLabel());

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

        function cleanup() {
            confirmSub.unsubscribe();
            cancelSub.unsubscribe();
            ref.destroy();
        }
    }
}
