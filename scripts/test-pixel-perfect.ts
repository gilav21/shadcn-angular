/**
 * Generate a pixel-perfect HTML from a PDF file for visual comparison.
 *
 * Usage:
 *   npx tsx scripts/test-pixel-perfect.ts <pdf-path> [output-path]
 *
 * Example:
 *   npx tsx scripts/test-pixel-perfect.ts demo/public/DW2-3-Viruses-www.underwar.co.il.pdf D:/tmp/pixel-perfect.html
 *
 * Then open the output HTML in your browser and compare side-by-side
 * with the pdf2htmlEX output at localhost:8888.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { renderPixelPerfectPaged, toStandaloneHtml, setFallbackFontData } from '../packages/components/lib/parsers/pdf-pixel-perfect';

// Load fallback font for missing glyph coverage
const fallbackPaths = [
    resolve(dirname(new URL(import.meta.url).pathname), '..', 'packages', 'components', 'lib', 'fonts', 'NotoSans-Regular.ttf'),
    resolve(process.cwd(), 'packages', 'components', 'lib', 'fonts', 'NotoSans-Regular.ttf'),
];
for (const fp of fallbackPaths) {
    const cleanPath = fp.replace(/^\/([A-Z]:)/, '$1'); // Fix Windows drive letter
    if (existsSync(cleanPath)) {
        const data = readFileSync(cleanPath);
        setFallbackFontData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        console.log('Fallback font loaded:', cleanPath);
        break;
    }
}

async function main(): Promise<void> {
    const pdfPath = process.argv[2];
    if (!pdfPath) {
        console.error('Usage: npx tsx scripts/test-pixel-perfect.ts <pdf-path> [output-path]');
        process.exit(1);
    }

    const outputPath = process.argv[3] ?? pdfPath.replace(/\.pdf$/i, '.pixel-perfect.html');

    console.log(`Reading: ${pdfPath}`);
    const pdfBuffer = readFileSync(resolve(pdfPath));

    console.log('Rendering...');
    const result = await renderPixelPerfectPaged(pdfBuffer.buffer);

    console.log(`Pages: ${result.totalPages}`);
    for (const page of result.pages) {
        console.log(`  Page ${page.pageIndex + 1}: ${page.pageWidth}x${page.pageHeight}, text: ${page.text.length} chars`);
    }
    console.log(`CSS classes: ${result.globalCss.length} bytes`);

    const html = toStandaloneHtml(result);
    writeFileSync(resolve(outputPath), html, 'utf-8');
    console.log(`\nWritten: ${outputPath} (${(html.length / 1024).toFixed(1)} KB)`);
    console.log('Open it in your browser to compare with the pdf2htmlEX output.');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
