import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import { installPackages } from './package-manager.js';

vi.mock('execa', () => ({ execa: vi.fn(async () => ({})) }));

describe('installPackages', () => {
    let savedAgent: string | undefined;

    beforeEach(() => {
        savedAgent = process.env['npm_config_user_agent'];
        vi.mocked(execa).mockClear();
    });

    afterEach(() => {
        if (savedAgent === undefined) delete process.env['npm_config_user_agent'];
        else process.env['npm_config_user_agent'] = savedAgent;
    });

    // `--` ends option parsing, so a package spec can never be read as a flag
    // (`--registry=…`). Verified 2026-10-03 on npm 11.5.1, pnpm 9.15.9,
    // yarn 1.22.22, yarn 4.18.1 and bun 1.2.23: after `--` each treats the token
    // as a package spec, and `-D -- <pkg>` still installs normally.
    it.each([
        { agent: 'npm/11.5.1 node/v22.0.0', bin: 'npm', argv: ['install', '-D', '--', 'zod', '@scope/pkg@^1.2.3'] },
        { agent: 'pnpm/9.15.9 npm/? node/v22.0.0', bin: 'pnpm', argv: ['add', '-D', '--', 'zod', '@scope/pkg@^1.2.3'] },
        { agent: 'yarn/1.22.22 npm/? node/v22.0.0', bin: 'yarn', argv: ['add', '-D', '--', 'zod', '@scope/pkg@^1.2.3'] },
        { agent: 'bun/1.2.23', bin: 'bun', argv: ['add', '-d', '--', 'zod', '@scope/pkg@^1.2.3'] },
    ])('installPackages separates options from package specs with -- for every verified package manager: $bin', async ({ agent, bin, argv }) => {
        process.env['npm_config_user_agent'] = agent;

        await installPackages(['zod', '@scope/pkg@^1.2.3'], { cwd: '/proj', dev: true });

        expect(execa).toHaveBeenCalledWith(bin, argv, { cwd: '/proj' });
    });
});
