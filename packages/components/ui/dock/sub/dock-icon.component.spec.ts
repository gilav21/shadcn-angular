import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DockIconComponent } from './dock-icon.component';
import { describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';

@Component({
    template: `
        <ui-dock-icon [class]="iconClass()">
            <span class="test-icon-content">Icon</span>
        </ui-dock-icon>
    `,
    imports: [DockIconComponent]
})
class TestHostComponent {
    iconClass = signal('');
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

    it('should project content', () => {
        const content = fixture.debugElement.query(By.css('.test-icon-content'));
        expect(content).toBeTruthy();
        expect(content.nativeElement.textContent).toBe('Icon');
    });

    it('should apply custom class', async () => {
        host.iconClass.set('bg-blue-500 rounded-xl');
        fixture.detectChanges();
        await fixture.whenStable();

        const el = fixture.debugElement.query(By.css('[data-slot="dock-icon"]'));
        expect(el.nativeElement.className).toContain('bg-blue-500');
        expect(el.nativeElement.className).toContain('rounded-xl');
    });
});
