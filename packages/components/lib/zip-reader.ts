import { inflate } from './inflate';

export interface ZipEntry {
    readonly path: string;
    readonly compressedSize: number;
    readonly uncompressedSize: number;
    readonly compressionMethod: number;
    readonly crc32: number;
    readonly offset: number;
    readonly flags: number;
}

export interface ZipReadOptions {
    readonly maxUncompressedSize?: number;
    /** @deprecated No longer enforced. Kept for API compatibility. */
    readonly maxFileCount?: number;
    readonly maxFileSize?: number;
}

const DEFAULT_MAX_UNCOMPRESSED = 1024 * 1024 * 1024;
const DEFAULT_MAX_FILE_SIZE = 200 * 1024 * 1024;

const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIR = 0x02014b50;
const ZIP_END_OF_CENTRAL = 0x06054b50;
const ZIP64_END_OF_CENTRAL = 0x06064b50;
const ZIP64_END_LOCATOR = 0x07064b50;

const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table(): Uint32Array {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c;
    }
    return table;
}

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function readU16LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
}

function readU32LE(data: Uint8Array, offset: number): number {
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function readU64LE(data: Uint8Array, offset: number): number {
    const low = readU32LE(data, offset);
    const high = readU32LE(data, offset + 4);
    return high * 0x100000000 + low;
}

function validateZipMagic(data: Uint8Array): void {
    if (data.length < 22) {
        throw new Error('Data too small to be a ZIP file');
    }
    if (readU32LE(data, 0) !== ZIP_LOCAL_HEADER) {
        throw new Error('Invalid ZIP file: missing PK signature');
    }
}

function validatePath(path: string): void {
    if (path.startsWith('/') || path.startsWith('\\')) {
        throw new Error(`Absolute path rejected: ${path}`);
    }
    const segments = path.split(/[/\\]/);
    for (const seg of segments) {
        if (seg === '..') {
            throw new Error(`Path traversal rejected: ${path}`);
        }
    }
}

function findEndOfCentralDir(data: Uint8Array): number {
    const searchStart = Math.max(0, data.length - 65557);
    for (let i = data.length - 22; i >= searchStart; i--) {
        if (readU32LE(data, i) === ZIP_END_OF_CENTRAL) {
            return i;
        }
    }
    throw new Error('Cannot find end of central directory');
}

function tryReadZip64Eocd(data: Uint8Array, eocdOffset: number): { entryCount: number; centralDirOffset: number } | null {
    if (eocdOffset < 20) return null;

    const locatorOffset = eocdOffset - 20;
    if (readU32LE(data, locatorOffset) !== ZIP64_END_LOCATOR) return null;

    const zip64EocdOffset = readU64LE(data, locatorOffset + 8);
    if (zip64EocdOffset + 56 > data.length) return null;
    if (readU32LE(data, zip64EocdOffset) !== ZIP64_END_OF_CENTRAL) return null;

    const entryCount = readU64LE(data, zip64EocdOffset + 32);
    const centralDirOffset = readU64LE(data, zip64EocdOffset + 48);

    return { entryCount, centralDirOffset };
}

function parseCentralDirectory(data: Uint8Array): ZipEntry[] {
    const eocdOffset = findEndOfCentralDir(data);

    const zip64 = tryReadZip64Eocd(data, eocdOffset);

    let entryCount: number;
    let centralDirOffset: number;

    if (zip64) {
        entryCount = zip64.entryCount;
        centralDirOffset = zip64.centralDirOffset;
    } else {
        entryCount = readU16LE(data, eocdOffset + 10);
        centralDirOffset = readU32LE(data, eocdOffset + 16);
    }

    const entries: ZipEntry[] = [];
    let pos = centralDirOffset;

    for (let i = 0; i < entryCount; i++) {
        if (pos + 46 > data.length) break;
        if (readU32LE(data, pos) !== ZIP_CENTRAL_DIR) break;

        const flags = readU16LE(data, pos + 8);
        const compressionMethod = readU16LE(data, pos + 10);
        const entryCrc32 = readU32LE(data, pos + 16);
        let compressedSize = readU32LE(data, pos + 20);
        let uncompressedSize = readU32LE(data, pos + 24);
        const nameLen = readU16LE(data, pos + 28);
        const extraLen = readU16LE(data, pos + 30);
        const commentLen = readU16LE(data, pos + 32);
        let localHeaderOffset = readU32LE(data, pos + 42);

        const pathBytes = data.subarray(pos + 46, pos + 46 + nameLen);
        const path = new TextDecoder().decode(pathBytes);

        if (compressedSize === 0xFFFFFFFF || uncompressedSize === 0xFFFFFFFF || localHeaderOffset === 0xFFFFFFFF) {
            const zip64Extra = findZip64ExtraField(data, pos + 46 + nameLen, extraLen, uncompressedSize, compressedSize, localHeaderOffset);
            if (zip64Extra) {
                if (zip64Extra.uncompressedSize !== undefined) uncompressedSize = zip64Extra.uncompressedSize;
                if (zip64Extra.compressedSize !== undefined) compressedSize = zip64Extra.compressedSize;
                if (zip64Extra.localHeaderOffset !== undefined) localHeaderOffset = zip64Extra.localHeaderOffset;
            }
        }

        entries.push({
            path,
            compressedSize,
            uncompressedSize,
            compressionMethod,
            crc32: entryCrc32,
            offset: localHeaderOffset,
            flags,
        });

        pos += 46 + nameLen + extraLen + commentLen;
    }

    return entries;
}

interface Zip64ExtraResult {
    readonly uncompressedSize?: number;
    readonly compressedSize?: number;
    readonly localHeaderOffset?: number;
}

function findZip64ExtraField(
    data: Uint8Array,
    extraStart: number,
    extraLen: number,
    origUncompressed: number,
    origCompressed: number,
    origOffset: number,
): Zip64ExtraResult | null {
    let offset = extraStart;
    const end = extraStart + extraLen;

    while (offset + 4 <= end) {
        const headerId = readU16LE(data, offset);
        const dataSize = readU16LE(data, offset + 2);
        if (headerId === 0x0001) {
            const result: { uncompressedSize?: number; compressedSize?: number; localHeaderOffset?: number } = {};
            let fieldOffset = offset + 4;
            if (origUncompressed === 0xFFFFFFFF && fieldOffset + 8 <= end) {
                result.uncompressedSize = readU64LE(data, fieldOffset);
                fieldOffset += 8;
            }
            if (origCompressed === 0xFFFFFFFF && fieldOffset + 8 <= end) {
                result.compressedSize = readU64LE(data, fieldOffset);
                fieldOffset += 8;
            }
            if (origOffset === 0xFFFFFFFF && fieldOffset + 8 <= end) {
                result.localHeaderOffset = readU64LE(data, fieldOffset);
            }
            return result;
        }
        offset += 4 + dataSize;
    }
    return null;
}

function checkEncrypted(entry: ZipEntry): void {
    if (entry.flags & 0x01) {
        throw new Error(`Encrypted ZIP entry not supported: ${entry.path}`);
    }
}

function extractEntryData(data: Uint8Array, entry: ZipEntry, maxFileSize: number): Uint8Array {
    checkEncrypted(entry);

    if (entry.uncompressedSize > maxFileSize) {
        throw new Error(`File too large: ${entry.path} (${entry.uncompressedSize} bytes)`);
    }

    const localOffset = entry.offset;
    if (localOffset + 30 > data.length) {
        throw new Error(`Invalid local header offset for ${entry.path}`);
    }
    if (readU32LE(data, localOffset) !== ZIP_LOCAL_HEADER) {
        throw new Error(`Invalid local header for ${entry.path}`);
    }

    const localNameLen = readU16LE(data, localOffset + 26);
    const localExtraLen = readU16LE(data, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressedData = data.subarray(dataStart, dataStart + entry.compressedSize);

    let result: Uint8Array;
    if (entry.compressionMethod === 0) {
        result = compressedData.slice();
    } else if (entry.compressionMethod === 8) {
        result = inflate(compressedData);
    } else {
        throw new Error(`Unsupported compression method ${entry.compressionMethod} for ${entry.path}`);
    }

    const actualCrc = crc32(result);
    if (actualCrc !== entry.crc32) {
        throw new Error(`CRC32 mismatch for ${entry.path}: expected ${entry.crc32}, got ${actualCrc}`);
    }

    return result;
}

export function listZipEntries(data: Uint8Array): ZipEntry[] {
    validateZipMagic(data);
    return parseCentralDirectory(data);
}

export function extractZipEntry(data: Uint8Array, path: string, options?: ZipReadOptions): Uint8Array | null {
    validateZipMagic(data);
    const maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    const entries = parseCentralDirectory(data);
    const entry = entries.find(e => e.path === path);
    if (!entry) return null;
    validatePath(entry.path);
    return extractEntryData(data, entry, maxFileSize);
}

export function readZip(data: Uint8Array, options?: ZipReadOptions): Map<string, Uint8Array> {
    validateZipMagic(data);

    const maxUncompressed = options?.maxUncompressedSize ?? DEFAULT_MAX_UNCOMPRESSED;
    const maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

    const entries = parseCentralDirectory(data);

    let totalUncompressed = 0;
    for (const entry of entries) {
        totalUncompressed += entry.uncompressedSize;
    }
    if (totalUncompressed > maxUncompressed) {
        throw new Error(`Total uncompressed size too large: ${totalUncompressed} bytes (max ${maxUncompressed})`);
    }

    const files = new Map<string, Uint8Array>();

    for (const entry of entries) {
        if (entry.path.endsWith('/')) continue;
        validatePath(entry.path);
        files.set(entry.path, extractEntryData(data, entry, maxFileSize));
    }

    return files;
}
