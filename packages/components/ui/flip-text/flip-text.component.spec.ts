import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { FlipTextComponent } from './flip-text.component';

@Component({
    template: `<ui-flip-text [text]="text()" [delay]="delay()" [duration]="duration()" [class]="cls()" />`,
    imports: [FlipTextComponent],
})
class TestHostComponent {
    text = signal('Hello');
    delay = signal(50);
    duration = signal(500);
    cls = signal('');
}

describe('FlipTextComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should split text into individual character spans', () => {
        host.text.set('Hi');
        fixture.detectChanges();

        const charSpans = fixture.debugElement.queryAll(By.css('[data-slot="flip-text"] span'));
        expect(charSpans).toHaveLength(2);
        expect(charSpans[0].nativeElement.textContent).toBe('H');
        expect(charSpans[1].nativeElement.textContent).toBe('i');
    });

    it('should render correct number of character spans for a word', () => {
        host.text.set('Hello');
        fixture.detectChanges();

        const comp = fixture.debugElement.query(By.directive(FlipTextComponent)).componentInstance as FlipTextComponent;
        expect(comp.characters()).toHaveLength(5);
    });

    it('should render non-breaking space for space characters', () => {
        host.text.set('Hi There');
        fixture.detectChanges();

        const charSpans = fixture.debugElement.queryAll(By.css('[data-slot="flip-text"] span'));
        const spaceSpan = charSpans[2];
        expect(spaceSpan.nativeElement.textContent).toBe('\u00A0');
    });

    it('should apply staggered animation delays based on character index', () => {
        host.text.set('ABC');
        host.delay.set(100);
        fixture.detectChanges();

        const charSpans = fixture.debugElement.queryAll(By.css('[data-slot="flip-text"] span'));
        expect(charSpans[0].nativeElement.style.animationDelay).toBe('0ms');
        expect(charSpans[1].nativeElement.style.animationDelay).toBe('100ms');
        expect(charSpans[2].nativeElement.style.animationDelay).toBe('200ms');
    });

    it('should apply custom animation duration to each character span', () => {
        host.text.set('AB');
        host.duration.set(800);
        fixture.detectChanges();

        const charSpans = fixture.debugElement.queryAll(By.css('[data-slot="flip-text"] span'));
        expect(charSpans[0].nativeElement.style.animationDuration).toBe('800ms');
        expect(charSpans[1].nativeElement.style.animationDuration).toBe('800ms');
    });

    it('should apply custom class to the inner span', () => {
        host.cls.set('text-2xl');
        fixture.detectChanges();

        const inner = fixture.debugElement.query(By.css('[data-slot="flip-text"]'));
        expect(inner.nativeElement.className).toContain('text-2xl');
    });

    it('should set data-slot attribute on the inner span', () => {
        const inner = fixture.debugElement.query(By.css('[data-slot="flip-text"]'));
        expect(inner).toBeTruthy();
    });

    it('should update characters when text input changes', () => {
        host.text.set('Hi');
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.css('[data-slot="flip-text"] span'))).toHaveLength(2);

        host.text.set('Hello');
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.css('[data-slot="flip-text"] span'))).toHaveLength(5);
    });
});
