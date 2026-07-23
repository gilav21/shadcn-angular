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

interface WindowLike {
    matchMedia?: (q: string) => { matches: boolean };
}

describe('MorphingTextComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let originalMatchMedia: WindowLike['matchMedia'];
    let reducedMotion = false;

    const getComp = (): MorphingTextComponent =>
        fixture.debugElement.query(By.directive(MorphingTextComponent))
            .componentInstance as MorphingTextComponent;

    beforeEach(async () => {
        vi.useFakeTimers();

        const win = globalThis.window as unknown as WindowLike;
        originalMatchMedia = win.matchMedia;
        reducedMotion = false;
        win.matchMedia = (): { matches: boolean } => ({ matches: reducedMotion });

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
    });

    afterEach(() => {
        fixture.destroy();
        const win = globalThis.window as unknown as WindowLike;
        if (originalMatchMedia) {
            win.matchMedia = originalMatchMedia;
        } else {
            delete win.matchMedia;
        }
        vi.useRealTimers();
    });

    it('should render current text initially', () => {
        fixture.detectChanges();
        expect(getComp().currentText()).toBe('Hello');
    });

    it('should render next text initially (second text in list)', () => {
        fixture.detectChanges();
        expect(getComp().nextText()).toBe('World');
    });

    it('should return empty strings for current/next when texts is empty', () => {
        host.texts.set([]);
        fixture.detectChanges();

        const comp = getComp();
        expect(comp.currentText()).toBe('');
        expect(comp.nextText()).toBe('');
        expect(comp.longestText()).toBe('');
    });

    it('should compute the longest text for sizing', () => {
        host.texts.set(['Hi', 'Hello World', 'Bye']);
        fixture.detectChanges();
        expect(getComp().longestText()).toBe('Hello World');
    });

    it('should render an invisible span with the longest text', () => {
        host.texts.set(['Hi', 'Hello World', 'Bye']);
        fixture.detectChanges();

        const invisibleSpan = fixture.debugElement.query(By.css('.invisible'));
        expect(invisibleSpan).toBeTruthy();
        expect((invisibleSpan.nativeElement as HTMLElement).textContent).toBe('Hello World');
    });

    it('should start with currentVisible = true', () => {
        fixture.detectChanges();
        expect(getComp().currentVisible()).toBe(true);
    });

    it('should toggle currentVisible after half the interval', () => {
        fixture.detectChanges();
        const comp = getComp();
        expect(comp.currentVisible()).toBe(true);

        vi.advanceTimersByTime(1500);
        fixture.detectChanges();

        expect(comp.currentVisible()).toBe(false);
    });

    it('should advance to next text after a full interval cycle', () => {
        fixture.detectChanges();
        const comp = getComp();

        vi.advanceTimersByTime(3000);
        fixture.detectChanges();

        expect(comp.currentText()).toBe('World');
    });

    it('should wrap around to the first text after cycling through all', () => {
        fixture.detectChanges();
        const comp = getComp();

        vi.advanceTimersByTime(3000 * 3);
        fixture.detectChanges();

        expect(comp.currentText()).toBe('Hello');
    });

    it('should not start the loop when only one text is provided', () => {
        host.texts.set(['Solo']);
        fixture.detectChanges();
        const comp = getComp();

        vi.advanceTimersByTime(9000);
        fixture.detectChanges();

        expect(comp.currentVisible()).toBe(true);
        expect(comp.currentText()).toBe('Solo');
    });

    it('should not start the loop when reduced motion is preferred', () => {
        reducedMotion = true;
        fixture.detectChanges();
        const comp = getComp();

        vi.advanceTimersByTime(9000);
        fixture.detectChanges();

        expect(comp.currentVisible()).toBe(true);
        expect(comp.currentText()).toBe('Hello');
    });

    it('should stop toggling after the fixture is destroyed', () => {
        fixture.detectChanges();
        const comp = getComp();

        fixture.destroy();

        expect(() => vi.advanceTimersByTime(9000)).not.toThrow();
        expect(comp.currentVisible()).toBe(true);
    });

    it('should set data-slot attribute', () => {
        fixture.detectChanges();
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
        expect(getComp().transitionDuration()).toBe('500ms');
    });

    it('should cap transition duration at a third of small intervals', () => {
        host.interval.set(900);
        fixture.detectChanges();
        expect(getComp().transitionDuration()).toBe('300ms');
    });
});
