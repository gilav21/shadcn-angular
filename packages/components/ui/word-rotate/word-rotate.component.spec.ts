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

type MediaQueryLike = { matches: boolean; media: string };

let reducedMotion = false;
const originalMatchMedia = globalThis.window.matchMedia;

function fakeMatchMedia(query: string): MediaQueryLike {
    return { matches: reducedMotion, media: query };
}

function comp(fixture: ComponentFixture<TestHostComponent>): WordRotateComponent {
    return fixture.debugElement.query(By.directive(WordRotateComponent))
        .componentInstance as WordRotateComponent;
}

function wordSpans(fixture: ComponentFixture<TestHostComponent>) {
    return fixture.debugElement.queryAll(By.css('[data-slot="word-rotate"] span'));
}

describe('WordRotateComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        reducedMotion = false;
        (globalThis.window as unknown as { matchMedia: typeof fakeMatchMedia }).matchMedia =
            fakeMatchMedia;
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
        (globalThis.window as unknown as { matchMedia: typeof originalMatchMedia }).matchMedia =
            originalMatchMedia;
    });

    it('should render a span for each word', () => {
        expect(wordSpans(fixture)).toHaveLength(3);
    });

    it('should contain the text of each word in separate spans', () => {
        const texts = wordSpans(fixture).map(s => s.nativeElement.textContent.trim());
        expect(texts).toContain('Hello');
        expect(texts).toContain('World');
        expect(texts).toContain('Angular');
    });

    it('should show first word initially (index 0 is current)', () => {
        expect(comp(fixture).currentIndex()).toBe(0);

        const spans = wordSpans(fixture);
        expect(spans[0].nativeElement.className).toContain('opacity-100');
        expect(spans[1].nativeElement.className).toContain('opacity-0');
    });

    it('should mark the previous word with the outgoing (-translate-y-full) class', () => {
        const spans = wordSpans(fixture);
        expect(spans[2].nativeElement.className).toContain('-translate-y-full');
        expect(spans[1].nativeElement.className).toContain('translate-y-full');
        expect(spans[1].nativeElement.className).not.toContain('-translate-y-full');
    });

    it('should cycle to the next word after the duration interval', () => {
        expect(comp(fixture).currentIndex()).toBe(0);

        vi.advanceTimersByTime(2000);
        fixture.detectChanges();

        expect(comp(fixture).currentIndex()).toBe(1);
    });

    it('should cycle back to the first word after all words shown', () => {
        vi.advanceTimersByTime(2000 * 3);
        fixture.detectChanges();

        expect(comp(fixture).currentIndex()).toBe(0);
    });

    it('should apply correct classes to the currently visible word', () => {
        vi.advanceTimersByTime(2000);
        fixture.detectChanges();

        const spans = wordSpans(fixture);
        expect(spans[1].nativeElement.className).toContain('opacity-100');
        expect(spans[0].nativeElement.className).toContain('opacity-0');
    });

    it('should apply custom class to the container span', () => {
        host.cls.set('text-4xl');
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[data-slot="word-rotate"]'));
        expect((container.nativeElement as HTMLElement).className).toContain('text-4xl');
    });

    it('should set data-slot attribute', () => {
        expect(fixture.debugElement.query(By.css('[data-slot="word-rotate"]'))).toBeTruthy();
    });

    it('should update rendered words when words input changes', () => {
        host.words.set(['Foo', 'Bar']);
        fixture.detectChanges();

        expect(wordSpans(fixture)).toHaveLength(2);
    });

    it('should not schedule rotation when reduced motion is preferred', () => {
        reducedMotion = true;

        const staticFixture = TestBed.createComponent(TestHostComponent);
        staticFixture.detectChanges();

        vi.advanceTimersByTime(2000 * 5);
        staticFixture.detectChanges();

        expect(comp(staticFixture).currentIndex()).toBe(0);
    });

    it('should not schedule rotation for a single-word list', () => {
        const singleFixture = TestBed.createComponent(TestHostComponent);
        singleFixture.componentInstance.words.set(['Only']);
        singleFixture.detectChanges();

        vi.advanceTimersByTime(2000 * 5);
        singleFixture.detectChanges();

        expect(comp(singleFixture).currentIndex()).toBe(0);
        expect(wordSpans(singleFixture)).toHaveLength(1);
    });
});
