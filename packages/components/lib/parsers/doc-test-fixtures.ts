// Shared test fixtures for legacy .doc (OLE2) parser specs.
// NOT a registry component — pure test scaffolding consumed by the
// doc-parser / doc-enhanced-parser specs.

const SECTOR = 512;
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;

export function writeU16(buf: Uint8Array, off: number, val: number): void {
    buf[off] = val & 0xff;
    buf[off + 1] = (val >> 8) & 0xff;
}

export function writeU32(buf: Uint8Array, off: number, val: number): void {
    buf[off] = val & 0xff;
    buf[off + 1] = (val >> 8) & 0xff;
    buf[off + 2] = (val >> 16) & 0xff;
    buf[off + 3] = (val >>> 24) & 0xff;
}

function sectorByteOffset(sectorIdx: number): number {
    return 512 + sectorIdx * SECTOR;
}

export interface NamedStream {
    readonly name: string;
    readonly data: Uint8Array;
}

function makeHeader(_streamSectorsStart: number): Uint8Array {
    const h = new Uint8Array(SECTOR);
    const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    h.set(magic, 0);
    writeU16(h, 30, 9); // sector size 512
    writeU16(h, 32, 6); // mini sector size 64
    writeU32(h, 44, 1); // fat sectors
    writeU32(h, 48, 1); // first dir sector
    writeU32(h, 56, 0x1000); // mini stream cutoff
    writeU32(h, 60, END_OF_CHAIN); // first mini fat sector
    writeU32(h, 64, 0); // mini fat sectors
    writeU32(h, 68, END_OF_CHAIN); // first difat sector
    writeU32(h, 72, 0); // difat sectors
    writeU32(h, 76, 0); // DIFAT[0] -> FAT in sector 0
    for (let i = 1; i < 109; i++) writeU32(h, 76 + i * 4, FREE_SECTOR);
    return h;
}

function makeDirEntry(name: string, type: number, startSector: number, size: number): Uint8Array {
    const e = new Uint8Array(128);
    let i = 0;
    for (const ch of name) {
        writeU16(e, i * 2, ch.codePointAt(0) ?? 0);
        i++;
    }
    writeU16(e, 64, (name.length + 1) * 2);
    e[66] = type;
    writeU32(e, 116, startSector);
    writeU32(e, 120, size);
    return e;
}

/**
 * Build a minimal OLE2 container that stores each given stream as a
 * contiguous chain of regular (non-mini) sectors. All streams therefore
 * read back through the regular-stream path, which is what the .doc
 * parsers always use for WordDocument / Table / Data streams.
 *
 * Sector layout: 0 = FAT, 1 = directory, 2.. = stream data.
 */
export function buildOle2Doc(streams: ReadonlyArray<NamedStream>): Uint8Array {
    const sectorsPerStream = streams.map(s => Math.max(1, Math.ceil(s.data.length / SECTOR)));
    const totalStreamSectors = sectorsPerStream.reduce((a, b) => a + b, 0);
    const totalSectors = 2 + totalStreamSectors;

    const file = new Uint8Array(512 + totalSectors * SECTOR);
    file.set(makeHeader(2), 0);

    // FAT in sector 0.
    const fat = new Uint8Array(SECTOR);
    for (let i = 0; i < SECTOR / 4; i++) writeU32(fat, i * 4, FREE_SECTOR);
    writeU32(fat, 0, END_OF_CHAIN); // FAT sector
    writeU32(fat, 4, END_OF_CHAIN); // dir sector

    // Directory in sector 1.
    const dir = new Uint8Array(SECTOR);
    // Root entry first.
    dir.set(makeDirEntry('Root Entry', 5, END_OF_CHAIN, 0), 0);

    let nextSector = 2;
    streams.forEach((s, idx) => {
        const startSector = nextSector;
        const nSectors = sectorsPerStream[idx];
        // Thread the FAT chain.
        for (let k = 0; k < nSectors; k++) {
            const cur = startSector + k;
            const next = k + 1 < nSectors ? cur + 1 : END_OF_CHAIN;
            writeU32(fat, cur * 4, next);
        }
        // Write stream bytes.
        file.set(s.data, sectorByteOffset(startSector));
        // Directory entry (slots 1..N after root).
        dir.set(makeDirEntry(s.name, 2, startSector, s.data.length), (idx + 1) * 128);
        nextSector += nSectors;
    });

    file.set(fat, sectorByteOffset(0));
    file.set(dir, sectorByteOffset(1));
    return file;
}

