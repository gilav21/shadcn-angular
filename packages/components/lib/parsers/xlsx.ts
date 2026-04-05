const encoder = new TextEncoder();

function makeCrc32Table(): Uint32Array {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c;
  }
  return t;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function columnLetter(col: number): string {
  let s = '';
  let c = col;
  while (c >= 0) {
    s = String.fromCodePoint(65 + (c % 26)) + s;
    c = Math.floor(c / 26) - 1;
  }
  return s;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
}

function relsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function workbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="2">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="1">
<border><left/><right/><top/><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;
}

function sharedStringsXml(strings: string[]): string {
  const items = strings.map(s => `<si><t>${escapeXml(s)}</t></si>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${items}</sst>`;
}

function worksheetXml(data: string[][], stringMap: Map<string, number>, boldFirstRow: boolean): string {
  const rows: string[] = [];
  for (let r = 0; r < data.length; r++) {
    const cells: string[] = [];
    for (let c = 0; c < data[r].length; c++) {
      const ref = columnLetter(c) + (r + 1);
      const idx = stringMap.get(data[r][c]);
      const style = boldFirstRow && r === 0 ? ' s="1"' : '';
      cells.push(`<c r="${ref}" t="s"${style}><v>${idx}</v></c>`);
    }
    rows.push(`<row r="${r + 1}">${cells.join('')}</row>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rows.join('')}</sheetData>
</worksheet>`;
}

function writeU16(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
}

function writeU32(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
  buf[offset + 2] = (val >> 16) & 0xff;
  buf[offset + 3] = (val >> 24) & 0xff;
}

function createZip(files: { path: string; content: Uint8Array }[]): Uint8Array {
  const entries: { path: Uint8Array; content: Uint8Array; crc: number; offset: number }[] = [];

  let totalSize = 0;
  for (const f of files) {
    const pathBytes = encoder.encode(f.path);
    totalSize += 30 + pathBytes.length + f.content.length;
    entries.push({ path: pathBytes, content: f.content, crc: crc32(f.content), offset: 0 });
  }

  let centralDirSize = 0;
  for (const e of entries) {
    centralDirSize += 46 + e.path.length;
  }

  const buf = new Uint8Array(totalSize + centralDirSize + 22);
  let pos = 0;

  for (const e of entries) {
    e.offset = pos;
    // Local file header
    writeU32(buf, pos, 0x04034b50); pos += 4;
    writeU16(buf, pos, 20); pos += 2; // version needed
    writeU16(buf, pos, 0); pos += 2;  // flags
    writeU16(buf, pos, 0); pos += 2;  // compression: STORE
    writeU16(buf, pos, 0); pos += 2;  // mod time
    writeU16(buf, pos, 0); pos += 2;  // mod date
    writeU32(buf, pos, e.crc); pos += 4;
    writeU32(buf, pos, e.content.length); pos += 4; // compressed size
    writeU32(buf, pos, e.content.length); pos += 4; // uncompressed size
    writeU16(buf, pos, e.path.length); pos += 2;
    writeU16(buf, pos, 0); pos += 2; // extra field length
    buf.set(e.path, pos); pos += e.path.length;
    buf.set(e.content, pos); pos += e.content.length;
  }

  const centralDirOffset = pos;

  for (const e of entries) {
    // Central directory header
    writeU32(buf, pos, 0x02014b50); pos += 4;
    writeU16(buf, pos, 20); pos += 2; // version made by
    writeU16(buf, pos, 20); pos += 2; // version needed
    writeU16(buf, pos, 0); pos += 2;  // flags
    writeU16(buf, pos, 0); pos += 2;  // compression
    writeU16(buf, pos, 0); pos += 2;  // mod time
    writeU16(buf, pos, 0); pos += 2;  // mod date
    writeU32(buf, pos, e.crc); pos += 4;
    writeU32(buf, pos, e.content.length); pos += 4;
    writeU32(buf, pos, e.content.length); pos += 4;
    writeU16(buf, pos, e.path.length); pos += 2;
    writeU16(buf, pos, 0); pos += 2; // extra field length
    writeU16(buf, pos, 0); pos += 2; // comment length
    writeU16(buf, pos, 0); pos += 2; // disk number
    writeU16(buf, pos, 0); pos += 2; // internal attrs
    writeU32(buf, pos, 0); pos += 4;  // external attrs
    writeU32(buf, pos, e.offset); pos += 4;
    buf.set(e.path, pos); pos += e.path.length;
  }

  // End of central directory
  writeU32(buf, pos, 0x06054b50); pos += 4;
  writeU16(buf, pos, 0); pos += 2; // disk number
  writeU16(buf, pos, 0); pos += 2; // disk with central dir
  writeU16(buf, pos, entries.length); pos += 2;
  writeU16(buf, pos, entries.length); pos += 2;
  writeU32(buf, pos, centralDirSize); pos += 4;
  writeU32(buf, pos, centralDirOffset); pos += 4;
  writeU16(buf, pos, 0); // comment length

  return buf;
}

export function generateXlsx(data: string[][], options?: { boldFirstRow?: boolean }): Uint8Array {
  const boldFirstRow = options?.boldFirstRow !== false;

  const uniqueStrings: string[] = [];
  const stringMap = new Map<string, number>();
  for (const row of data) {
    for (const cell of row) {
      if (!stringMap.has(cell)) {
        stringMap.set(cell, uniqueStrings.length);
        uniqueStrings.push(cell);
      }
    }
  }

  const files = [
    { path: '[Content_Types].xml', content: encoder.encode(contentTypesXml()) },
    { path: '_rels/.rels', content: encoder.encode(relsXml()) },
    { path: 'xl/workbook.xml', content: encoder.encode(workbookXml()) },
    { path: 'xl/_rels/workbook.xml.rels', content: encoder.encode(workbookRelsXml()) },
    { path: 'xl/styles.xml', content: encoder.encode(stylesXml()) },
    { path: 'xl/sharedStrings.xml', content: encoder.encode(sharedStringsXml(uniqueStrings)) },
    { path: 'xl/worksheets/sheet1.xml', content: encoder.encode(worksheetXml(data, stringMap, boldFirstRow)) },
  ];

  return createZip(files);
}
