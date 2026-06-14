import { describe, expect, it } from 'vitest';
import { readOle2 } from './ole2-reader';

// ── OLE2 / Compound File Binary fixture builder ────────────────────────
//
// Layout produced by `buildOle2` (512-byte sectors):
//   sector -1 : the 512-byte header (bytes 0..511)
//   sector  0 : FAT
//   sector  1 : directory entries
//   sector  2.. : stream / mini-stream / mini-FAT data as configured
//
// All multi-byte integers are little-endian, matching the reader.

const SECTOR = 512;
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;
const MINI_STREAM_CUTOFF = 0x1000;

interface StreamSpec {
    readonly name: string;
    readonly type: number; // 2 = stream, 5 = root storage, 1 = storage
    readonly data?: Uint8Array;
    readonly startSector: number;
    readonly size: number;
}

function writeU16(buf: Uint8Array, off: number, val: number): void {
    buf[off] = val & 0xff;
    buf[off + 1] = (val >> 8) & 0xff;
}

function writeU32(buf: Uint8Array, off: number, val: number): void {
    buf[off] = val & 0xff;
    buf[off + 1] = (val >> 8) & 0xff;
    buf[off + 2] = (val >> 16) & 0xff;
    buf[off + 3] = (val >>> 24) & 0xff;
}

function sectorByteOffset(sectorIdx: number): number {
    return 512 + sectorIdx * SECTOR;
}

function makeHeader(opts: {
    firstDirSector: number;
    fatSectors: number;
    firstMiniFatSector: number;
    miniFatSectors: number;
    sectorPower?: number;
    miniSectorPower?: number;
    miniCutoff?: number;
    badMagic?: boolean;
}): Uint8Array {
    const h = new Uint8Array(SECTOR);
    const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    for (let i = 0; i < magic.length; i++) {
        h[i] = opts.badMagic ? 0 : magic[i];
    }
    writeU16(h, 30, opts.sectorPower ?? 9); // 1<<9 = 512
    writeU16(h, 32, opts.miniSectorPower ?? 6); // 1<<6 = 64
    writeU32(h, 44, opts.fatSectors);
    writeU32(h, 48, opts.firstDirSector);
    writeU32(h, 56, opts.miniCutoff ?? MINI_STREAM_CUTOFF);
    writeU32(h, 60, opts.firstMiniFatSector);
    writeU32(h, 64, opts.miniFatSectors);
    writeU32(h, 68, END_OF_CHAIN); // firstDifatSector
    writeU32(h, 72, 0); // difatSectors
    // DIFAT[0] = 0 (FAT lives in sector 0); rest free.
    writeU32(h, 76, 0);
    for (let i = 1; i < 109; i++) {
        writeU32(h, 76 + i * 4, FREE_SECTOR);
    }
    return h;
}

function makeDirEntry(spec: { name: string; type: number; startSector: number; size: number }): Uint8Array {
    const e = new Uint8Array(128);
    let i = 0;
    for (const ch of spec.name) {
        writeU16(e, i * 2, ch.codePointAt(0) ?? 0);
        i++;
    }
    const nameLen = (spec.name.length + 1) * 2; // includes terminating null
    writeU16(e, 64, nameLen);
    e[66] = spec.type;
    writeU32(e, 116, spec.startSector);
    writeU32(e, 120, spec.size);
    return e;
}

/**
 * Build a complete OLE2 container in memory.
 * - FAT lives in sector 0, directory in sector 1.
 * - Each stream gets its own contiguous chain of full sectors starting at
 *   sector 2 (regular streams) — caller can also pass pre-positioned specs.
 */
function buildContainer(params: {
    streams: ReadonlyArray<StreamSpec>;
    fatChains: ReadonlyArray<ReadonlyArray<number>>; // chains to thread through the FAT
    firstMiniFatSector?: number;
    miniFatSectors?: number;
    miniFatChain?: ReadonlyArray<number>;
    totalSectors: number;
    badMagic?: boolean;
    sectorPower?: number;
}): Uint8Array {
    const total = params.totalSectors;
    const file = new Uint8Array(512 + total * SECTOR);

    const header = makeHeader({
        firstDirSector: 1,
        fatSectors: 1,
        firstMiniFatSector: params.firstMiniFatSector ?? END_OF_CHAIN,
        miniFatSectors: params.miniFatSectors ?? 0,
        badMagic: params.badMagic,
        sectorPower: params.sectorPower,
    });
    file.set(header, 0);

    file.set(buildFat(params.fatChains, params.miniFatChain), sectorByteOffset(0));

    // Directory in sector 1 (4 entries per 512-byte sector).
    const dir = new Uint8Array(SECTOR);
    params.streams.forEach((s, idx) => {
        const entry = makeDirEntry({ name: s.name, type: s.type, startSector: s.startSector, size: s.size });
        dir.set(entry, idx * 128);
    });
    file.set(dir, sectorByteOffset(1));

    writeStreams(file, params.streams);

    return file;
}

