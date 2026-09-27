import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { FileViewerComponent } from './file-viewer.component';

/**
 * Browser-only file-viewer cases: scroll positions need real layout (jsdom
 * never overflows, so scrollTop stays 0 whatever the code does).
 */
interface PagedInternals {
    pdfPages: { set(v: ReadonlyArray<{ html: string }>): void };
    pdfGlobalCss: { set(v: string): void };
    pptxSlides: { set(v: ReadonlyArray<{ html: string; width: number; height: number }>): void };
}

function scrollRegions(host: HTMLElement): { content: HTMLElement; inner: HTMLElement | null } {
    const content: HTMLElement = host.querySelector('[data-slot="file-viewer-content"]')!;
    return { content, inner: content.querySelector('.overflow-auto') };
}

describe('FileViewerComponent (browser)', () => {
    it('scrolls the content region back to the top on page change', () => {
        const fixture = TestBed.createComponent(FileViewerComponent);
        const component = fixture.componentInstance;
        const api = component as unknown as PagedInternals;
        fixture.detectChanges();

        // PDF: the page scrolls inside the region's own .overflow-auto child.
        component.state.set('loaded');
        component.detectedType.set('pdf');
        api.pdfPages.set([{ html: '<div style="height:3000px">a</div>' }, { html: '<div style="height:3000px">b</div>' }]);
        api.pdfGlobalCss.set('');
        component.totalPages.set(2);
        component.currentPage.set(1);
        fixture.detectChanges();
        const pdf = scrollRegions(fixture.nativeElement);
        pdf.inner!.scrollTop = 500;
        expect(pdf.inner!.scrollTop).toBe(500);
        component.nextPage();
        expect(pdf.inner!.scrollTop).toBe(0);

        // PPTX: a tall slide overflows the content region itself.
        component.detectedType.set('pptx');
        api.pptxSlides.set([
            { html: '<p>s1</p>', width: 400, height: 3000 },
            { html: '<p>s2</p>', width: 400, height: 3000 },
        ]);
        component.currentPage.set(1);
        fixture.detectChanges();
        const pptx = scrollRegions(fixture.nativeElement);
        pptx.content.scrollTop = 500;
        expect(pptx.content.scrollTop).toBe(500);
        component.nextPage();
        expect(pptx.content.scrollTop).toBe(0);
    });
});

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

describe('FileViewerComponent toolbar (browser)', () => {
    afterEach(() => emulateTouch(false));

    async function toolbarControlRects(): Promise<DOMRect[]> {
        const fixture = TestBed.createComponent(FileViewerComponent);
        const component = fixture.componentInstance;
        fixture.componentRef.setInput('filename', 'quarterly-report.pdf');
        fixture.detectChanges();
        component.state.set('loaded');
        component.detectedType.set('pdf');
        (component as unknown as PagedInternals).pdfPages.set([{ html: '<p>one</p>' }, { html: '<p>two</p>' }]);
        component.downloadUrl.set('data:application/pdf;base64,');
        fixture.detectChanges();
        await fixture.whenStable();
        const toolbar = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="file-viewer-toolbar"]')!;
        const rects = ['Previous page', 'Next page', 'Zoom out', 'Zoom in']
            .map((label) => toolbar.querySelector(`button[aria-label="${label}"]`)!)
            .concat(toolbar.querySelector('a[title="Download"]')!)
            .map((control) => control.getBoundingClientRect());
        fixture.destroy();
        return rects;
    }

    /** WCAG 2.5.8: every toolbar control, the download link included, is a 44x44 target on a touch screen and stays 28x28 for a mouse. */
    it('grows every toolbar control to a 44x44 touch target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await toolbarControlRects();
        await emulateTouch(true);
        const coarse = await toolbarControlRects();

        expect(fine.map((r) => [r.width, r.height])).toEqual(new Array(5).fill([28, 28]));
        for (const r of coarse) {
            expect(r.width).toBeGreaterThanOrEqual(44);
            expect(r.height).toBeGreaterThanOrEqual(44);
        }
    });
});
