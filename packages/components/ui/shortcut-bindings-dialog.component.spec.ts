import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ShortcutBindingsDialogComponent } from './shortcut-bindings-dialog.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
    template: `
        <ui-shortcut-bindings-dialog
            [(open)]="open"
            [allowSaveMapping]="allowSaveMapping"
        />
    `,
    imports: [ShortcutBindingsDialogComponent]
})
class TestHostComponent {
    open = false;
    allowSaveMapping = false;
}

describe('ShortcutBindingsDialogComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
            providers: [provideNoopAnimations()]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should start with dialog closed', () => {
        expect(host.open).toBe(false);
    });

    it('should accept allowSaveMapping input', () => {
        host.allowSaveMapping = true;
        fixture.detectChanges();
        expect(host.allowSaveMapping).toBe(true);
    });
});
