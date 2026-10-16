import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { diff } from './diff.js';
import { getConfig, getDefaultConfig } from '../utils/config.js';
import { diffComponentFiles } from '../core/diff-core.js';

chalk.level = 0;

vi.mock('../utils/config.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('../utils/config.js')>(),
    getConfig: vi.fn(),
}));
vi.mock('../core/diff-core.js', () => ({ diffComponentFiles: vi.fn() }));

describe('diff', () => {
    let logged: string[];

    beforeEach(() => {
        logged = [];
        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logged.push(args.map(String).join(' '));
        });
        vi.mocked(getConfig).mockResolvedValue(getDefaultConfig());
        vi.mocked(diffComponentFiles).mockResolvedValue({ name: 'button', hasChanges: false, files: [] });
    });

    afterEach(() => vi.restoreAllMocks());

    it('diff reports Unknown component for an inherited name and continues', async () => {
        await diff(['hasOwnProperty', 'button'], { branch: 'master' });

        expect(logged).toContain('Unknown component: hasOwnProperty');
        expect(vi.mocked(diffComponentFiles).mock.calls.map(c => c[0])).toEqual(['button']);
        expect(logged.join('\n')).toContain('All installed components are up to date.');
    });
});
