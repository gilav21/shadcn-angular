/**
 * Entry-script contract for `npm run docs:api`: argv parsing, the write path,
 * and the `--check` gate that keeps the committed extract in step with the
 * component sources.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, run } from './gen-api-docs.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REAL_OUT = path.join(REPO_ROOT, 'packages/components/api-docs.json');

const temps: string[] = [];

function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-api-docs-'));
    temps.push(dir);
    return dir;
}

/** A minimal compodoc payload with one library component. */
function writeDocs(dir: string): string {
    const file = path.join(dir, 'documentation.json');
    fs.writeFileSync(file, JSON.stringify({
        components: [{
            name: 'BoxComponent',
            file: 'packages/components/ui/box/box.component.ts',
            selector: 'ui-box',
            inputsClass: [{ name: 'label', type: 'string' }],
        }],
    }));
    return file;
}

afterEach(() => {
    vi.restoreAllMocks();
    while (temps.length > 0) {
        fs.rmSync(temps.pop() as string, { recursive: true, force: true });
    }
});

describe('parseArgs', () => {
    it('defaults to the repo-root documentation.json and the committed extract', () => {
        const args = parseArgs([]);
        expect(args.check).toBe(false);
        expect(args.docs).toBe(path.join(REPO_ROOT, 'documentation.json'));
        expect(args.out).toBe(REAL_OUT);
    });

    it('reads --check, --docs and --out', () => {
        const args = parseArgs(['--check', '--docs', 'x.json', '--out', 'y.json']);
        expect(args.check).toBe(true);
        expect(args.docs).toBe(path.resolve('x.json'));
        expect(args.out).toBe(path.resolve('y.json'));
    });

    it('rejects an unknown flag', () => {
        expect(() => parseArgs(['--bogus'])).toThrow(/Unknown argument: --bogus/);
    });
});

describe('run', () => {
    it('writes the extract and reports the class count', () => {
        const dir = tempDir();
        const out = path.join(dir, 'nested', 'api-docs.json');
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        expect(run(['--docs', writeDocs(dir), '--out', out])).toBe(0);

        const written = JSON.parse(fs.readFileSync(out, 'utf-8')) as { classes: unknown[] };
        expect(written.classes).toHaveLength(1);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('1 classes'));
    });

    it('passes --check when the extract matches', () => {
        const dir = tempDir();
        const docs = writeDocs(dir);
        const out = path.join(dir, 'api-docs.json');
        vi.spyOn(console, 'log').mockImplementation(() => undefined);

        run(['--docs', docs, '--out', out]);
        expect(run(['--check', '--docs', docs, '--out', out])).toBe(0);
    });

    it('fails --check when the extract is stale', () => {
        const dir = tempDir();
        const out = path.join(dir, 'api-docs.json');
        fs.writeFileSync(out, '{"version":1,"classes":[]}');
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(run(['--check', '--docs', writeDocs(dir), '--out', out])).toBe(1);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('stale'));
    });

    it('fails --check when the extract has never been written', () => {
        const dir = tempDir();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(run([
            '--check', '--docs', writeDocs(dir), '--out', path.join(dir, 'absent.json'),
        ])).toBe(1);
    });

    it('refuses the committed documentation.json stub instead of erasing the extract', () => {
        const dir = tempDir();
        const stub = path.join(dir, 'documentation.json');
        fs.writeFileSync(stub, JSON.stringify({ components: [], directives: [] }));
        expect(() => run(['--docs', stub, '--out', path.join(dir, 'out.json')]))
            .toThrow(/no library classes/);
    });
});
