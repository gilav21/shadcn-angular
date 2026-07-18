import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TypingAnimationComponent } from './typing-animation.component';

type MatchMediaFn = (query: string) => { matches: boolean };

let reducedMotion = false;
let originalMatchMedia: MatchMediaFn | undefined;

function installMatchMedia(): void {
    const win = globalThis.window as unknown as { matchMedia?: MatchMediaFn };
    originalMatchMedia = win.matchMedia;
    win.matchMedia = () => ({ matches: reducedMotion });
}

function restoreMatchMedia(): void {
    const win = globalThis.window as unknown as { matchMedia?: MatchMediaFn };
    win.matchMedia = originalMatchMedia;
}

function getComp(fixture: ComponentFixture<unknown>): TypingAnimationComponent {
    return fixture.debugElement.query(By.directive(TypingAnimationComponent))
        .componentInstance as TypingAnimationComponent;
}

@Component({
    template: `
        <ui-typing-animation
            [strings]="strings()"
            [typeSpeed]="typeSpeed()"
            [deleteSpeed]="deleteSpeed()"
            [pauseDuration]="pauseDuration()"
            [loop]="loop()"
            [cursor]="cursor()"
            [class]="cls()"
            (complete)="onComplete()"
        />
    `,
    imports: [TypingAnimationComponent],
})
class TestHostComponent {
    strings = signal<string[]>(['Hello', 'World']);
    typeSpeed = signal(50);
    deleteSpeed = signal(30);
    pauseDuration = signal(1500);
    loop = signal(true);
    cursor = signal(true);
    cls = signal('');
    completeCount = 0;
    onComplete(): void {
        this.completeCount++;
    }
}

describe('TypingAnimationComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        reducedMotion = false;
        installMatchMedia();
        vi.useFakeTimers();

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreMatchMedia();
    });

    it('should start typing immediately (first char typed on init)', () => {
        expect(getComp(fixture).displayText()).toBe('H');
    });

    it('should type additional characters after each typeSpeed interval', () => {
        const comp = getComp(fixture);
        expect(comp.displayText()).toBe('H');

        vi.advanceTimersByTime(50);
        fixture.detectChanges();
        expect(comp.displayText()).toBe('He');
    });

    it('should type all characters of the first string after sufficient time', () => {
        const comp = getComp(fixture);
        vi.advanceTimersByTime(50 * 4);
        fixture.detectChanges();
        expect(comp.displayText()).toBe('Hello');
    });

    it('should render the cursor span when cursor input is true', () => {
        host.cursor.set(true);
        fixture.detectChanges();

        const cursorEl = fixture.debugElement.query(By.css(String.raw`.inline-block.w-\[2px\]`));
        expect(cursorEl).toBeTruthy();
    });

    it('should not render cursor span when cursor input is false', () => {
        host.cursor.set(false);
        fixture.detectChanges();

        const cursorEl = fixture.debugElement.query(By.css(String.raw`.inline-block.w-\[2px\]`));
        expect(cursorEl).toBeFalsy();
    });

    it('should render the display text in a nested span', () => {
        vi.advanceTimersByTime(50 * 4);
        fixture.detectChanges();

        const textSpan = fixture.debugElement.query(
            By.css('[data-slot="typing-animation"] span[aria-hidden="true"]'),
        );
        expect(textSpan.nativeElement.textContent).toBe('Hello');
    });

    it('should expose all phrases as accessible text', () => {
        expect(getComp(fixture).accessibleText()).toBe('Hello, World');
    });

    it('should set data-slot attribute', () => {
        const el = fixture.debugElement.query(By.css('[data-slot="typing-animation"]'));
        expect(el).toBeTruthy();
    });

    it('should apply custom class', () => {
        host.cls.set('text-xl');
        fixture.detectChanges();

        const el = fixture.debugElement.query(By.css('[data-slot="typing-animation"]'));
        expect((el.nativeElement as HTMLElement).className).toContain('text-xl');
    });

    it('should expose blink class only while pausing or waiting', () => {
        const comp = getComp(fixture);
        expect(comp.blinkClass()).toBe('');

        vi.advanceTimersByTime(50 * 5);
        fixture.detectChanges();
        expect(comp.blinkClass()).toBe('cursor-blink');
    });

    it('should begin deleting after typing completes and pause duration elapses', () => {
        const comp = getComp(fixture);
        vi.advanceTimersByTime(50 * 4 + 2000);
        fixture.detectChanges();
        expect(comp.displayText().length).toBeLessThan(5);
    });

    it('should cycle to the next string after deleting completes', () => {
        const comp = getComp(fixture);
        vi.advanceTimersByTime(50 * 4);
        expect(comp.displayText()).toBe('Hello');

        vi.advanceTimersByTime(50 + 1500 + 30 * 5 + 300);
        fixture.detectChanges();

        expect(comp.displayText()).toBe('W');
    });
});

describe('TypingAnimationComponent completion (no loop)', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        reducedMotion = false;
        installMatchMedia();
        vi.useFakeTimers();

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        host.strings.set(['Hi']);
        host.loop.set(false);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreMatchMedia();
    });

    it('should emit complete once the last string is fully typed', () => {
        const comp = getComp(fixture);
        vi.advanceTimersByTime(50 * 2);
        fixture.detectChanges();

        expect(comp.displayText()).toBe('Hi');
        expect(host.completeCount).toBe(1);
    });
});

describe('TypingAnimationComponent reduced motion', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        reducedMotion = true;
        installMatchMedia();
        vi.useFakeTimers();

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        restoreMatchMedia();
    });

    it('should jump straight to the first full string', () => {
        const comp = getComp(fixture);
        expect(comp.displayText()).toBe('Hello');

        vi.advanceTimersByTime(1000);
        expect(comp.displayText()).toBe('Hello');
    });
});

describe('TypingAnimationComponent with empty strings', () => {
    @Component({
        template: `<ui-typing-animation [strings]="[]" />`,
        imports: [TypingAnimationComponent],
    })
    class EmptyStringsHostComponent {}

    let fixture: ComponentFixture<EmptyStringsHostComponent>;

    beforeEach(async () => {
        installMatchMedia();
        await TestBed.configureTestingModule({
            imports: [EmptyStringsHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(EmptyStringsHostComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        restoreMatchMedia();
    });

    it('should have empty display text when strings array is empty', () => {
        expect(getComp(fixture).displayText()).toBe('');
    });
});
