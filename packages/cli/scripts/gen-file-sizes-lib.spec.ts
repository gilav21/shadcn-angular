/**
 * The size manifest `why` reads to answer "what does this cost me" before
 * anything is installed.
 *
 * The manifest is only useful if it is complete: a missing entry silently
 * shrinks the reported footprint, which is the one direction a size estimate
 * must never err in. So the committed file is checked against the registry's
 * own file lists, not just against itself.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildFileSizes,
    measure,
    serializeFileSizes,
    type FileSizes,
} from './gen-file-sizes-lib.js';
import type { RegistryJson } from './gen-llms-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readJson<T>(relative: string): T {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), 'utf-8')) as T;
}

const registry = readJson<RegistryJson>('packages/components/registry.json');
const committed = readJson<FileSizes>('packages/components/file-sizes.json');

describe('measure', () => {
    it('counts UTF-8 bytes, not characters', () => {
        expect(measure('abc').bytes).toBe(3);
        expect(measure('é').bytes).toBe(2);
        expect(measure('→').bytes).toBe(3);
    });

    it('counts lines without inventing one for a trailing newline', () => {
        expect(measure('a\nb\nc').lines).toBe(3);
        expect(measure('a\nb\nc\n').lines).toBe(3);
    });

    it('reports an empty file as zero lines', () => {
        expect(measure('')).toEqual({ bytes: 0, lines: 0 });
        expect(measure('\n').lines).toBe(0);
    });

    it('counts CRLF and LF files the same', () => {
        expect(measure('a\r\nb').lines).toBe(measure('a\nb').lines);
    });
});

describe('buildFileSizes', () => {
    const built = buildFileSizes(
        [{ path: 'b.ts', contents: 'x' }, { path: 'a.ts', contents: 'yy' }],
        [{ path: 'utils.ts', contents: 'z' }],
        [{ path: 'login/login.component.ts', contents: 'zz' }],
    );

    it('keys each namespace separately', () => {
        expect(Object.keys(built.ui)).toEqual(['a.ts', 'b.ts']);
        expect(Object.keys(built.lib)).toEqual(['utils.ts']);
        expect(Object.keys(built.blocks)).toEqual(['login/login.component.ts']);
    });

    it('sorts keys so the output is byte-stable', () => {
        expect(serializeFileSizes(built)).toBe(serializeFileSizes(buildFileSizes(
            [{ path: 'a.ts', contents: 'yy' }, { path: 'b.ts', contents: 'x' }],
            [{ path: 'utils.ts', contents: 'z' }],
            [{ path: 'login/login.component.ts', contents: 'zz' }],
        )));
    });

    it('defaults blocks to empty so an older caller still type-checks', () => {
        expect(buildFileSizes([], []).blocks).toEqual({});
    });
});

describe('the committed manifest', () => {
    it('is at the version the CLI expects', () => {
        expect(committed.version).toBe(1);
    });

    it('covers the whole library', () => {
        expect(Object.keys(committed.ui).length).toBeGreaterThan(500);
        expect(Object.keys(committed.lib).length).toBeGreaterThan(50);
        expect(Object.keys(committed.blocks).length).toBeGreaterThan(10);
    });

    it('has an entry for every file the registry says a component installs', () => {
        const missing: string[] = [];
        for (const [name, entry] of Object.entries(registry)) {
            const own = entry.type === 'block' ? committed.blocks : committed.ui;
            for (const file of [...entry.files, ...(entry.peerFiles ?? [])]) {
                if (!own[file]) missing.push(`${name}: ${file}`);
            }
            for (const file of entry.libFiles ?? []) {
                if (!committed.lib[file]) missing.push(`${name}: lib/${file}`);
            }
        }
        expect(missing).toEqual([]);
    });

    it('records a positive size for every measured file', () => {
        for (const namespace of [committed.ui, committed.lib, committed.blocks]) {
            for (const size of Object.values(namespace)) {
                expect(size.bytes).toBeGreaterThan(0);
                expect(size.lines).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('matches the files actually on disk', () => {
        const uiRoot = path.join(REPO_ROOT, 'packages/components/ui');
        const sample = Object.keys(committed.ui).slice(0, 25);
        expect(sample.length).toBeGreaterThan(0);
        for (const file of sample) {
            const absolute = path.join(uiRoot, file);
            expect(fs.existsSync(absolute)).toBe(true);
            expect(committed.ui[file])
                .toEqual(measure(fs.readFileSync(absolute, 'utf-8')));
        }
    });
});
