import {
    Component,
    ChangeDetectionStrategy,
    model,
    InjectionToken,
    forwardRef,
} from '@angular/core';

export const DIALOG = new InjectionToken<DialogComponent>('DIALOG');

@Component({
    selector: 'ui-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: DIALOG, useExisting: forwardRef(() => DialogComponent) }],
    template: `<ng-content />`,
    host: { class: 'contents' },
})
export class DialogComponent {
    open = model(false);

    show(): void {
        this.open.set(true);
    }

    hide(): void {
        this.open.set(false);
    }

    toggle(): void {
        this.open.update(v => !v);
    }
}
