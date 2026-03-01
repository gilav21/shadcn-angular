import { inflate } from './inflate';

export interface ZipEntry {
    readonly path: string;
    readonly compressedSize: number;
    readonly uncompressedSize: number;
    readonly compressionMethod: number;
    readonly crc32: number;
    readonly offset: number;
}

export interface ZipReadOptions {
    readonly maxUncompressedSize?: number;
    readonly maxFileCount?: number;
    readonly maxFileSize?: number;
}

const DEFAULT_MAX_UNCOMPRESSED = 100 * 1024 * 1024;
const DEFAULT_MAX_FILE_COUNT = 1000;
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIR = 0x02014b50;
const ZIP_END_OF_CENTRAL = 0x06054b50;

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

function parseCentralDirectory(data: Uint8Array): ZipEntry[] {
    const eocdOffset = findEndOfCentralDir(data);
    const entryCount = readU16LE(data, eocdOffset + 10);
    const centralDirOffset = readU32LE(data, eocdOffset + 16);

    const entries: ZipEntry[] = [];
    let pos = centralDirOffset;

    for (let i = 0; i < entryCount; i++) {
        if (pos + 46 > data.length) break;
        if (readU32LE(data, pos) !== ZIP_CENTRAL_DIR) break;

        const compressionMethod = readU16LE(data, pos + 10);
        const entryCrc32 = readU32LE(data, pos + 16);
        const compressedSize = readU32LE(data, pos + 20);
        const uncompressedSize = readU32LE(data, pos + 24);
        const nameLen = readU16LE(data, pos + 28);
        const extraLen = readU16LE(data, pos + 30);
        const commentLen = readU16LE(data, pos + 32);
        const localHeaderOffset = readU32LE(data, pos + 42);

        const pathBytes = data.subarray(pos + 46, pos + 46 + nameLen);
        const path = new TextDecoder().decode(pathBytes);

        entries.push({
            path,
            compressedSize,
            uncompressedSize,
            compressionMethod,
            crc32: entryCrc32,
            offset: localHeaderOffset,
        });

        pos += 46 + nameLen + extraLen + commentLen;
    }

    return entries;
}

function extractEntryData(data: Uint8Array, entry: ZipEntry, maxFileSize: number): Uint8Array {
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
    const maxFileCount = options?.maxFileCount ?? DEFAULT_MAX_FILE_COUNT;
    const maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

    const entries = parseCentralDirectory(data);
    if (entries.length > maxFileCount) {
        throw new Error(`Too many files in ZIP: ${entries.length} (max ${maxFileCount})`);
    }

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
