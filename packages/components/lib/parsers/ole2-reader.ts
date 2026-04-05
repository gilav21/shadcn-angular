export interface Ole2DirectoryEntry {
    readonly name: string;
    readonly type: number;
    readonly startSector: number;
    readonly size: number;
}

export interface Ole2File {
    readonly streams: ReadonlyMap<string, Uint8Array>;
    readonly entries: ReadonlyArray<Ole2DirectoryEntry>;
}

interface Ole2Header {
    readonly sectorSize: number;
    readonly miniSectorSize: number;
    readonly fatSectors: number;
    readonly firstDirSector: number;
    readonly miniStreamCutoff: number;
    readonly firstMiniFatSector: number;
    readonly miniFatSectors: number;
    readonly firstDifatSector: number;
    readonly difatSectors: number;
}

const OLE2_MAGIC = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
const END_OF_CHAIN = 0xFFFFFFFE;
const FREE_SECTOR = 0xFFFFFFFF;
const MAX_CHAIN_LENGTH = 1_000_000;

function readU16(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
}

function readU32(data: Uint8Array, offset: number): number {
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function validateMagic(data: Uint8Array): void {
    if (data.length < 512) {
        throw new Error('OLE2: file too small for header');
    }
    for (let i = 0; i < OLE2_MAGIC.length; i++) {
        if (data[i] !== OLE2_MAGIC[i]) {
            throw new Error('OLE2: invalid magic signature');
        }
    }
}

function parseOle2Header(data: Uint8Array): Ole2Header {
    validateMagic(data);

    const sectorSizePower = readU16(data, 30);
    const miniSectorSizePower = readU16(data, 32);

    return {
        sectorSize: 1 << sectorSizePower,
        miniSectorSize: 1 << miniSectorSizePower,
        fatSectors: readU32(data, 44),
        firstDirSector: readU32(data, 48),
        miniStreamCutoff: readU32(data, 56),
        firstMiniFatSector: readU32(data, 60),
        miniFatSectors: readU32(data, 64),
        firstDifatSector: readU32(data, 68),
        difatSectors: readU32(data, 72),
    };
}

function sectorOffset(sectorIndex: number, sectorSize: number): number {
    return 512 + sectorIndex * sectorSize;
}

function buildDifat(data: Uint8Array, header: Ole2Header): Uint32Array {
    const entriesPerSector = header.sectorSize / 4;
    const totalEntries = header.fatSectors;
    const difat = new Uint32Array(totalEntries);

    const headerEntries = Math.min(totalEntries, 109);
    for (let i = 0; i < headerEntries; i++) {
        difat[i] = readU32(data, 76 + i * 4);
    }

    if (totalEntries <= 109) {
        return difat;
    }

    return readDifatChain(data, header, difat, headerEntries, entriesPerSector);
}

function readDifatChain(
    data: Uint8Array,
    header: Ole2Header,
    difat: Uint32Array,
    filled: number,
    entriesPerSector: number,
): Uint32Array {
    let currentSector = header.firstDifatSector;
    let idx = filled;
    let chainsFollowed = 0;

    while (currentSector !== END_OF_CHAIN && currentSector !== FREE_SECTOR && idx < difat.length) {
        if (chainsFollowed++ > MAX_CHAIN_LENGTH) {
            throw new Error('OLE2: DIFAT chain too long');
        }

        const offset = sectorOffset(currentSector, header.sectorSize);
        const usable = entriesPerSector - 1;

        for (let i = 0; i < usable && idx < difat.length; i++) {
            difat[idx++] = readU32(data, offset + i * 4);
        }

        currentSector = readU32(data, offset + usable * 4);
    }

    return difat;
}

function buildFat(data: Uint8Array, header: Ole2Header, difat: Uint32Array): Uint32Array {
    const entriesPerSector = header.sectorSize / 4;
    const fat = new Uint32Array(difat.length * entriesPerSector);

    for (let i = 0; i < difat.length; i++) {
        const sectorIdx = difat[i];
        if (sectorIdx === FREE_SECTOR || sectorIdx === END_OF_CHAIN) {
            continue;
        }

        const offset = sectorOffset(sectorIdx, header.sectorSize);
        const baseIdx = i * entriesPerSector;

        for (let j = 0; j < entriesPerSector; j++) {
            if (offset + j * 4 + 4 <= data.length) {
                fat[baseIdx + j] = readU32(data, offset + j * 4);
            }
        }
    }

    return fat;
}

function readSectorChain(
    data: Uint8Array,
    sectorSize: number,
    fat: Uint32Array,
    startSector: number,
): Uint8Array {
    const sectors: number[] = [];
    let current = startSector;
    let chainLength = 0;

    while (current !== END_OF_CHAIN && current !== FREE_SECTOR && current < fat.length) {
        if (chainLength++ > MAX_CHAIN_LENGTH) {
            throw new Error('OLE2: sector chain too long');
        }
        sectors.push(current);
        current = fat[current];
    }

    const result = new Uint8Array(sectors.length * sectorSize);
    for (let i = 0; i < sectors.length; i++) {
        const offset = sectorOffset(sectors[i], sectorSize);
        const available = Math.min(sectorSize, data.length - offset);
        if (available > 0) {
            result.set(data.subarray(offset, offset + available), i * sectorSize);
        }
    }

    return result;
}

function decodeEntryName(entryData: Uint8Array, nameLen: number): string {
    const actualLen = Math.max(0, nameLen - 2);
    const chars: string[] = [];

    for (let i = 0; i < actualLen; i += 2) {
        const code = entryData[i] | (entryData[i + 1] << 8);
        if (code === 0) break;
        chars.push(String.fromCodePoint(code));
    }

    return chars.join('');
}

function parseSingleEntry(entryData: Uint8Array): Ole2DirectoryEntry | null {
    const nameLen = readU16(entryData, 64);
    if (nameLen === 0) {
        return null;
    }

    const entryType = entryData[66];
    const name = decodeEntryName(entryData, nameLen);
    const startSector = readU32(entryData, 116);
    const size = readU32(entryData, 120);

    return { name, type: entryType, startSector, size };
}

function parseDirectoryEntries(dirData: Uint8Array): Ole2DirectoryEntry[] {
    const entrySize = 128;
    const count = Math.floor(dirData.length / entrySize);
    const entries: Ole2DirectoryEntry[] = [];

    for (let i = 0; i < count; i++) {
        const entryBytes = dirData.subarray(i * entrySize, (i + 1) * entrySize);
        const entry = parseSingleEntry(entryBytes);
        if (entry) {
            entries.push(entry);
        }
    }

    return entries;
}

function buildMiniFat(
    data: Uint8Array,
    sectorSize: number,
    fat: Uint32Array,
    miniFatStart: number,
): Uint32Array {
    if (miniFatStart === END_OF_CHAIN || miniFatStart === FREE_SECTOR) {
        return new Uint32Array(0);
    }

    const miniFatData = readSectorChain(data, sectorSize, fat, miniFatStart);
    const entryCount = Math.floor(miniFatData.length / 4);
    const miniFat = new Uint32Array(entryCount);

    for (let i = 0; i < entryCount; i++) {
        miniFat[i] = readU32(miniFatData, i * 4);
    }

    return miniFat;
}

function readMiniStreamData(
    miniStream: Uint8Array,
    miniFat: Uint32Array,
    miniSectorSize: number,
    startSector: number,
    size: number,
): Uint8Array {
    const result = new Uint8Array(size);
    let current = startSector;
    let written = 0;
    let chainLength = 0;

    while (current !== END_OF_CHAIN && current !== FREE_SECTOR && written < size) {
        if (chainLength++ > MAX_CHAIN_LENGTH) {
            throw new Error('OLE2: mini-stream chain too long');
        }

        const offset = current * miniSectorSize;
        const toCopy = Math.min(miniSectorSize, size - written);

        if (offset + toCopy <= miniStream.length) {
            result.set(miniStream.subarray(offset, offset + toCopy), written);
        }

        written += toCopy;

        if (current < miniFat.length) {
            current = miniFat[current];
        } else {
            break;
        }
    }

    return result;
}

function readRegularStream(
    data: Uint8Array,
    sectorSize: number,
    fat: Uint32Array,
    startSector: number,
    size: number,
): Uint8Array {
    const chainData = readSectorChain(data, sectorSize, fat, startSector);
    return chainData.subarray(0, Math.min(size, chainData.length));
}

function readStreamBytes(
    data: Uint8Array,
    header: Ole2Header,
    fat: Uint32Array,
    miniFat: Uint32Array,
    miniStream: Uint8Array,
    entry: Ole2DirectoryEntry,
): Uint8Array {
    if (entry.size === 0) {
        return new Uint8Array(0);
    }

    if (entry.size < header.miniStreamCutoff && miniFat.length > 0) {
        return readMiniStreamData(miniStream, miniFat, header.miniSectorSize, entry.startSector, entry.size);
    }

    return readRegularStream(data, header.sectorSize, fat, entry.startSector, entry.size);
}

function buildMiniStream(
    data: Uint8Array,
    header: Ole2Header,
    fat: Uint32Array,
    rootEntry: Ole2DirectoryEntry,
): Uint8Array {
    if (rootEntry.size === 0) {
        return new Uint8Array(0);
    }
    return readRegularStream(data, header.sectorSize, fat, rootEntry.startSector, rootEntry.size);
}

function findRootEntry(entries: ReadonlyArray<Ole2DirectoryEntry>): Ole2DirectoryEntry | undefined {
    return entries.find(e => e.type === 5);
}

function buildStreamsMap(
    data: Uint8Array,
    header: Ole2Header,
    fat: Uint32Array,
    miniFat: Uint32Array,
    miniStream: Uint8Array,
    entries: ReadonlyArray<Ole2DirectoryEntry>,
): ReadonlyMap<string, Uint8Array> {
    const streams = new Map<string, Uint8Array>();

    for (const entry of entries) {
        if (entry.type !== 2) {
            continue;
        }
        const streamData = readStreamBytes(data, header, fat, miniFat, miniStream, entry);
        streams.set(entry.name, streamData);
    }

    return streams;
}

export function readOle2(data: Uint8Array): Ole2File {
    const header = parseOle2Header(data);
    const difat = buildDifat(data, header);
    const fat = buildFat(data, header, difat);

    const dirData = readSectorChain(data, header.sectorSize, fat, header.firstDirSector);
    const entries = parseDirectoryEntries(dirData);

    const rootEntry = findRootEntry(entries);
    const miniStream = rootEntry ? buildMiniStream(data, header, fat, rootEntry) : new Uint8Array(0);
    const miniFat = buildMiniFat(data, header.sectorSize, fat, header.firstMiniFatSector);

    const streams = buildStreamsMap(data, header, fat, miniFat, miniStream, entries);

    return { streams, entries };
}
