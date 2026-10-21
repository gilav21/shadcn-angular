import { test, expect } from '@playwright/test';
import { RawPdf, latin1Bytes } from '../../../packages/components/lib/parsers/pdf-test-fixtures';

const HELVETICA = '/Type /Font /Subtype /Type1 /BaseFont /Helvetica';

/**
 * A page that draws a caption and then a form graph: every form draws the next
 * one `fanOut` times, so `depth` levels reach fanOut^(depth-1) leaf draws. The
 * leaves land at distinct positions, so they are real work, not repeats.
 */
function hostileFormGraphPdf(fanOut: number, depth: number): Buffer {
    const firstForm = 10;
    const pdf = new RawPdf()
        .obj(1, '/Type /Catalog /Pages 2 0 R')
        .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
        .obj(3, `/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> /XObject << /L ${firstForm} 0 R >> >> /Contents 4 0 R`)
        .streamObj(4, '', latin1Bytes('BT /F1 14 Tf 72 740 Td (Visible caption) Tj ET q 1 0 0 1 20 100 cm /L Do Q'))
        .obj(7, HELVETICA);
    for (let level = 0; level < depth; level++) {
        const num = firstForm + level;
        const isLeaf = level === depth - 1;
        const resources = isLeaf
            ? '/Font << /F1 7 0 R >>'
            : `/Font << /F1 7 0 R >> /XObject << /L ${num + 1} 0 R >>`;
        const body = isLeaf
            ? 'BT /F1 9 Tf 0 0 Td (Leaf) Tj ET'
            : Array.from({ length: fanOut }, (...[, i]) => `q 1 0 0 1 ${i * 3} ${i * 3} cm /L Do Q`).join(' ');
        pdf.streamObj(num, `/Type /XObject /Subtype /Form /BBox [0 0 10000 10000] /Resources << ${resources} >>`, latin1Bytes(body));
    }
    return Buffer.from(pdf.build());
}

test('file-viewer renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

test('a PDF whose forms fan out exponentially opens, and the page stays responsive', async ({ page }) => {
    await page.goto('/');
    // 3^13 ≈ 1.6 million leaf draws if every path is followed.
    await page.getByTestId('picker').setInputFiles({
        name: 'hostile.pdf',
        mimeType: 'application/pdf',
        buffer: hostileFormGraphPdf(3, 14),
    });

    await expect(page.getByText('Visible caption').first()).toBeVisible({ timeout: 30_000 });

    // A frame can still be produced: the main thread is not stuck in the parse.
    const frameMs = await page.evaluate(
        () => new Promise<number>(resolve => {
            const start = performance.now();
            requestAnimationFrame(() => resolve(performance.now() - start));
        }),
    );
    expect(frameMs).toBeLessThan(1000);
});
