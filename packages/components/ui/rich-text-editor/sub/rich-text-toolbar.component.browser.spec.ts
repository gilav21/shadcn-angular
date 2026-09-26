import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';

/**
 * Browser-only toolbar cases. The roving tab stop only manages controls that
 * are laid out (`offsetParent`), which jsdom reports as null for everything,
 * and the compact frame is asserted as computed style from the Tailwind
 * stylesheet, which jsdom does not load. They run in the real-browser leg
 * only; the portable (jsdom) leg and the shipped `testFiles` exclude this file.
 */
describe('RichTextToolbarComponent', () => {
    let fixture: ComponentFixture<RichTextToolbarComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextToolbarComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextToolbarComponent);
        fixture.detectChanges();
    });

    describe('keyboard navigation (WAI-ARIA toolbar pattern)', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('items', ['bold', 'italic', 'separator', 'underline']);
            fixture.detectChanges();
        });

        it('keeps a single tab stop when a re-render adds the text-style select', async () => {
            // A roving toolbar has ONE tab stop. Managing only the built-in
            // buttons left the select, every addon button and the file input as
            // extra tab stops, so Tab jumped into the middle of the toolbar and
            // the arrows — which index over every button — moved somewhere else
            // again.
            fixture.componentRef.setInput('items', ['bold', 'textStyle', 'italic']);
            fixture.detectChanges();
            // Stops added by a re-render are managed from a MutationObserver,
            // which the browser delivers one microtask later.
            await Promise.resolve();
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const focusables = Array.from(
                toolbar.querySelectorAll<HTMLElement>('button, select, input, [tabindex]'),
            );
            const stops = focusables.filter(el => el.tabIndex === 0);
            expect(focusables.length).toBeGreaterThan(1);
            expect(stops).toHaveLength(1);
        });
    });

    describe('computed config', () => {
        it('drops the toolbar border and background and tightens its padding when compact', () => {
            const toolbar = fixture.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
            const framed = getComputedStyle(toolbar);
            expect(framed.borderBottomWidth).toBe('1px');
            expect(framed.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
            expect(framed.paddingTop).toBe('4px');

            fixture.componentRef.setInput('compact', true);
            fixture.detectChanges();

            const compact = getComputedStyle(toolbar);
            expect(compact.borderBottomWidth).toBe('0px');
            expect(compact.backgroundColor).toBe('rgba(0, 0, 0, 0)');
            expect(compact.paddingTop).toBe('2px');
        });
    });
});