/** Threads one sector chain through the FAT (each link points to the next). */
function threadChain(fat: Uint8Array, chain: ReadonlyArray<number>): void {
    for (let k = 0; k < chain.length; k++) {
        const next = k + 1 < chain.length ? chain[k + 1] : END_OF_CHAIN;
        writeU32(fat, chain[k] * 4, next);
    }
}

/** Builds the FAT (sector 0): reserves FAT+dir sectors, threads all chains. */
function buildFat(
    fatChains: ReadonlyArray<ReadonlyArray<number>>,
    miniFatChain?: ReadonlyArray<number>,
): Uint8Array {
    const entriesPerSector = SECTOR / 4;
    const fat = new Uint8Array(SECTOR);
    for (let i = 0; i < entriesPerSector; i++) {
        writeU32(fat, i * 4, FREE_SECTOR);
    }
    writeU32(fat, 0 * 4, END_OF_CHAIN); // FAT sector itself
    writeU32(fat, 1 * 4, END_OF_CHAIN); // directory sector
    for (const chain of fatChains) threadChain(fat, chain);
    if (miniFatChain) threadChain(fat, miniFatChain);
    return fat;
}

/** Writes each regular stream's bytes at its starting sector (contiguous chains). */
function writeStreams(file: Uint8Array, streams: ReadonlyArray<StreamSpec>): void {
    for (const s of streams) {
        if (s.type === 5) continue; // root mini-stream written separately by caller via data placement
        if (s.startSector === END_OF_CHAIN) continue;
        if (!s.data) continue; // caller places bytes manually
        file.set(s.data, sectorByteOffset(s.startSector));
    }
}

describe('readOle2 — header validation', () => {
    it('throws when file is smaller than the 512-byte header', () => {
        expect(() => readOle2(new Uint8Array(100))).toThrow(/file too small/);
    });

    it('throws on an invalid magic signature', () => {
        const file = buildContainer({
            streams: [{ name: 'X', type: 2, startSector: 2, size: 4 }],
            fatChains: [[2]],
            totalSectors: 3,
            badMagic: true,
        });
        expect(() => readOle2(file)).toThrow(/invalid magic/);
    });
});

