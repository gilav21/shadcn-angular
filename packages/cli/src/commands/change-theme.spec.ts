import { describe, it, expect, vi, beforeEach } from 'vitest';
import { changeThemeCore, VALID_THEMES } from './change-theme.js';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('fs-extra', () => ({
    default: {
        pathExists: vi.fn(() => Promise.resolve(true)),
        readFile: vi.fn(),
        writeFile: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../utils/config.js', () => ({
    getConfig: vi.fn(() => Promise.resolve({
        tailwind: { css: 'src/styles.css', baseColor: 'neutral', cssVariables: true },
        aliases: { components: '@/components', utils: '@/components/lib', ui: '@/components/ui' },
        style: 'default',
    })),
}));

vi.mock('../utils/paths.js', () => ({
    resolveProjectPath: vi.fn((_cwd: string, p: string) => `/project/${p}`),
    aliasToProjectPath: vi.fn((p: string) => p),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCss(): string {
    return `:root {
    --radius: 0.625rem;
    --density: 1;
    --background: oklch(1 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --ring: oklch(0.708 0 0);
}
.dark {
    --background: oklch(0.145 0 0);
    --primary: oklch(0.985 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --ring: oklch(0.708 0 0);
}
`;
}

interface MockFs {
    readFile: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    pathExists: ReturnType<typeof vi.fn>;
}

async function setupFs(): Promise<MockFs> {
    const fsMod = await import('fs-extra');
    const mockFs = fsMod.default as unknown as MockFs;
    vi.clearAllMocks();
    mockFs.pathExists = vi.fn(() => Promise.resolve(true));
    mockFs.readFile = vi.fn(() => Promise.resolve(makeCss()));
    mockFs.writeFile = vi.fn(() => Promise.resolve());
    return mockFs;
}

function written(mockFs: MockFs): string {
    return mockFs.writeFile.mock.calls[0][1] as string;
}

// ---------------------------------------------------------------------------
// changeThemeCore — argument validation
// ---------------------------------------------------------------------------

describe('changeThemeCore() — validation', () => {
    beforeEach(async () => {
        await setupFs();
    });

    it('rejects a name and --from together', async () => {
        await expect(changeThemeCore('rose', '/project', { from: '#3b82f6' }))
            .rejects.toThrow('not both');
    });

    it('rejects neither name nor --from', async () => {
        await expect(changeThemeCore(null, '/project')).rejects.toThrow('Missing theme');
    });

    it('rejects unknown preset names', async () => {
        await expect(changeThemeCore('magenta', '/project')).rejects.toThrow('Unknown theme');
    });

    it('rejects invalid hex colors', async () => {
        await expect(changeThemeCore(null, '/project', { from: 'bluish' }))
            .rejects.toThrow('Invalid hex color');
    });

    it('accepts every preset in VALID_THEMES', async () => {
        for (const theme of VALID_THEMES) {
            await setupFs();
            await expect(changeThemeCore(theme, '/project')).resolves.toContain(theme);
        }
    });
});

// ---------------------------------------------------------------------------
// changeThemeCore — brand color (--from)
// ---------------------------------------------------------------------------

describe('changeThemeCore() — brand color', () => {
    let mockFs: MockFs;

    beforeEach(async () => {
        mockFs = await setupFs();
    });

    it('writes a generated oklch primary into :root', async () => {
        await changeThemeCore(null, '/project', { from: '#3b82f6' });
        const css = written(mockFs);
        expect(css).not.toContain('--primary: oklch(0.205 0 0);');
        expect(css).toMatch(/--primary: oklch\(0\.6\d+ 0\.\d+ 2\d+(\.\d+)?\);/);
    });

    it('sets --ring to the same value as --primary', async () => {
        await changeThemeCore(null, '/project', { from: '#3b82f6' });
        const css = written(mockFs);
        const primary = /--primary: (oklch\([^)]*\));/.exec(css)?.[1];
        expect(primary).toBeDefined();
        expect(css).toContain(`--ring: ${primary};`);
    });

    it('does not touch --radius or --density', async () => {
        await changeThemeCore(null, '/project', { from: '#3b82f6' });
        const css = written(mockFs);
        expect(css).toContain('--radius: 0.625rem;');
        expect(css).toContain('--density: 1;');
    });

    it('returns a message naming the brand color', async () => {
        const msg = await changeThemeCore(null, '/project', { from: '#3b82f6' });
        expect(msg).toContain('#3b82f6');
        expect(msg).toContain('oklch(');
    });
});

// ---------------------------------------------------------------------------
// changeThemeCore — presets still work
// ---------------------------------------------------------------------------

describe('changeThemeCore() — presets', () => {
    let mockFs: MockFs;

    beforeEach(async () => {
        mockFs = await setupFs();
    });

    it('applies the rose preset triplet', async () => {
        await changeThemeCore('rose', '/project');
        const css = written(mockFs);
        expect(css).toContain('--primary: oklch(0.645 0.246 16.439);');
    });

    it('does not touch --radius or --density when applying a preset', async () => {
        await changeThemeCore('blue', '/project');
        const css = written(mockFs);
        expect(css).toContain('--radius: 0.625rem;');
        expect(css).toContain('--density: 1;');
    });
});
