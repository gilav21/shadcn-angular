import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WordRotateComponent } from './word-rotate.component';

@Component({
    template: `<ui-word-rotate [words]="words()" [duration]="duration()" [class]="cls()" />`,
    imports: [WordRotateComponent],
})
class TestHostComponent {
    words = signal<string[]>(['Hello', 'World', 'Angular']);
    duration = signal(2000);
    cls = signal('');
}

describe('WordRotateComponent', () => {
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

    it('should render a span for each word', () => {
        const wordSpans = fixture.debugElement.queryAll(By.css('[data-slot="word-rotate"] span'));
        expect(wordSpans.length).toBe(3);
    });

    it('should contain the text of each word in separate spans', () => {
        const wordSpans = fixture.debugElement.queryAll(By.css('[data-slot="word-rotate"] span'));
        const texts = wordSpans.map(s => s.nativeElement.textContent.trim());
        expect(texts).toContain('Hello');
        expect(texts).toContain('World');
        expect(texts).toContain('Angular');
    });

    it('should show first word initially (index 0 is current)', () => {
        const comp = fixture.debugElement.query(By.directive(WordRotateComponent)).componentInstance as WordRotateComponent;
        expect(comp.currentIndex()).toBe(0);

        const wordSpans = fixture.debugElement.queryAll(By.css('[data-slot="word-rotate"] span'));
        expect(wordSpans[0].nativeElement.className).toContain('opacity-100');
        expect(wordSpans[1].nativeElement.className).toContain('opacity-0');
    });

    it('should cycle to the next word after the duration interval', () => {
        const comp = fixture.debugElement.query(By.directive(WordRotateComponent)).componentInstance as WordRotateComponent;
        expect(comp.currentIndex()).toBe(0);

        vi.advanceTimersByTime(2000);
        fixture.detectChanges();

        expect(comp.currentIndex()).toBe(1);
    });

    it('should cycle back to the first word after all words shown', () => {
        const comp = fixture.debugElement.query(By.directive(WordRotateComponent)).componentInstance as WordRotateComponent;

        vi.advanceTimersByTime(2000 * 3);
        fixture.detectChanges();

        expect(comp.currentIndex()).toBe(0);
    });

    it('should apply correct classes to the currently visible word', () => {
        vi.advanceTimersByTime(2000);
        fixture.detectChanges();

        const wordSpans = fixture.debugElement.queryAll(By.css('[data-slot="word-rotate"] span'));
        expect(wordSpans[1].nativeElement.className).toContain('opacity-100');
        expect(wordSpans[0].nativeElement.className).toContain('opacity-0');
    });

    it('should apply custom class to the container span', () => {
        host.cls.set('text-4xl');
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[data-slot="word-rotate"]'));
        expect((container.nativeElement as HTMLElement).className).toContain('text-4xl');
    });

    it('should set data-slot attribute', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="word-rotate"]'));
        expect(el).toBeTruthy();
    });

    it('should update rendered words when words input changes', () => {
        host.words.set(['Foo', 'Bar']);
        fixture.detectChanges();

        const wordSpans = fixture.debugElement.queryAll(By.css('[data-slot="word-rotate"] span'));
        expect(wordSpans.length).toBe(2);
    });
});
