import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PdfReadableCompareDemoComponent } from './pdf-readable-compare-demo.component';

describe('PdfReadableCompareDemoComponent', () => {
    function createFixture(): ComponentFixture<PdfReadableCompareDemoComponent> {
        const fixture = TestBed.createComponent(PdfReadableCompareDemoComponent);
        fixture.detectChanges();
        return fixture;
    }

    it('renders the title and the empty state before a file is chosen', () => {
        const fixture = createFixture();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('PDF → Readable HTML');
        expect(el.textContent).toContain('Pick a PDF file');
    });

    it('shows an error for a non-PDF file', async () => {
        const fixture = createFixture();
        const file = new File([new TextEncoder().encode('not a pdf')], 'x.pdf', { type: 'application/pdf' });
        const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [file] });
        input.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 200));
        fixture.detectChanges();

        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Not a valid PDF file.');
    });

    it('renders both panes for a valid PDF', async () => {
        const fixture = createFixture();
        const pdfBody = buildMinimalPdf('Compared content');
        const file = new File([pdfBody], 'ok.pdf', { type: 'application/pdf' });
        const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [file] });
        input.dispatchEvent(new Event('change'));
        await waitUntil(() => (fixture.nativeElement as HTMLElement).textContent?.includes('Compared content') ?? false);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('Readable HTML');
        expect(el.textContent).toContain('Pixel-perfect reference');
        expect(el.textContent).toContain('Compared content');
    });
});

async function waitUntil(predicate: () => boolean, timeout = 5000): Promise<void> {
    const start = Date.now();
    while (!predicate() && Date.now() - start < timeout) {
        await new Promise(resolve => setTimeout(resolve, 25));
    }
}

function buildMinimalPdf(text: string): ArrayBuffer {
    const stream = `BT /F1 12 Tf 100 700 Td (${text}) Tj ET`;
    const objects = [
        { num: 1, content: '<< /Type /Catalog /Pages 2 0 R >>' },
        { num: 2, content: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
        { num: 3, content: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>' },
        { num: 4, content: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream` },
        { num: 5, content: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
    ];
    let body = '%PDF-1.4\n';
    const offsets = new Map<number, number>();
    for (const obj of objects) {
        offsets.set(obj.num, body.length);
        body += `${obj.num} 0 obj\n${obj.content}\nendobj\n`;
    }
    const xrefOffset = body.length;
    const total = objects.length + 1;
    let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) {
        xref += `${String(offsets.get(i) ?? 0).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new TextEncoder().encode(body + xref + trailer).buffer;
}
