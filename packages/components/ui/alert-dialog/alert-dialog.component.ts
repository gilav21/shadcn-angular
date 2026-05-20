import {
    Component,
    ChangeDetectionStrategy,
    model,
    InjectionToken,
    forwardRef,
} from '@angular/core';

export const ALERT_DIALOG = new InjectionToken<AlertDialogComponent>('ALERT_DIALOG');

@Component({
    selector: 'ui-alert-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: ALERT_DIALOG, useExisting: forwardRef(() => AlertDialogComponent) }],
    template: `<ng-content />`,
    host: { class: 'contents' },
})
export class AlertDialogComponent {
    open = model(false);

    show() {
        this.open.set(true);
    }

    hide() {
        this.open.set(false);
    }

    toggle() {
        this.open.update(v => !v);
    }
}
