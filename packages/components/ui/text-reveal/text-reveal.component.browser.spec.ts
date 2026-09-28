import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TextRevealComponent } from './text-reveal.component';

/** Real-browser check: wrapping is geometry, which jsdom cannot lay out. */
describe('TextRevealComponent layout (browser)', () => {
    it('wraps words onto several lines in a narrow container, never splitting a word', () => {
        TestBed.configureTestingModule({ imports: [TextRevealComponent] });
        const fixture = TestBed.createComponent(TextRevealComponent);
        const host = fixture.nativeElement as HTMLElement;
        host.style.display = 'block';
        host.style.width = '120px';
        fixture.componentRef.setInput('text', 'The quick brown fox jumps over the lazy dog');
        fixture.detectChanges();

        const spans = Array.from(host.querySelectorAll('span'));
        // offsetTop is the laid-out line position; rects would include the blur-in transform.
        const tops = new Set(spans.map(span => span.offsetTop));
        expect(tops.size).toBeGreaterThan(1);
        for (const span of spans) {
            expect(span.getClientRects()).toHaveLength(1);
        }
    });
});
