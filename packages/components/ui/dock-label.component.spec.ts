import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DockLabelComponent } from './dock-label.component';
import { describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';

@Component({
    template: `
        <ui-dock-label [class]="labelClass()">
            {{ labelText() }}
        </ui-dock-label>
    `,
    imports: [DockLabelComponent]
})
class TestHostComponent {
    labelClass = signal('');
    labelText = signal('Home');
}

describe('DockLabelComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render with data-slot attribute', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="dock-label"]'));
        expect(el).toBeTruthy();
    });

    it('should project label text', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="dock-label"]'));
        expect(el.nativeElement.textContent.trim()).toBe('Home');
    });

    it('should update projected text content', async () => {
        host.labelText.set('Settings');
        fixture.detectChanges();
        await fixture.whenStable();

        const el = fixture.debugElement.query(By.css('[data-slot="dock-label"]'));
        expect(el.nativeElement.textContent.trim()).toBe('Settings');
    });

    it('should apply custom class', async () => {
        host.labelClass.set('text-red-500');
        fixture.detectChanges();
        await fixture.whenStable();

        const el = fixture.debugElement.query(By.css('[data-slot="dock-label"]'));
        expect(el.nativeElement.className).toContain('text-red-500');
    });

    it('should have positioning classes', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="dock-label"]'));
        expect(el.nativeElement.className).toContain('absolute');
    });

    it('should have group-hover visibility class', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="dock-label"]'));
        expect(el.nativeElement.className).toContain('group-hover:block');
    });
});
