import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { TextRevealComponent } from './text-reveal.component';

describe('TextRevealComponent', () => {
    let fixture: ComponentFixture<TextRevealComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TextRevealComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TextRevealComponent);
        fixture.detectChanges();
    });

    it('should render each word in a separate span, however the words are spaced', () => {
        fixture.componentRef.setInput('text', ' The quick\nbrown   fox\u00a0jumps ');
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        // A no-break space keeps its two words together in one span.
        expect(spans.map(s => s.nativeElement.textContent.trim())).toEqual(['The', 'quick', 'brown', 'fox\u00a0jumps']);
    });

    it('should apply animation-delay style to word spans', () => {
        fixture.componentRef.setInput('text', 'Hello World');
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        expect(spans[0].nativeElement.style.animationDelay).toBe('0ms');
        expect(spans[1].nativeElement.style.animationDelay).toBe('50ms');
    });

    it('should apply blur-in animation class to spans', () => {
        fixture.componentRef.setInput('text', 'Hello');
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        expect(spans[0].nativeElement.className).toContain('animate-blur-in');
    });

    it('should accept custom class input', () => {
        fixture.componentRef.setInput('class', 'text-4xl');
        fixture.detectChanges();

        const container = fixture.debugElement.children[0];
        expect(container.nativeElement.className).toContain('text-4xl');
    });

    it('should render no word spans when the text is empty or only whitespace', () => {
        for (const text of ['', '   ']) {
            fixture.componentRef.setInput('text', text);
            fixture.detectChanges();

            expect(fixture.debugElement.queryAll(By.css('span')), JSON.stringify(text)).toHaveLength(0);
        }
    });

    it('should stagger animation delays incrementally for many words', () => {
        fixture.componentRef.setInput('text', 'a b c d e');
        fixture.componentRef.setInput('delay', 100);
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        expect(spans).toHaveLength(5);
        expect(spans[0].nativeElement.style.animationDelay).toBe('0ms');
        expect(spans[1].nativeElement.style.animationDelay).toBe('100ms');
        expect(spans[2].nativeElement.style.animationDelay).toBe('200ms');
        expect(spans[3].nativeElement.style.animationDelay).toBe('300ms');
        expect(spans[4].nativeElement.style.animationDelay).toBe('400ms');
    });

    it('should include non-breaking space after each word', () => {
        fixture.componentRef.setInput('text', 'Hello World');
        fixture.detectChanges();

        const spans = fixture.debugElement.queryAll(By.css('span'));
        expect(spans[0].nativeElement.textContent).toContain('\u00a0');
    });
});
