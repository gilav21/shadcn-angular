import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MorphingTextComponent } from './morphing-text.component';

@Component({
    template: `<ui-morphing-text [texts]="texts()" [interval]="interval()" [class]="cls()" />`,
    imports: [MorphingTextComponent],
})
class TestHostComponent {
    texts = signal<string[]>(['Hello', 'World', 'Angular']);
    interval = signal(3000);
    cls = signal('');
}

describe('MorphingTextComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        vi.useFakeTimers();

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should render current text initially', () => {
        const comp = fixture.debugElement.query(By.directive(MorphingTextComponent)).componentInstance as MorphingTextComponent;
        expect(comp.currentText()).toBe('Hello');
    });

    it('should render next text initially (second text in list)', () => {
        const comp = fixture.debugElement.query(By.directive(MorphingTextComponent)).componentInstance as MorphingTextComponent;
        expect(comp.nextText()).toBe('World');
    });

    it('should compute the longest text for sizing', () => {
        host.texts.set(['Hi', 'Hello World', 'Bye']);
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(MorphingTextComponent)).componentInstance as MorphingTextComponent;
        expect(comp.longestText()).toBe('Hello World');
    });

    it('should render an invisible span with the longest text', () => {
        host.texts.set(['Hi', 'Hello World', 'Bye']);
        fixture.detectChanges();

        const invisibleSpan = fixture.debugElement.query(By.css('.invisible'));
        expect(invisibleSpan).toBeTruthy();
        expect(invisibleSpan.nativeElement.textContent).toBe('Hello World');
    });

    it('should start with currentVisible = true', () => {
        const comp = fixture.debugElement.query(By.directive(MorphingTextComponent)).componentInstance as MorphingTextComponent;
        expect(comp.currentVisible()).toBe(true);
    });

    it('should toggle currentVisible after half the interval', () => {
        const comp = fixture.debugElement.query(By.directive(MorphingTextComponent)).componentInstance as MorphingTextComponent;
        expect(comp.currentVisible()).toBe(true);

        vi.advanceTimersByTime(1500);
        fixture.detectChanges();

        expect(comp.currentVisible()).toBe(false);
    });

    it('should advance to next text after a full interval cycle', () => {
        const comp = fixture.debugElement.query(By.directive(MorphingTextComponent)).componentInstance as MorphingTextComponent;

        vi.advanceTimersByTime(3000);
        fixture.detectChanges();

        expect(comp.currentText()).toBe('World');
    });

    it('should set data-slot attribute', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="morphing-text"]'));
        expect(el).toBeTruthy();
    });

    it('should apply custom class to container', () => {
        host.cls.set('text-5xl');
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[data-slot="morphing-text"]'));
        expect((container.nativeElement as HTMLElement).className).toContain('text-5xl');
    });

    it('should compute transition duration as fraction of interval', () => {
        host.interval.set(6000);
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(MorphingTextComponent)).componentInstance as MorphingTextComponent;
        expect(comp.transitionDuration()).toBe('500ms');
    });
});
