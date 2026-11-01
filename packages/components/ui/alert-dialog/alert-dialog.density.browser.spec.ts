import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { AlertDialogComponent, AlertDialogContentComponent } from './index';
import { SheetComponent, SheetContentComponent } from '../sheet';

@Component({
    template: `
        <div style="--density: 1.5">
            <ui-alert-dialog><ui-alert-dialog-content>Body</ui-alert-dialog-content></ui-alert-dialog>
            <ui-sheet><ui-sheet-content>Body</ui-sheet-content></ui-sheet>
        </div>
    `,
    imports: [AlertDialogComponent, AlertDialogContentComponent, SheetComponent, SheetContentComponent],
})
class Host {
    readonly alert = viewChild.required(AlertDialogComponent);
    readonly sheet = viewChild.required(SheetComponent);
}

describe('Modal panel density (browser)', () => {
    it('scales alert dialog and sheet padding with --density, like the dialog (1rem × 1.5 below the sm breakpoint)', () => {
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        fixture.componentInstance.alert().open.set(true);
        fixture.componentInstance.sheet().open.set(true);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        const pad = (slot: string): string =>
            getComputedStyle(root.querySelector(`[data-slot="${slot}"]`)!).paddingTop;
        expect(pad('alert-dialog-content')).toBe('24px');
        expect(pad('sheet-content')).toBe('24px');
    });
});
