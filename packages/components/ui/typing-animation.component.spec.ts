import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TypingAnimationComponent } from './typing-animation.component';

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
}

describe('TypingAnimationComponent', () => {
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

    it('should start typing immediately (first char typed on init)', () => {
        const comp = fixture.debugElement.query(By.directive(TypingAnimationComponent)).componentInstance as TypingAnimationComponent;
        expect(comp.displayText()).toBe('H');
    });

    it('should type additional characters after each typeSpeed interval', () => {
        const comp = fixture.debugElement.query(By.directive(TypingAnimationComponent)).componentInstance as TypingAnimationComponent;
        expect(comp.displayText()).toBe('H');

        vi.advanceTimersByTime(50);
        fixture.detectChanges();
        expect(comp.displayText()).toBe('He');
    });

    it('should type all characters of the first string after sufficient time', () => {
        const comp = fixture.debugElement.query(By.directive(TypingAnimationComponent)).componentInstance as TypingAnimationComponent;

        vi.advanceTimersByTime(50 * 4);
        fixture.detectChanges();

        expect(comp.displayText()).toBe('Hello');
    });

    it('should render the cursor span when cursor input is true', () => {
        host.cursor.set(true);
        fixture.detectChanges();

        const cursorEl = fixture.debugElement.query(By.css('.inline-block.w-\\[2px\\]'));
        expect(cursorEl).toBeTruthy();
    });

    it('should not render cursor span when cursor input is false', () => {
        host.cursor.set(false);
        fixture.detectChanges();

        const cursorEl = fixture.debugElement.query(By.css('.inline-block.w-\\[2px\\]'));
        expect(cursorEl).toBeFalsy();
    });

    it('should render the display text in a nested span', () => {
        vi.advanceTimersByTime(50 * 4);
        fixture.detectChanges();

        const textSpan = fixture.debugElement.query(By.css('[data-slot="typing-animation"] span'));
        expect(textSpan.nativeElement.textContent).toBe('Hello');
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

    it('should begin deleting after typing completes and pause duration elapses', () => {
        const comp = fixture.debugElement.query(By.directive(TypingAnimationComponent)).componentInstance as TypingAnimationComponent;

        vi.advanceTimersByTime(50 * 4 + 2000);
        fixture.detectChanges();

        expect(comp.displayText().length).toBeLessThan(5);
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
        await TestBed.configureTestingModule({
            imports: [EmptyStringsHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(EmptyStringsHostComponent);
        fixture.detectChanges();
    });

    it('should have empty display text when strings array is empty', () => {
        const comp = fixture.debugElement.query(By.directive(TypingAnimationComponent)).componentInstance as TypingAnimationComponent;
        expect(comp.displayText()).toBe('');
    });
});
