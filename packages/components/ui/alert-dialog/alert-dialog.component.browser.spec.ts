import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { AlertDialogComponent, AlertDialogContentComponent } from './index';

/** Browser-only: header alignment asserted as computed style under an inherited direction. */
@Component({
    template: `
        <div dir="rtl">
            <ui-alert-dialog>
                <ui-alert-dialog-content title="هل أنت متأكد؟" description="لا يمكن التراجع" />
            </ui-alert-dialog>
        </div>
    `,
    imports: [AlertDialogComponent, AlertDialogContentComponent],
})
class RtlHost {}

describe('AlertDialog RTL (real browser)', () => {
    it('right-aligns the header text under dir="rtl"', async () => {
        await TestBed.configureTestingModule({ imports: [RtlHost] }).compileComponents();
        const fixture = TestBed.createComponent(RtlHost);
        fixture.detectChanges();
        const dialog: AlertDialogComponent = fixture.debugElement.query(By.directive(AlertDialogComponent)).componentInstance;
        dialog.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const header = document.querySelector('[data-slot="alert-dialog-header"]')!;
        expect(getComputedStyle(header).textAlign).toBe('right');
    });
});