describe('readOle2 — regular streams', () => {
    it('parses directory entries and reads regular (non-mini) stream bytes', () => {
        // A stream large enough to bypass the mini-stream path (>= cutoff).
        const bigSize = MINI_STREAM_CUTOFF + 8;
        const payload = new Uint8Array(bigSize);
        for (let i = 0; i < bigSize; i++) payload[i] = i & 0xff;

        // Needs ceil(4104/512) = 9 sectors: 2..10.
        const chain = [2, 3, 4, 5, 6, 7, 8, 9, 10];

        const file = buildContainer({
            streams: [
                { name: 'Root Entry', type: 5, startSector: END_OF_CHAIN, size: 0 },
                { name: 'WordDocument', type: 2, startSector: 2, size: bigSize },
            ],
            fatChains: [chain],
            totalSectors: 11,
        });
        // Place the payload across its 9-sector contiguous chain (2..10).
        for (let s = 0; s < chain.length; s++) {
            const slice = payload.subarray(s * SECTOR, (s + 1) * SECTOR);
            file.set(slice, sectorByteOffset(chain[s]));
        }

        const ole = readOle2(file);

        // Directory entries: names + types decoded correctly.
        expect(ole.entries.map(e => e.name)).toEqual(['Root Entry', 'WordDocument']);
        const root = ole.entries.find(e => e.name === 'Root Entry');
        expect(root?.type).toBe(5);
        const wd = ole.entries.find(e => e.name === 'WordDocument');
        expect(wd?.type).toBe(2);
        expect(wd?.startSector).toBe(2);
        expect(wd?.size).toBe(bigSize);

        // Stream bytes match the payload exactly (truncated to declared size).
        const stream = ole.streams.get('WordDocument');
        expect(stream).toBeInstanceOf(Uint8Array);
        expect(stream?.length).toBe(bigSize);
        expect(Array.from(stream!.subarray(0, 4))).toEqual([0, 1, 2, 3]);
        expect(stream![bigSize - 1]).toBe((bigSize - 1) & 0xff);
    });

    it('follows a multi-sector FAT chain in declared order', () => {
        const bigSize = SECTOR + 16; // spans 2 sectors
        const payload = new Uint8Array(bigSize);
        payload.fill(0xaa, 0, SECTOR);
        payload.fill(0xbb, SECTOR);

        // Non-contiguous chain: sector 2 then sector 4.
        const file = buildContainer({
            streams: [
                { name: 'Root Entry', type: 5, startSector: END_OF_CHAIN, size: 0 },
                { name: 'Stream', type: 2, startSector: 2, size: bigSize },
            ],
            fatChains: [[2, 4]],
            totalSectors: 5,
        });
        // Place the two halves at sectors 2 and 4 manually.
        file.set(payload.subarray(0, SECTOR), sectorByteOffset(2));
        file.set(payload.subarray(SECTOR), sectorByteOffset(4));

        const ole = readOle2(file);
        const stream = ole.streams.get('Stream')!;
        expect(stream.length).toBe(bigSize);
        expect(stream[0]).toBe(0xaa);
        expect(stream[SECTOR - 1]).toBe(0xaa);
        expect(stream[SECTOR]).toBe(0xbb);
        expect(stream[bigSize - 1]).toBe(0xbb);
    });

    it('returns an empty stream for a zero-size directory entry', () => {
        const file = buildContainer({
            streams: [
                { name: 'Root Entry', type: 5, startSector: END_OF_CHAIN, size: 0 },
                { name: 'Empty', type: 2, startSector: END_OF_CHAIN, size: 0 },
            ],
            fatChains: [],
            totalSectors: 2,
        });
        const ole = readOle2(file);
        const empty = ole.streams.get('Empty');
        expect(empty).toBeInstanceOf(Uint8Array);
        expect(empty?.length).toBe(0);
    });

    it('ignores storage entries (type 1) when building the streams map', () => {
        const file = buildContainer({
            streams: [
                { name: 'Root Entry', type: 5, startSector: END_OF_CHAIN, size: 0 },
                { name: 'SubStorage', type: 1, startSector: END_OF_CHAIN, size: 0 },
            ],
            fatChains: [],
            totalSectors: 2,
        });
        const ole = readOle2(file);
        expect(ole.entries.some(e => e.name === 'SubStorage' && e.type === 1)).toBe(true);
        expect(ole.streams.has('SubStorage')).toBe(false);
    });
});

