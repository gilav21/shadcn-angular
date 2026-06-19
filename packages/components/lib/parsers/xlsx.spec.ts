import { describe, expect, it } from 'vitest';
import { generateXlsx } from './xlsx';
import { readZip } from './zip-reader';
import { parseXlsx } from './xlsx-reader';

const decode = (u: Uint8Array): string => new TextDecoder().decode(u);

describe('generateXlsx', () => {
    it('produces a valid STORED zip with the full OOXML part set', () => {
        const bytes = generateXlsx([['A', 'B'], ['1', '2']]);
        // PK local file header signature.
        expect(bytes[0]).toBe(0x50);
        expect(bytes[1]).toBe(0x4b);
        expect(bytes[2]).toBe(0x03);
        expect(bytes[3]).toBe(0x04);

        const files = readZip(bytes);
        expect([...files.keys()].sort((a, b) => a.localeCompare(b))).toEqual([
            '_rels/.rels',
            '[Content_Types].xml',
            'xl/_rels/workbook.xml.rels',
            'xl/sharedStrings.xml',
            'xl/styles.xml',
            'xl/workbook.xml',
            'xl/worksheets/sheet1.xml',
        ]);
    });

    it('deduplicates shared strings and references them by index in the worksheet', () => {
        const bytes = generateXlsx([
            ['Name', 'Name'],
            ['Alice', 'Name'],
        ]);
        const files = readZip(bytes);

        const ss = decode(files.get('xl/sharedStrings.xml')!);
        // "Name" appears 3 times in data but must be stored once.
        expect(ss).toContain('count="2"');
        expect(ss).toContain('uniqueCount="2"');
        expect(ss).toContain('<si><t>Name</t></si>');
        expect(ss).toContain('<si><t>Alice</t></si>');
        // Only two <si> entries total.
        expect(ss.match(/<si>/g) ?? []).toHaveLength(2);

        const sheet = decode(files.get('xl/worksheets/sheet1.xml')!);
        // First row: both cells reference shared-string index 0 ("Name").
        expect(sheet).toContain('<c r="A1" t="s" s="1"><v>0</v></c>');
        expect(sheet).toContain('<c r="B1" t="s" s="1"><v>0</v></c>');
        // Second row: A2 -> "Alice" (idx 1), B2 -> "Name" (idx 0).
        expect(sheet).toContain('<c r="A2" t="s"><v>1</v></c>');
        expect(sheet).toContain('<c r="B2" t="s"><v>0</v></c>');
    });

    it('applies the bold style to the first row by default and not later rows', () => {
        const bytes = generateXlsx([['Header'], ['body']]);
        const sheet = decode(readZip(bytes).get('xl/worksheets/sheet1.xml')!);
        expect(sheet).toContain('<c r="A1" t="s" s="1"><v>0</v></c>');
        expect(sheet).toContain('<c r="A2" t="s"><v>1</v></c>');
    });

    it('omits the bold style when boldFirstRow is false', () => {
        const bytes = generateXlsx([['Header'], ['body']], { boldFirstRow: false });
        const sheet = decode(readZip(bytes).get('xl/worksheets/sheet1.xml')!);
        expect(sheet).not.toContain('s="1"');
        expect(sheet).toContain('<c r="A1" t="s"><v>0</v></c>');
    });

    it('escapes XML-significant characters in shared strings', () => {
        const bytes = generateXlsx([['a & b < c > d "e" \'f\'']]);
        const ss = decode(readZip(bytes).get('xl/sharedStrings.xml')!);
        expect(ss).toContain('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;');
    });

    it('generates correct column letters past Z (A..Z, AA, AB...)', () => {
        // 28 columns -> last ref must be AB1.
        const wide = Array.from({ length: 28 }, (_, i) => `c${i}`);
        const bytes = generateXlsx([wide]);
        const sheet = decode(readZip(bytes).get('xl/worksheets/sheet1.xml')!);
        expect(sheet).toContain('<c r="Z1"');
        expect(sheet).toContain('<c r="AA1"');
        expect(sheet).toContain('<c r="AB1"');
    });

    it('round-trips through parseXlsx preserving exact cell values', () => {
        const data = [
            ['First Name', 'Last Name', 'City'],
            ['Ada', 'Lovelace', 'London'],
            ['Grace', 'Hopper', 'New York'],
        ];
        const bytes = generateXlsx(data);
        const result = parseXlsx(bytes);

        expect(result.sheets).toHaveLength(1);
        const sheet = result.sheets[0];
        expect(sheet.name).toBe('Sheet1');
        expect(sheet.data).toEqual(data);
        expect(sheet.rowCount).toBe(3);
        expect(sheet.columnCount).toBe(3);
        expect(sheet.mergedCells).toEqual([]);
        expect(result.truncated).toBe(false);
    });

    it('round-trips an empty dataset', () => {
        const bytes = generateXlsx([]);
        const files = readZip(bytes);
        const ss = decode(files.get('xl/sharedStrings.xml')!);
        expect(ss).toContain('count="0"');
        const result = parseXlsx(bytes);
        expect(result.sheets[0].data).toEqual([]);
        expect(result.sheets[0].rowCount).toBe(0);
    });

    it('embeds a stable, non-empty CRC32 per entry that readZip validates', () => {
        // readZip throws on CRC mismatch, so a clean read proves CRCs are correct.
        const bytes = generateXlsx([['x']]);
        expect(() => readZip(bytes)).not.toThrow();
    });
});
