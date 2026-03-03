import { readZip } from './zip-reader';

export interface XlsxSheet {
    readonly name: string;
    readonly data: string[][];
    readonly mergedCells: ReadonlyArray<{ ref: string }>;
    readonly columnCount: number;
    readonly rowCount: number;
}

export interface XlsxParseResult {
    readonly sheets: XlsxSheet[];
    readonly truncated?: boolean;
}

export interface XlsxParseOptions {
    readonly maxRows?: number;
    readonly maxColumns?: number;
}

const DEFAULT_MAX_ROWS = 10000;
const DEFAULT_MAX_COLUMNS = 500;

function parseXml(xmlString: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'application/xml');
}

function getTextContent(element: Element | null): string {
    return element?.textContent ?? '';
}

function parseSharedStrings(files: Map<string, Uint8Array>): string[] {
    const ssFile = files.get('xl/sharedStrings.xml');
    if (!ssFile) return [];

    const doc = parseXml(new TextDecoder().decode(ssFile));
    const siElements = doc.getElementsByTagName('si');
    const strings: string[] = [];

    for (let i = 0; i < siElements.length; i++) {
        const si = siElements[i];
        const tElements = si.getElementsByTagName('t');
        let text = '';
        for (let j = 0; j < tElements.length; j++) {
            text += getTextContent(tElements[j]);
        }
        strings.push(text);
    }

    return strings;
}

interface WorkbookSheetInfo {
    readonly name: string;
    readonly rId: string;
}

function parseWorkbookSheets(files: Map<string, Uint8Array>): WorkbookSheetInfo[] {
    const wbFile = files.get('xl/workbook.xml');
    if (!wbFile) return [{ name: 'Sheet1', rId: 'rId1' }];

    const doc = parseXml(new TextDecoder().decode(wbFile));
    const sheetElements = doc.getElementsByTagName('sheet');
    const sheets: WorkbookSheetInfo[] = [];

    for (let i = 0; i < sheetElements.length; i++) {
        const el = sheetElements[i];
        const name = el.getAttribute('name') ?? `Sheet${i + 1}`;
        const rId = el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
            ?? el.getAttribute('r:id')
            ?? `rId${i + 1}`;
        sheets.push({ name, rId });
    }

    return sheets.length > 0 ? sheets : [{ name: 'Sheet1', rId: 'rId1' }];
}

function parseSheetRelationships(files: Map<string, Uint8Array>): Map<string, string> {
    const relsFile = files.get('xl/_rels/workbook.xml.rels');
    if (!relsFile) return new Map();

    const doc = parseXml(new TextDecoder().decode(relsFile));
    const rels = doc.getElementsByTagName('Relationship');
    const map = new Map<string, string>();

    for (let i = 0; i < rels.length; i++) {
        const id = rels[i].getAttribute('Id') ?? '';
        const target = rels[i].getAttribute('Target') ?? '';
        const relType = rels[i].getAttribute('Type') ?? '';
        if (relType.includes('worksheet') || target.includes('worksheet')) {
            const fullPath = target.startsWith('/') ? target.substring(1) : `xl/${target}`;
            map.set(id, fullPath);
        }
    }

    return map;
}

function parseCellReference(ref: string): { col: number; row: number } {
    let col = 0;
    let i = 0;
    while (i < ref.length && ref[i] >= 'A' && ref[i] <= 'Z') {
        col = col * 26 + (ref.charCodeAt(i) - 64);
        i++;
    }
    const row = Number.parseInt(ref.substring(i), 10);
    return { col: col - 1, row: row - 1 };
}

function getCellValue(cell: Element, sharedStrings: string[]): string {
    const type = cell.getAttribute('t');
    const vElement = cell.getElementsByTagName('v')[0];
    const rawValue = getTextContent(vElement);

    if (type === 's') {
        const idx = Number.parseInt(rawValue, 10);
        return sharedStrings[idx] ?? '';
    }
    if (type === 'b') {
        return rawValue === '1' ? 'TRUE' : 'FALSE';
    }
    if (type === 'inlineStr') {
        const isElement = cell.getElementsByTagName('is')[0];
        if (isElement) {
            const tElements = isElement.getElementsByTagName('t');
            let text = '';
            for (let i = 0; i < tElements.length; i++) {
                text += getTextContent(tElements[i]);
            }
            return text;
        }
        return '';
    }
    if (type === 'str') {
        return rawValue;
    }
    if (type === 'e') {
        return rawValue || '#ERROR';
    }

    if (!type) {
        const fElement = cell.getElementsByTagName('f')[0];
        if (fElement && rawValue) return rawValue;
        if (fElement) return '';
    }

    return rawValue;
}

