import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ApplicationRef } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfirmDirective } from './confirm.directive';
import { ButtonComponent } from './button.component';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
    template: `
        <ui-button
            uiConfirm="This cannot be undone."
            confirmTitle="Delete Item"
            confirmLabel="Yes, delete"
            cancelLabel="No, keep it"
            (confirmed)="onConfirmed()"
        >Delete</ui-button>
    `,
    imports: [ButtonComponent, ConfirmDirective],
})
class TestHostComponent {
    confirmed = false;
    onConfirmed() { this.confirmed = true; }
}

describe('ConfirmDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let appRef: ApplicationRef;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        appRef = TestBed.inject(ApplicationRef);
        fixture.detectChanges();
        await fixture.whenStable();
    });

    afterEach(() => {
        document.body.querySelectorAll('ui-confirm-dialog').forEach(el => el.remove());
    });

    it('should create', () => {
        expect(host).toBeTruthy();
    });

    it('should open a confirmation dialog when the button is clicked', async () => {
        const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        button.click();
        appRef.tick();
        await fixture.whenStable();

        const dialog = document.body.querySelector('ui-confirm-dialog');
        expect(dialog).toBeTruthy();
    });

    it('should NOT emit confirmed before interaction', async () => {
        const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        button.click();
        appRef.tick();
        await fixture.whenStable();

        expect(host.confirmed).toBe(false);
    });

    it('should emit confirmed when the action button is clicked', async () => {
        const spy = vi.spyOn(host, 'onConfirmed');

        const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        button.click();
        appRef.tick();
        await fixture.whenStable();

        const actionButton = document.body.querySelector('ui-alert-dialog-action') as HTMLElement | null;
        actionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        appRef.tick();
        await fixture.whenStable();

        expect(spy).toHaveBeenCalled();
    });

    it('should NOT emit confirmed when the cancel button is clicked', async () => {
        const spy = vi.spyOn(host, 'onConfirmed');

        const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        button.click();
        appRef.tick();
        await fixture.whenStable();

        const cancelButton = document.body.querySelector('ui-alert-dialog-cancel') as HTMLElement | null;
        cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        appRef.tick();
        await fixture.whenStable();

        expect(spy).not.toHaveBeenCalled();
    });

    it('should pass custom labels to the dialog', async () => {
        const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        button.click();
        appRef.tick();
        await fixture.whenStable();

        const bodyText = document.body.textContent ?? '';
        expect(bodyText).toContain('Delete Item');
        expect(bodyText).toContain('This cannot be undone.');
        expect(bodyText).toContain('Yes, delete');
        expect(bodyText).toContain('No, keep it');
    });
});

describe('ConfirmDialogComponent', () => {
    let fixture: ComponentFixture<ConfirmDialogComponent>;
    let dialog: ConfirmDialogComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ConfirmDialogComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ConfirmDialogComponent);
        dialog = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('opens via show() and closes via hide()', () => {
        dialog.show();
        fixture.detectChanges();
        expect(dialog.open()).toBe(true);

        dialog.hide();
        fixture.detectChanges();
        expect(dialog.open()).toBe(false);
    });

    it('emits cancelled when the dialog closes externally (Escape / hide)', () => {
        const cancelledSpy = vi.fn();
        dialog.confirmed.subscribe(() => cancelledSpy('confirmed'));
        dialog.cancelled.subscribe(() => cancelledSpy('cancelled'));

        dialog.show();
        fixture.detectChanges();

        dialog.hide();
        fixture.detectChanges();

        expect(cancelledSpy).toHaveBeenCalledWith('cancelled');
    });

    it('emits confirmed (not cancelled) via onConfirm()', () => {
        const confirmedSpy = vi.fn();
        const cancelledSpy = vi.fn();
        dialog.confirmed.subscribe(confirmedSpy);
        dialog.cancelled.subscribe(cancelledSpy);

        dialog.show();
        fixture.detectChanges();

        dialog.onConfirm();
        fixture.detectChanges();

        expect(confirmedSpy).toHaveBeenCalledTimes(1);
        expect(cancelledSpy).not.toHaveBeenCalled();
        expect(dialog.open()).toBe(false);
    });

    it('emits cancelled once via onCancel() without double-firing from the effect', () => {
        const cancelledSpy = vi.fn();
        dialog.cancelled.subscribe(cancelledSpy);

        dialog.show();
        fixture.detectChanges();

        dialog.onCancel();
        fixture.detectChanges();

        expect(cancelledSpy).toHaveBeenCalledTimes(1);
        expect(dialog.open()).toBe(false);
    });
});