describe('readOle2 — mini streams', () => {
    it('reads a small stream through the mini-FAT / mini-stream path', () => {
        // Mini sector size = 64. Small stream of 100 bytes => 2 mini-sectors (0,1).
        const miniSectorSize = 64;
        const smallSize = 100;
        const small = new Uint8Array(smallSize);
        for (let i = 0; i < smallSize; i++) small[i] = (i + 1) & 0xff;

        // Root mini-stream container holds the small stream's mini-sectors
        // contiguously: mini-sector 0 (bytes 0..63), mini-sector 1 (64..127).
        const miniStreamBytes = new Uint8Array(2 * miniSectorSize);
        miniStreamBytes.set(small.subarray(0, miniSectorSize), 0);
        miniStreamBytes.set(small.subarray(miniSectorSize), miniSectorSize);

        // Mini-FAT: entry0 -> 1, entry1 -> END_OF_CHAIN.
        const miniFat = new Uint8Array(SECTOR);
        for (let i = 0; i < SECTOR / 4; i++) writeU32(miniFat, i * 4, FREE_SECTOR);
        writeU32(miniFat, 0, 1);
        writeU32(miniFat, 4, END_OF_CHAIN);

        // Sector layout:
        //   2: root mini-stream data (the mini-stream container)
        //   3: mini-FAT
        const rootStreamSector = 2;
        const miniFatSector = 3;

        const file = buildContainer({
            streams: [
                { name: 'Root Entry', type: 5, startSector: rootStreamSector, size: miniStreamBytes.length },
                { name: 'CompObj', type: 2, startSector: 0, size: smallSize },
            ],
            fatChains: [[rootStreamSector], [miniFatSector]],
            firstMiniFatSector: miniFatSector,
            miniFatSectors: 1,
            totalSectors: 4,
        });
        // Root mini-stream bytes at sector 2.
        file.set(miniStreamBytes, sectorByteOffset(rootStreamSector));
        // Mini-FAT at sector 3.
        file.set(miniFat, sectorByteOffset(miniFatSector));

        const ole = readOle2(file);
        const stream = ole.streams.get('CompObj')!;
        expect(stream.length).toBe(smallSize);
        expect(stream[0]).toBe(1);
        expect(stream[63]).toBe(64);
        expect(stream[64]).toBe(65);
        expect(stream[smallSize - 1]).toBe(smallSize & 0xff);
    });

    it('stops a mini-stream chain when the next index exceeds the mini-FAT', () => {
        // Stream of 200 bytes => wants 4 mini-sectors, but the mini-FAT only
        // covers index 0 (-> 1) and index 1 (-> out-of-range). The reader must
        // break once `current` exceeds the mini-FAT length without throwing.
        const miniSectorSize = 64;
        const smallSize = 200;
        const miniStreamBytes = new Uint8Array(4 * miniSectorSize);
        for (let i = 0; i < miniStreamBytes.length; i++) miniStreamBytes[i] = i & 0xff;

        // mini-FAT (1 sector) but we only define 2 entries; entry1 points at a
        // huge index beyond miniFat.length so the loop hits the else-break.
        const miniFat = new Uint8Array(SECTOR);
        for (let i = 0; i < SECTOR / 4; i++) writeU32(miniFat, i * 4, FREE_SECTOR);
        writeU32(miniFat, 0, 1);
        writeU32(miniFat, 4, 999_999); // beyond miniFat.length -> break path

        const rootStreamSector = 2;
        const miniFatSector = 3;
        const file = buildContainer({
            streams: [
                { name: 'Root Entry', type: 5, startSector: rootStreamSector, size: miniStreamBytes.length },
                { name: 'Tiny', type: 2, startSector: 0, size: smallSize },
            ],
            fatChains: [[rootStreamSector], [miniFatSector]],
            firstMiniFatSector: miniFatSector,
            miniFatSectors: 1,
            totalSectors: 4,
        });
        file.set(miniStreamBytes, sectorByteOffset(rootStreamSector));
        file.set(miniFat, sectorByteOffset(miniFatSector));

        const ole = readOle2(file);
        const tiny = ole.streams.get('Tiny')!;
        // Result buffer is sized to `size` (200) even though the chain stops
        // early: first two mini-sectors (128 bytes) carry real data.
        expect(tiny.length).toBe(smallSize);
        expect(tiny[0]).toBe(0);
        expect(tiny[64]).toBe(64); // mini-sector index 1 follows index 0
    });

    it('falls back to the regular stream path when no mini-FAT exists', () => {
        // Small stream but miniFat empty -> readRegularStream is used instead.
        const smallSize = 50;
        const small = new Uint8Array(smallSize);
        small.fill(0x7f);

        const file = buildContainer({
            streams: [
                { name: 'Root Entry', type: 5, startSector: END_OF_CHAIN, size: 0 },
                { name: 'Small', type: 2, startSector: 2, size: smallSize },
            ],
            fatChains: [[2]],
            totalSectors: 3,
        });
        file.set(small, sectorByteOffset(2));

        const ole = readOle2(file);
        const stream = ole.streams.get('Small')!;
        expect(stream.length).toBe(smallSize);
        expect(stream[0]).toBe(0x7f);
        expect(stream[smallSize - 1]).toBe(0x7f);
    });
});

