import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSnapshot } from './snapshot.js';

/**
 * The clone workers restore their fixture from a snapshot. It was taken once and
 * kept forever, so a committed fixture change (a raised bundle budget) never
 * reached them and pkg-mixed failed a release that pkg-rte passed.
 */
describe('ensureSnapshot', () => {
    let root: string;
    let dir: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-snapshot-'));
        dir = path.join(root, '_pristine');
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function takeWriting(files: Record<string, string>) {
        return vi.fn(async (target: string) => {
            fs.mkdirSync(target, { recursive: true });
            for (const [name, content] of Object.entries(files)) {
                fs.writeFileSync(path.join(target, name), content);
            }
        });
    }

    it('takes a snapshot when there is none', async () => {
        const take = takeWriting({ 'angular.json': 'budget 4MB' });

        await ensureSnapshot(dir, 'tree-b', take);

        expect(take).toHaveBeenCalledTimes(1);
        expect(fs.readFileSync(path.join(dir, 'angular.json'), 'utf-8')).toBe('budget 4MB');
    });

    it('keeps a snapshot completed for the same source', async () => {
        await ensureSnapshot(dir, 'tree-b', takeWriting({ 'angular.json': 'budget 4MB' }));
        const again = takeWriting({ 'angular.json': 'should not be written' });

        await ensureSnapshot(dir, 'tree-b', again);

        expect(again).not.toHaveBeenCalled();
        expect(fs.readFileSync(path.join(dir, 'angular.json'), 'utf-8')).toBe('budget 4MB');
    });

    it('retakes a snapshot of an older source, dropping files the new one lacks', async () => {
        await ensureSnapshot(dir, 'tree-a', takeWriting({ 'angular.json': 'budget 1MB', 'removed.ts': 'old' }));

        await ensureSnapshot(dir, 'tree-b', takeWriting({ 'angular.json': 'budget 4MB' }));

        expect(fs.readFileSync(path.join(dir, 'angular.json'), 'utf-8')).toBe('budget 4MB');
        expect(fs.existsSync(path.join(dir, 'removed.ts'))).toBe(false);
    });

    it('retakes a snapshot that has no key, as one made before keys existed does', async () => {
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, 'angular.json'), 'budget 1MB');

        await ensureSnapshot(dir, 'tree-b', takeWriting({ 'angular.json': 'budget 4MB' }));

        expect(fs.readFileSync(path.join(dir, 'angular.json'), 'utf-8')).toBe('budget 4MB');
    });

    it('does not trust a snapshot whose taking failed part way', async () => {
        const failing = vi.fn(async (target: string) => {
            fs.mkdirSync(target, { recursive: true });
            fs.writeFileSync(path.join(target, 'angular.json'), 'half written');
            throw new Error('copy interrupted');
        });
        await expect(ensureSnapshot(dir, 'tree-b', failing)).rejects.toThrow('copy interrupted');

        const retry = takeWriting({ 'angular.json': 'budget 4MB' });
        await ensureSnapshot(dir, 'tree-b', retry);

        expect(retry).toHaveBeenCalledTimes(1);
        expect(fs.readFileSync(path.join(dir, 'angular.json'), 'utf-8')).toBe('budget 4MB');
    });

    it('keeps the key outside the snapshot, so clones never receive it', async () => {
        await ensureSnapshot(dir, 'tree-b', takeWriting({ 'angular.json': 'budget 4MB' }));

        expect(fs.readdirSync(dir)).toEqual(['angular.json']);
    });
});
