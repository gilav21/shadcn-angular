import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DockIconComponent } from './dock-icon.component';
import { describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';

@Component({
    template: `
        <ui-dock-icon [class]="iconClass">
            <span class="test-icon-content">Icon</span>
        </ui-dock-icon>
    `,
    imports: [DockIconComponent]
})
class TestHostComponent {
    iconClass = '';
}

describe('DockIconComponent', () => {
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
        const el = fixture.debugElement.query(By.css('[data-slot="dock-icon"]'));
        expect(el).toBeTruthy();
    });

    it('should project content', () => {
        const content = fixture.debugElement.query(By.css('.test-icon-content'));
        expect(content).toBeTruthy();
        expect(content.nativeElement.textContent).toBe('Icon');
    });

    it('should apply custom class', () => {
        host.iconClass = 'bg-blue-500 rounded-xl';
        fixture.detectChanges();

        const el = fixture.debugElement.query(By.css('[data-slot="dock-icon"]'));
        expect(el.nativeElement.className).toContain('bg-blue-500');
        expect(el.nativeElement.className).toContain('rounded-xl');
    });

    it('should have base layout classes', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="dock-icon"]'));
        expect(el.nativeElement.className).toContain('flex');
        expect(el.nativeElement.className).toContain('items-center');
        expect(el.nativeElement.className).toContain('justify-center');
    });
});