describe('readOle2 — DIFAT extension & FAT edge cases', () => {
    it('reads FAT-sector pointers from a DIFAT extension sector (>109 FAT sectors)', () => {
        // We declare 110 FAT sectors so the reader must follow the DIFAT chain
        // for entry #109. Only FAT sector 0 carries real chain data; the rest
        // are marked FREE in the DIFAT so buildFat skips them.
        const fatSectorCount = 110;
        // Layout:
        //   sector 0   : real FAT (holds the stream chain)
        //   sector 1   : directory
        //   sector 2   : the stream payload
        //   sector 3   : DIFAT extension sector
        const difatExtSector = 3;
        const totalSectors = 4;
        const file = new Uint8Array(512 + totalSectors * SECTOR);

        const header = makeHeader({
            firstDirSector: 1,
            fatSectors: fatSectorCount,
            firstMiniFatSector: END_OF_CHAIN,
            miniFatSectors: 0,
        });
        // First 109 DIFAT entries live in the header. Entry 0 -> FAT sector 0,
        // entries 1..108 -> FREE (skipped). firstDifatSector -> ext sector.
        writeU32(header, 68, difatExtSector);
        writeU32(header, 72, 1);
        file.set(header, 0);

        // Real FAT in sector 0: thread stream chain [2].
        const fat = new Uint8Array(SECTOR);
        for (let i = 0; i < SECTOR / 4; i++) writeU32(fat, i * 4, FREE_SECTOR);
        writeU32(fat, 0 * 4, END_OF_CHAIN);
        writeU32(fat, 1 * 4, END_OF_CHAIN);
        writeU32(fat, 2 * 4, END_OF_CHAIN); // stream payload sector
        writeU32(fat, 3 * 4, END_OF_CHAIN); // difat ext sector
        file.set(fat, sectorByteOffset(0));

        // Directory in sector 1.
        const dir = new Uint8Array(SECTOR);
        dir.set(makeDirEntry({ name: 'Root Entry', type: 5, startSector: END_OF_CHAIN, size: 0 }), 0);
        dir.set(makeDirEntry({ name: 'Doc', type: 2, startSector: 2, size: 5 }), 128);
        file.set(dir, sectorByteOffset(1));

        // Stream payload.
        file.set(new Uint8Array([10, 20, 30, 40, 50]), sectorByteOffset(2));

        // DIFAT extension sector: entriesPerSector-1 usable entries, then a
        // next-pointer. Entry #109 (first usable) -> FREE, last 4 bytes -> EOC.
        const ext = new Uint8Array(SECTOR);
        const entriesPerSector = SECTOR / 4;
        for (let i = 0; i < entriesPerSector; i++) writeU32(ext, i * 4, FREE_SECTOR);
        writeU32(ext, (entriesPerSector - 1) * 4, END_OF_CHAIN); // chain terminator
        file.set(ext, sectorByteOffset(difatExtSector));

        const ole = readOle2(file);
        const doc = ole.streams.get('Doc')!;
        expect(doc.length).toBe(5);
        expect(Array.from(doc)).toEqual([10, 20, 30, 40, 50]);
    });
});

describe('readOle2 — name decoding', () => {
    it('stops decoding a stream name at an embedded null code unit', () => {
        // nameLen says 12 bytes (6 code units) but a null appears mid-name,
        // so decoding stops early at "AB".
        const file = buildContainer({
            streams: [
                { name: 'Root Entry', type: 5, startSector: END_OF_CHAIN, size: 0 },
                { name: 'placeholder', type: 2, startSector: 2, size: 1 },
            ],
            fatChains: [[2]],
            totalSectors: 3,
        });
        // Overwrite the second dir entry's name region with A,B,NUL,X and a
        // nameLen covering all of them.
        const dirOff = sectorByteOffset(1) + 128;
        // Clear name area.
        for (let i = 0; i < 64; i++) file[dirOff + i] = 0;
        writeU16(file, dirOff + 0, 0x41); // 'A'
        writeU16(file, dirOff + 2, 0x42); // 'B'
        writeU16(file, dirOff + 4, 0x00); // null terminator mid-buffer
        writeU16(file, dirOff + 6, 0x58); // 'X' (should be ignored)
        writeU16(file, dirOff + 64, 10); // nameLen = 10 bytes
        file[dirOff + 66] = 2; // type stream

        const ole = readOle2(file);
        expect(ole.streams.has('AB')).toBe(true);
        expect(ole.streams.has('ABX')).toBe(false);
    });
});

describe('readOle2 — directory edge cases', () => {
    it('skips directory entries with zero name length', () => {
        // Build a dir with one valid entry and one all-zero (nameLen 0) slot.
        const file = buildContainer({
            streams: [
                { name: 'Root Entry', type: 5, startSector: END_OF_CHAIN, size: 0 },
                { name: 'Only', type: 2, startSector: 2, size: 4 },
            ],
            fatChains: [[2]],
            totalSectors: 3,
        });
        // Slot index 2 and 3 remain zeroed -> nameLen 0 -> skipped.
        file.set(new Uint8Array([1, 2, 3, 4]), sectorByteOffset(2));

        const ole = readOle2(file);
        // Only two real entries, the zeroed slots produce no entry.
        expect(ole.entries.length).toBe(2);
        expect(ole.entries.map(e => e.name)).toEqual(['Root Entry', 'Only']);
    });
});