// ── FIB / WordDocument helpers ─────────────────────────────────────────

export interface FibFields {
    nFib?: number;
    fWhichTblStm?: number; // 0 -> 0Table, 1 -> 1Table
    fcMin?: number;
    fcMac?: number;
    ccpText?: number;
    fcClx?: number;
    lcbClx?: number;
    // extended (doc-enhanced)
    fcStshf?: number;
    lcbStshf?: number;
    fcPlcfBteChpx?: number;
    lcbPlcfBteChpx?: number;
    fcPlcfBtePapx?: number;
    lcbPlcfBtePapx?: number;
    fcSttbfFfn?: number;
    lcbSttbfFfn?: number;
}

/**
 * Build a WordDocument stream of `size` bytes with the FIB fields set.
 * Returns the buffer so the caller can also write text at fc offsets.
 */
export function buildWordDocument(size: number, fib: FibFields): Uint8Array {
    const wd = new Uint8Array(size);
    writeU16(wd, 0, 0xa5ec); // wIdent (Word magic)
    writeU16(wd, 2, fib.nFib ?? 0x00c1);
    // flags word at 0x0A; bit 9 = fWhichTblStm
    writeU16(wd, 0x000a, ((fib.fWhichTblStm ?? 0) & 1) << 9);
    const u32Fields: ReadonlyArray<readonly [number, number | undefined]> = [
        [24, fib.fcMin], [28, fib.fcMac], [76, fib.ccpText],
        [0x00a2, fib.fcStshf], [0x00a6, fib.lcbStshf],
        [0x00fa, fib.fcPlcfBteChpx], [0x00fe, fib.lcbPlcfBteChpx],
        [0x0102, fib.fcPlcfBtePapx], [0x0106, fib.lcbPlcfBtePapx],
        [0x010a, fib.fcSttbfFfn], [0x010e, fib.lcbSttbfFfn],
        [0x01a2, fib.fcClx], [0x01a6, fib.lcbClx],
    ];
    for (const [offset, value] of u32Fields) writeU32(wd, offset, value ?? 0);
    return wd;
}

/** Write an ANSI (1 byte/char) string into a buffer at offset. */
export function writeAnsi(buf: Uint8Array, offset: number, text: string): void {
    for (let i = 0; i < text.length; i++) {
        buf[offset + i] = (text.codePointAt(i) ?? 0) & 0xff;
    }
}

/** Write a UTF-16LE (2 bytes/char) string into a buffer at offset. */
export function writeUtf16(buf: Uint8Array, offset: number, text: string): void {
    for (let i = 0; i < text.length; i++) {
        writeU16(buf, offset + i * 2, text.codePointAt(i) ?? 0);
    }
}

export interface PieceSpec {
    readonly cpStart: number;
    readonly cpEnd: number;
    readonly fc: number; // raw file offset into WordDocument
    readonly compressed: boolean;
}

/**
 * Build a CLX structure (just the PCDT, no PRC entries) for the given pieces.
 * cpStart of piece 0 must be 0 and pieces must be contiguous in CP space.
 */
export function buildClx(pieces: ReadonlyArray<PieceSpec>): Uint8Array {
    const pieceCount = pieces.length;
    const plcLen = (pieceCount + 1) * 4 + pieceCount * 8;
    // CLX: marker(1) + len(4) + plc
    const clx = new Uint8Array(1 + 4 + plcLen);
    clx[0] = 0x02; // PCDT marker
    writeU32(clx, 1, plcLen);

    const cpArrayStart = 5;
    // CP array: cpStart of each piece, then final cpEnd.
    for (let i = 0; i < pieceCount; i++) {
        writeU32(clx, cpArrayStart + i * 4, pieces[i].cpStart);
    }
    writeU32(clx, cpArrayStart + pieceCount * 4, pieces[pieceCount - 1].cpEnd);

    const pcdArrayStart = cpArrayStart + (pieceCount + 1) * 4;
    for (let i = 0; i < pieceCount; i++) {
        const p = pieces[i];
        const pcdOff = pcdArrayStart + i * 8;
        // bytes 0-1 = flags (unused here)
        // bytes 2-5 = fc: encode compressed bit + offset
        let fcValue: number;
        if (p.compressed) {
            fcValue = (0x40000000 | (p.fc << 1)) >>> 0;
        } else {
            fcValue = p.fc >>> 0;
        }
        writeU32(clx, pcdOff + 2, fcValue);
        // bytes 6-7 = prm
    }
    return clx;
}

export { END_OF_CHAIN, FREE_SECTOR, SECTOR };
