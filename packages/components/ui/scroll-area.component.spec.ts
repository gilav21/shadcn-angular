import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ScrollAreaComponent } from './scroll-area.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';

@Component({
    template: `
    <ui-scroll-area class="h-[200px] w-[200px]" [orientation]="orientation()">
      <div class="content" [style.height.px]="contentHeight()" [style.width.px]="contentWidth()">
        Content
      </div>
    </ui-scroll-area>
  `,
    imports: [ScrollAreaComponent]
})
class TestHostComponent {
    orientation = signal<'vertical' | 'horizontal' | 'both'>('vertical');
    contentHeight = signal(400); // Trigger vertical scroll
    contentWidth = signal(200);
}

describe('ScrollAreaComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    // Helper to mock layout
    const mockLayout = (element: HTMLElement, { clientHeight, scrollHeight, clientWidth, scrollWidth }: any) => {
        if (clientHeight !== undefined) Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight });
        if (scrollHeight !== undefined) Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight });
        if (clientWidth !== undefined) Object.defineProperty(element, 'clientWidth', { configurable: true, value: clientWidth });
        if (scrollWidth !== undefined) Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scrollWidth });
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render vertical scrollbar when content overflows', async () => {
        const viewport = fixture.debugElement.query(By.css('[data-slot="scroll-area-viewport"]')).nativeElement;

        // Mock overflow
        mockLayout(viewport, { clientHeight: 200, scrollHeight: 400 });

        // Trigger scroll event or resize observer callback simulation
        // Since we can't easily trigger ResizeObserver in JSDOM without a polyfill/mock that fires,
        // we can call the public/private method? 
        // Or simpler: trigger 'scroll' event which calls updateScrollMetrics?
        // But scroll event only happens if we scroll.
        // The component uses ResizeObserver.

        // Let's manually trigger update logic if possible, or trigger a scroll.
        // But initially scrollTop is 0.

        // Access the component instance to force update?
        const scrollArea = fixture.debugElement.query(By.directive(ScrollAreaComponent)).componentInstance as ScrollAreaComponent;
        (scrollArea as any).updateScrollMetrics();
        fixture.detectChanges();

        const scrollbar = fixture.debugElement.query(By.css('[data-orientation="vertical"]'));
        expect(scrollbar).toBeTruthy();
    });

    it('should hide scrollbars when no overflow', async () => {
        component.contentHeight.set(100);
        fixture.detectChanges();

        const viewport = fixture.debugElement.query(By.css('[data-slot="scroll-area-viewport"]')).nativeElement;
        mockLayout(viewport, { clientHeight: 200, scrollHeight: 100 });

        const scrollArea = fixture.debugElement.query(By.directive(ScrollAreaComponent)).componentInstance as ScrollAreaComponent;
        (scrollArea as any).updateScrollMetrics();
        fixture.detectChanges();

        const scrollbar = fixture.debugElement.query(By.css('[data-orientation="vertical"]'));
        expect(scrollbar).toBeFalsy();
    });

    it('should have scrollbar-none class on viewport to hide native scrollbar', () => {
        const viewport = fixture.debugElement.query(By.css('[data-slot="scroll-area-viewport"]'));
        expect(viewport.nativeElement.classList.contains('scrollbar-none')).toBe(true);
    });
});
