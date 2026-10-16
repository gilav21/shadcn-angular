/**
 * Generate a pixel-perfect HTML from a PDF file for visual comparison.
 *
 * Usage:
 *   npx tsx scripts/test-pixel-perfect.ts <pdf-path> [output-path]
 *
 * Example:
 *   npm run pdf:pixel-perfect -- demo/public/examples/invoice.pdf D:/tmp/pixel-perfect.html
 *
 * Then open the output HTML in your browser and compare side-by-side
 * with the pdf2htmlEX output at localhost:8888.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPixelPerfectPaged, toStandaloneHtml, setFallbackFontData } from '../packages/components/lib/parsers/pdf-pixel-perfect';

/** Where the fallback font for missing glyph coverage may live, most specific first. */
export function fontCandidates(repoRoot: string): string[] {
    return [
        resolve(repoRoot, 'packages', 'components', 'lib', 'parsers', 'fonts', 'NotoSans-Regular.ttf'),
        resolve(process.cwd(), 'packages', 'components', 'lib', 'parsers', 'fonts', 'NotoSans-Regular.ttf'),
    ];
}

function loadFallbackFont(): void {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    for (const fontPath of fontCandidates(repoRoot)) {
        if (existsSync(fontPath)) {
            const data = readFileSync(fontPath);
            setFallbackFontData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
            console.log('Fallback font loaded:', fontPath);
            return;
        }
    }
}

async function main(): Promise<void> {
    loadFallbackFont();
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

// Case-insensitive: Windows may hand argv[1] a lower-case drive letter, and a
// mismatch here would make the script exit 0 without doing anything.
const invokedDirectly = process.argv[1] !== undefined
    && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (invokedDirectly) {
    main().catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
    });
}
