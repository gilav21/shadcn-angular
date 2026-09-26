import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
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
