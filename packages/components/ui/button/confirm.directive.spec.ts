import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ApplicationRef } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfirmDirective } from './confirm.directive';
import { ButtonComponent } from './button.component';

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

        const actionButton = document.body.querySelector('ui-alert-dialog-action button') as HTMLButtonElement | null;
        if (actionButton) {
            actionButton.click();
            appRef.tick();
            await fixture.whenStable();
        }

        expect(spy).toHaveBeenCalled();
    });

    it('should NOT emit confirmed when the cancel button is clicked', async () => {
        const spy = vi.spyOn(host, 'onConfirmed');

        const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
        button.click();
        appRef.tick();
        await fixture.whenStable();

        const cancelButton = document.body.querySelector('ui-alert-dialog-cancel button') as HTMLButtonElement | null;
        if (cancelButton) {
            cancelButton.click();
            appRef.tick();
            await fixture.whenStable();
        }

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
