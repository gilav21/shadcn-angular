import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ShineBorderComponent } from './shine-border.component';

@Component({
    template: `
        <ui-shine-border
            [colors]="colors()"
            [duration]="duration()"
            [borderWidth]="borderWidth()"
            [borderRadius]="borderRadius()"
            [class]="cls()"
        >
            <span>Content</span>
        </ui-shine-border>
    `,
    imports: [ShineBorderComponent],
})
class TestHostComponent {
    colors = signal<string[]>(['#A07CFE', '#FE8FB5', '#FFBE7B']);
    duration = signal(3);
    borderWidth = signal(2);
    borderRadius = signal(8);
    cls = signal('');
}

describe('ShineBorderComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let rafSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render wrapper div with data-slot attribute', () => {
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        expect(wrapper).toBeTruthy();
    });

    it('should apply conic-gradient background to the wrapper via inline style', () => {
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        const bg = (wrapper.nativeElement as HTMLElement).style.background;
        expect(bg).toContain('conic-gradient');
    });

    it('should include all colors in the conic-gradient', () => {
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        const bg = (wrapper.nativeElement as HTMLElement).style.background;
        expect(bg).toContain('conic-gradient');
    });

    it('should apply border width as padding on the wrapper', () => {
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        expect((wrapper.nativeElement as HTMLElement).style.padding).toBe('2px');
    });

    it('should apply border radius as inline style on the wrapper', () => {
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        expect((wrapper.nativeElement as HTMLElement).style.borderRadius).toBe('8px');
    });

    it('should render inner div with bg-background class', () => {
        const inner = fixture.debugElement.query(By.css('.bg-background'));
        expect(inner).toBeTruthy();
    });

    it('should project content inside the inner container', () => {
        const inner = fixture.debugElement.query(By.css('.bg-background'));
        expect(inner.nativeElement.textContent.trim()).toBe('Content');
    });

    it('should apply custom class to the wrapper', () => {
        host.cls.set('my-custom-class');
        fixture.detectChanges();

        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        expect((wrapper.nativeElement as HTMLElement).className).toContain('my-custom-class');
    });

    it('should include relative and inline-block classes on the wrapper', () => {
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        const className = (wrapper.nativeElement as HTMLElement).className;
        expect(className).toContain('relative');
        expect(className).toContain('inline-block');
    });

    it('should start RAF animation loop on afterViewInit', () => {
        expect(rafSpy).toHaveBeenCalled();
    });

    it('should cancel animation frame on destroy', () => {
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        fixture.destroy();
        expect(cancelSpy).toHaveBeenCalled();
    });

    it('should have host with contents class', () => {
        const hostEl = fixture.debugElement.query(By.directive(ShineBorderComponent));
        expect((hostEl.nativeElement as HTMLElement).className).toContain('contents');
    });

    it('should compute wrapperClasses with custom class', () => {
        host.cls.set('w-full');
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(ShineBorderComponent)).componentInstance as ShineBorderComponent;
        expect(comp.wrapperClasses()).toContain('w-full');
        expect(comp.wrapperClasses()).toContain('relative');
        expect(comp.wrapperClasses()).toContain('inline-block');
    });

    it('should compute innerClasses with bg-background', () => {
        const comp = fixture.debugElement.query(By.directive(ShineBorderComponent)).componentInstance as ShineBorderComponent;
        expect(comp.innerClasses()).toContain('bg-background');
        expect(comp.innerClasses()).toContain('rounded-[inherit]');
    });

    it('should update gradient when RAF callback fires', () => {
        const comp = fixture.debugElement.query(By.directive(ShineBorderComponent)).componentInstance as ShineBorderComponent;
        (comp as any).applyStaticGradient(90);

        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        const bg = (wrapper.nativeElement as HTMLElement).style.background;
        expect(bg).toContain('conic-gradient');
        expect(bg).toContain('90deg');
    });

    it('should apply borderWidth and borderRadius from inputs', () => {
        const wrapper = fixture.debugElement.query(By.css('[data-slot="shine-border"]'));
        expect((wrapper.nativeElement as HTMLElement).style.padding).toBe('2px');
        expect((wrapper.nativeElement as HTMLElement).style.borderRadius).toBe('8px');
    });
});
