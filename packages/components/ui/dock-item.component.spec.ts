import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal, ViewChild } from '@angular/core';
import { DockItemComponent } from './dock-item.component';
import { describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';

@Component({
    template: `
        <ui-dock-item [class]="itemClass()" [active]="active()">
            <span class="test-item-content">Content</span>
        </ui-dock-item>
    `,
    imports: [DockItemComponent]
})
class TestHostComponent {
    itemClass = signal('');
    active = signal(false);
    @ViewChild(DockItemComponent) dockItem!: DockItemComponent;
}

describe('DockItemComponent', () => {
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
        const el = fixture.debugElement.query(By.css('[data-slot="dock-item"]'));
        expect(el).toBeTruthy();
    });

    it('should project content', () => {
        const content = fixture.debugElement.query(By.css('.test-item-content'));
        expect(content).toBeTruthy();
        expect(content.nativeElement.textContent).toBe('Content');
    });

    it('should not show active indicator when active is false', () => {
        host.active.set(false);
        fixture.detectChanges();

        const indicator = fixture.debugElement.query(By.css('.bg-foreground\\/50'));
        expect(indicator).toBeFalsy();
    });

    it('should show active indicator when active is true', async () => {
        host.active.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const indicator = fixture.debugElement.query(By.css('.bg-foreground\\/50'));
        expect(indicator).toBeTruthy();
    });

    it('should apply custom class', async () => {
        host.itemClass.set('custom-dock-item');
        fixture.detectChanges();
        await fixture.whenStable();

        const el = fixture.debugElement.query(By.directive(DockItemComponent));
        expect(el.nativeElement.className).toContain('custom-dock-item');
    });

    it('should have cursor-pointer class', () => {
        const el = fixture.debugElement.query(By.directive(DockItemComponent));
        expect(el.nativeElement.className).toContain('cursor-pointer');
    });

    it('should start bounce animation', async () => {
        host.dockItem.startBounce();
        fixture.detectChanges();
        await fixture.whenStable();

        const el = fixture.debugElement.query(By.directive(DockItemComponent));
        expect(el.nativeElement.className).toContain('animate-bounce');
    });
});