function parseMergedCells(sheetDoc: Document): Array<{ ref: string }> {
    const mergeCells = sheetDoc.getElementsByTagName('mergeCell');
    const merged: Array<{ ref: string }> = [];
    for (let i = 0; i < mergeCells.length; i++) {
        const ref = mergeCells[i].getAttribute('ref');
        if (ref) merged.push({ ref });
    }
    return merged;
}

function parseSheet(
    sheetData: Uint8Array,
    sharedStrings: string[],
    maxRows: number,
    maxColumns: number,
): { data: string[][]; mergedCells: Array<{ ref: string }>; columnCount: number; rowCount: number } {
    const doc = parseXml(new TextDecoder().decode(sheetData));
    const rows = doc.getElementsByTagName('row');
    const data: string[][] = [];
    let maxCol = 0;

    const rowCount = Math.min(rows.length, maxRows);
    for (let r = 0; r < rowCount; r++) {
        const row = rows[r];
        const rowIndex = Number.parseInt(row.getAttribute('r') ?? `${r + 1}`, 10) - 1;

        while (data.length <= rowIndex) {
            data.push([]);
        }

        const cells = row.getElementsByTagName('c');
        for (let c = 0; c < cells.length; c++) {
            const cell = cells[c];
            const ref = cell.getAttribute('r');
            if (!ref) continue;

            const { col } = parseCellReference(ref);
            if (col >= maxColumns) continue;

            while (data[rowIndex].length <= col) {
                data[rowIndex].push('');
            }
            data[rowIndex][col] = getCellValue(cell, sharedStrings);
            if (col + 1 > maxCol) maxCol = col + 1;
        }
    }

    const mergedCells = parseMergedCells(doc);

    return { data, mergedCells, columnCount: maxCol, rowCount: data.length };
}

function findSheetFiles(files: Map<string, Uint8Array>, sheets: WorkbookSheetInfo[]): Uint8Array[] {
    const rels = parseSheetRelationships(files);
    const sheetFiles: Uint8Array[] = [];

    for (let i = 0; i < sheets.length; i++) {
        const relPath = rels.get(sheets[i].rId);
        const directPath = `xl/worksheets/sheet${i + 1}.xml`;
        const sheetData = (relPath ? files.get(relPath) : undefined) ?? files.get(directPath);
        if (sheetData) {
            sheetFiles.push(sheetData);
        }
    }

    if (sheetFiles.length === 0) {
        for (const [path, data] of files) {
            if (path.startsWith('xl/worksheets/sheet') && path.endsWith('.xml')) {
                sheetFiles.push(data);
            }
        }
    }

    return sheetFiles;
}

export function parseXlsx(data: Uint8Array, options?: XlsxParseOptions): XlsxParseResult {
    const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
    const maxColumns = options?.maxColumns ?? DEFAULT_MAX_COLUMNS;

    const files = readZip(data);
    const sharedStrings = parseSharedStrings(files);
    const workbookSheets = parseWorkbookSheets(files);
    const sheetFiles = findSheetFiles(files, workbookSheets);

    const sheets: XlsxSheet[] = [];
    for (let i = 0; i < sheetFiles.length; i++) {
        const result = parseSheet(sheetFiles[i], sharedStrings, maxRows, maxColumns);
        sheets.push({
            name: workbookSheets[i]?.name ?? `Sheet${i + 1}`,
            data: result.data,
            mergedCells: result.mergedCells,
            columnCount: result.columnCount,
            rowCount: result.rowCount,
        });
    }

    const truncated = sheets.some(s => s.rowCount >= maxRows);
    return { sheets, truncated };
}
