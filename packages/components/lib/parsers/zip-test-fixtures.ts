// Shared test fixture: a minimal STORED (uncompressed) ZIP writer — local
// file headers, central directory, end-of-central-directory record, with real
// CRC-32s (zip-reader validates them). NOT a registry component; test
// scaffolding for the OOXML (pptx/xlsx/docx) parser specs.

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): number[] {
    return [n & 0xff, (n >>> 8) & 0xff];
}

function u32(n: number): number[] {
    return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

export interface ZipFixtureFile {
    readonly path: string;
    readonly content: string | Uint8Array;
}

/** Builds a ZIP archive storing each file uncompressed, in the given order. */
export function buildStoredZip(files: ReadonlyArray<ZipFixtureFile>): Uint8Array {
    const enc = new TextEncoder();
    const local: number[] = [];
    const central: number[] = [];
    for (const file of files) {
        const name = enc.encode(file.path);
        const data = typeof file.content === 'string' ? enc.encode(file.content) : file.content;
        const crc = crc32(data);
        const offset = local.length;
        // version 20, no flags, method 0 (stored), zero time/date
        const common = [...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
        local.push(...u32(0x04034b50), ...common, ...name, ...data);
        central.push(...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name);
    }
    const eocd = [
        ...u32(0x06054b50), ...u16(0), ...u16(0),
        ...u16(files.length), ...u16(files.length),
        ...u32(central.length), ...u32(local.length), ...u16(0),
    ];
    return new Uint8Array([...local, ...central, ...eocd]);
}
