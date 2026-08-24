/**
 * Entry-script contract for `npm run docs:llms`: argv parsing, the write path,
 * the `--check` drift gate, and the guards that stop a stub input from
 * silently producing an empty corpus.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, run } from './gen-llms.js';
import type { ApiDocs } from './gen-api-docs-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REAL_DOCS = path.join(REPO_ROOT, 'packages/components/api-docs.json');
const REAL_OUT = path.join(REPO_ROOT, 'demo/public/llms.txt');

const temps: string[] = [];

function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-llms-'));
    temps.push(dir);
    return dir;
}

afterEach(() => {
    vi.restoreAllMocks();
    while (temps.length > 0) {
        fs.rmSync(temps.pop() as string, { recursive: true, force: true });
    }
});

describe('parseArgs', () => {
    it('defaults to the committed extract and the demo app public folder', () => {
        const args = parseArgs([]);
        expect(args.check).toBe(false);
        expect(args.docs).toBe(REAL_DOCS);
        expect(args.out).toBe(REAL_OUT);
    });

    it('reads --check, --docs and --out', () => {
        const args = parseArgs(['--check', '--docs', 'a.json', '--out', 'b.txt']);
        expect(args.check).toBe(true);
        expect(args.docs).toBe(path.resolve('a.json'));
        expect(args.out).toBe(path.resolve('b.txt'));
    });

    it('rejects an unknown flag instead of silently ignoring it', () => {
        expect(() => parseArgs(['--nope'])).toThrow(/Unknown argument: --nope/);
    });
});

describe('run', () => {
    it('writes a corpus and reports success', () => {
        const out = path.join(tempDir(), 'nested', 'llms.txt');
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        expect(run(['--out', out])).toBe(0);

        const written = fs.readFileSync(out, 'utf-8');
        expect(written).toBe(fs.readFileSync(REAL_OUT, 'utf-8'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining('llms.txt'));
    });

    it('passes --check when the committed file is current', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        expect(run(['--check'])).toBe(0);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('up to date'));
    });

    it('fails --check when the file on disk is stale', () => {
        const out = path.join(tempDir(), 'llms.txt');
        fs.writeFileSync(out, 'stale');
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(run(['--check', '--out', out])).toBe(1);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('stale'));
    });

    it('fails --check when the file does not exist at all', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const out = path.join(tempDir(), 'missing.txt');
        expect(run(['--check', '--out', out])).toBe(1);
    });

    it('refuses an extract with no classes rather than writing an empty corpus', () => {
        const dir = tempDir();
        const docs = path.join(dir, 'api-docs.json');
        const empty: ApiDocs = { version: 2, classes: [] };
        fs.writeFileSync(docs, JSON.stringify(empty));
        expect(() => run(['--docs', docs])).toThrow(/lists no classes/);
    });

    it('refuses an extract written by a different schema version', () => {
        const dir = tempDir();
        const docs = path.join(dir, 'api-docs.json');
        fs.writeFileSync(docs, JSON.stringify({ version: 9, classes: [] }));
        expect(() => run(['--docs', docs])).toThrow(/extract version 9/);
    });
});
