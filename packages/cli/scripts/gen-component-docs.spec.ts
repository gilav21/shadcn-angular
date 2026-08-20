/**
 * Entry-script contract for `npm run docs:components`: argv parsing, the
 * write path, the `--check` drift gate, and route discovery against the real
 * demo app.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRouteSources, parseArgs, run } from './gen-component-docs.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REAL_OUT = path.join(REPO_ROOT, 'demo/public/component-docs.json');

const temps: string[] = [];

function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-component-docs-'));
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
        expect(args.docs).toBe(path.join(REPO_ROOT, 'packages/components/api-docs.json'));
        expect(args.out).toBe(REAL_OUT);
    });

    it('reads --check, --docs and --out', () => {
        const args = parseArgs(['--check', '--docs', 'x.json', '--out', 'y.json']);
        expect(args.check).toBe(true);
        expect(args.docs).toBe(path.resolve('x.json'));
        expect(args.out).toBe(path.resolve('y.json'));
    });

    it('rejects an unknown flag', () => {
        expect(() => parseArgs(['--wat'])).toThrow(/Unknown argument: --wat/);
    });
});

describe('loadRouteSources', () => {
    const routes = loadRouteSources(REPO_ROOT);

    it('resolves every demo route to a file that exists', () => {
        expect(routes.length).toBeGreaterThan(100);
        for (const route of routes) {
            expect(fs.existsSync(path.join(REPO_ROOT, route.file)), route.file).toBe(true);
        }
    });

    it('reads the library classes each demo imports', () => {
        const buttons = routes.find(r => r.path === 'buttons');
        expect(buttons?.importedClasses).toContain('ButtonComponent');
    });
});

describe('run', () => {
    it('writes the payload and reports the component count', () => {
        const out = path.join(tempDir(), 'nested', 'component-docs.json');
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        expect(run(['--out', out])).toBe(0);
        expect(fs.readFileSync(out, 'utf-8')).toBe(fs.readFileSync(REAL_OUT, 'utf-8'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining('with a live demo route'));
    });

    it('passes --check when the committed payload is current', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        expect(run(['--check'])).toBe(0);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('up to date'));
    });

    it('fails --check when the payload on disk is stale', () => {
        const out = path.join(tempDir(), 'component-docs.json');
        fs.writeFileSync(out, '{"version":1,"components":[]}');
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        expect(run(['--check', '--out', out])).toBe(1);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('stale'));
    });

    it('fails --check when the payload has never been written', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(run(['--check', '--out', path.join(tempDir(), 'absent.json')])).toBe(1);
    });

    it('refuses an extract written by a different schema version', () => {
        const dir = tempDir();
        const docs = path.join(dir, 'api-docs.json');
        fs.writeFileSync(docs, '{"version":9,"classes":[]}');
        expect(() => run(['--docs', docs, '--out', path.join(dir, 'o.json')]))
            .toThrow(/extract version 9/);
    });
});
