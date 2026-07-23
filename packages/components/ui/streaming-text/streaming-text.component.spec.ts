import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { StreamingTextComponent } from './streaming-text.component';

interface MatchMediaResult {
    matches: boolean;
    media: string;
    addEventListener: () => void;
    removeEventListener: () => void;
    addListener: () => void;
    removeListener: () => void;
    dispatchEvent: () => boolean;
    onchange: null;
}

function stubMatchMedia(reduced: boolean): void {
    const impl = (query: string): MatchMediaResult => ({
        matches: reduced,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
        onchange: null,
    });
    vi.stubGlobal('matchMedia', impl);
    (globalThis.window as unknown as { matchMedia: typeof impl }).matchMedia = impl;
}

describe('StreamingTextComponent', () => {
    let component: StreamingTextComponent;
    let fixture: ComponentFixture<StreamingTextComponent>;
    let destroyed: boolean;

    function create(): void {
        fixture = TestBed.createComponent(StreamingTextComponent);
        component = fixture.componentInstance;
    }

    function destroy(): void {
        if (fixture && !destroyed) {
            destroyed = true;
            fixture.destroy();
        }
    }

    beforeEach(() => {
        destroyed = false;
        vi.useFakeTimers();
        stubMatchMedia(false);
    });

    afterEach(() => {
        destroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('should create', () => {
        create();
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('reveals text char-by-char and marks typing while active', () => {
        create();
        fixture.componentRef.setInput('text', 'Hi');
        fixture.componentRef.setInput('speed', 10);
        fixture.detectChanges();

        expect(component.displayedText()).toBe('');
        expect(component.isTyping()).toBe(true);

        vi.advanceTimersByTime(10);
        expect(component.displayedText()).toBe('H');

        vi.advanceTimersByTime(10);
        expect(component.displayedText()).toBe('Hi');
        expect(component.isTyping()).toBe(true);
    });

    it('stops typing and emits complete after the full text is revealed', () => {
        const done = vi.fn();
        create();
        component.complete.subscribe(() => done());
        fixture.componentRef.setInput('text', 'Hi');
        fixture.componentRef.setInput('speed', 5);
        fixture.detectChanges();

        vi.advanceTimersByTime(5 * 3);
        expect(component.displayedText()).toBe('Hi');
        expect(component.isTyping()).toBe(false);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it('shows the blinking cursor while typing and hides it once done', () => {
        create();
        fixture.componentRef.setInput('text', 'Hi');
        fixture.componentRef.setInput('speed', 5);
        fixture.detectChanges();

        const cursorWhileTyping = fixture.debugElement.query(By.css('.animate-pulse'));
        expect(cursorWhileTyping).not.toBeNull();

        vi.advanceTimersByTime(5 * 3);
        fixture.detectChanges();
        const cursorAfter = fixture.debugElement.query(By.css('.animate-pulse'));
        expect(cursorAfter).toBeNull();
    });

    it('never shows the cursor when showCursor is false', () => {
        create();
        fixture.componentRef.setInput('text', 'Hi');
        fixture.componentRef.setInput('showCursor', false);
        fixture.detectChanges();

        const cursor = fixture.debugElement.query(By.css('.animate-pulse'));
        expect(cursor).toBeNull();
    });

    it('reveals full text instantly and emits complete when reduced motion is preferred', () => {
        stubMatchMedia(true);
        const done = vi.fn();
        create();
        component.complete.subscribe(() => done());
        fixture.componentRef.setInput('text', 'Instant');
        fixture.detectChanges();

        expect(component.displayedText()).toBe('Instant');
        expect(component.isTyping()).toBe(false);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it('does not restart the interval when text is appended mid-stream', () => {
        create();
        fixture.componentRef.setInput('text', 'Hel');
        fixture.componentRef.setInput('speed', 10);
        fixture.detectChanges();

        vi.advanceTimersByTime(10);
        expect(component.displayedText()).toBe('H');

        fixture.componentRef.setInput('text', 'Hello');
        fixture.detectChanges();

        vi.advanceTimersByTime(10 * 4);
        expect(component.displayedText()).toBe('Hello');
    });

    it('resets displayed text when a completely new message replaces the old one', () => {
        create();
        fixture.componentRef.setInput('text', 'Hello');
        fixture.componentRef.setInput('speed', 10);
        fixture.detectChanges();

        vi.advanceTimersByTime(10 * 5);
        expect(component.displayedText()).toBe('Hello');

        fixture.componentRef.setInput('text', 'World');
        fixture.detectChanges();
        expect(component.displayedText()).toBe('');

        vi.advanceTimersByTime(10 * 5);
        expect(component.displayedText()).toBe('World');
    });

    it('completes immediately for empty text', () => {
        const done = vi.fn();
        create();
        component.complete.subscribe(() => done());
        fixture.componentRef.setInput('speed', 5);
        fixture.detectChanges();

        vi.advanceTimersByTime(5);
        expect(component.displayedText()).toBe('');
        expect(component.isTyping()).toBe(false);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it('applies a custom class alongside the base classes', () => {
        create();
        fixture.componentRef.setInput('class', 'text-red-500');
        fixture.detectChanges();

        expect(component.classes()).toContain('text-red-500');
        expect(component.classes()).toContain('whitespace-pre-wrap');
    });

    it('clears the interval on destroy while still typing', () => {
        create();
        fixture.componentRef.setInput('text', 'Long text here');
        fixture.componentRef.setInput('speed', 10);
        fixture.detectChanges();

        expect(component.isTyping()).toBe(true);
        destroy();
        expect(component.isTyping()).toBe(false);
    });
});
