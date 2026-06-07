import { describe, it, expect, vi, beforeEach } from 'vitest';
import { densityMultiplier, setDensityCore, DENSITY_MULTIPLIERS, COMPONENT_DENSITY_VARS } from './set-density.js';

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

function makeCss(extraVars = ''): string {
    return `:root {\n    --radius: 0.625rem;\n    --density: 1;${extraVars}\n    --background: oklch(1 0 0);\n}\n.dark {\n    --background: oklch(0.145 0 0);\n}\n`;
}

// ---------------------------------------------------------------------------
// densityMultiplier
// ---------------------------------------------------------------------------

describe('densityMultiplier()', () => {
    it('maps each level to the correct multiplier', () => {
        expect(densityMultiplier(1)).toBe(0.75);
        expect(densityMultiplier(2)).toBe(0.875);
        expect(densityMultiplier(3)).toBe(1);
        expect(densityMultiplier(4)).toBe(1.125);
        expect(densityMultiplier(5)).toBe(1.25);
    });

    it('returns null for invalid levels', () => {
        expect(densityMultiplier(0)).toBeNull();
        expect(densityMultiplier(6)).toBeNull();
        expect(densityMultiplier(-1)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// DENSITY_MULTIPLIERS / COMPONENT_DENSITY_VARS constants
// ---------------------------------------------------------------------------

describe('DENSITY_MULTIPLIERS', () => {
    it('has exactly 5 entries for levels 1–5', () => {
        expect(Object.keys(DENSITY_MULTIPLIERS)).toHaveLength(5);
        for (let i = 1; i <= 5; i++) {
            expect(DENSITY_MULTIPLIERS[i]).toBeDefined();
        }
    });
});

describe('COMPONENT_DENSITY_VARS', () => {
    it('maps component names to --density-<name> vars', () => {
        expect(COMPONENT_DENSITY_VARS['button']).toBe('--density-button');
        expect(COMPONENT_DENSITY_VARS['input']).toBe('--density-input');
        expect(COMPONENT_DENSITY_VARS['card']).toBe('--density-card');
    });
});

// ---------------------------------------------------------------------------
// setDensityCore — global density
// ---------------------------------------------------------------------------

describe('setDensityCore() — global density', () => {
    let mockFs: { readFile: ReturnType<typeof vi.fn>; writeFile: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        const fsMod = await import('fs-extra');
        mockFs = fsMod.default as unknown as typeof mockFs;
        vi.clearAllMocks();
    });

    it('writes the correct multiplier for each level', async () => {
        const cases: [number, string][] = [
            [1, '0.75'], [2, '0.875'], [3, '1'], [4, '1.125'], [5, '1.25'],
        ];

        for (const [level, expected] of cases) {
            mockFs.readFile = vi.fn(() => Promise.resolve(makeCss()));
            mockFs.writeFile = vi.fn(() => Promise.resolve());

            await setDensityCore(level, undefined, '/project');

            const written = (mockFs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
            expect(written).toContain(`--density: ${expected};`);
        }
    });

    it('throws for invalid levels', async () => {
        await expect(setDensityCore(0, undefined, '/project')).rejects.toThrow('1–5');
        await expect(setDensityCore(6, undefined, '/project')).rejects.toThrow('1–5');
    });

    it('returns a success message containing the level and multiplier', async () => {
        mockFs.readFile = vi.fn(() => Promise.resolve(makeCss()));
        mockFs.writeFile = vi.fn(() => Promise.resolve());

        const msg = await setDensityCore(3, undefined, '/project');
        expect(msg).toContain('3');
        expect(msg).toContain('1');
    });
});

// ---------------------------------------------------------------------------
// setDensityCore — per-component density (uncomment path)
// ---------------------------------------------------------------------------

describe('setDensityCore() — per-component density', () => {
    let mockFs: { readFile: ReturnType<typeof vi.fn>; writeFile: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        const fsMod = await import('fs-extra');
        mockFs = fsMod.default as unknown as typeof mockFs;
        vi.clearAllMocks();
    });

    it('uncomments a commented-out per-component density var and sets the value', async () => {
        const cssWithComment = makeCss('\n    /* --density-button:   1; */');
        mockFs.readFile = vi.fn(() => Promise.resolve(cssWithComment));
        mockFs.writeFile = vi.fn(() => Promise.resolve());

        await setDensityCore(1, ['button'], '/project');

        const written = (mockFs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
        // The commented line should be uncommented and value set
        expect(written).toContain('--density-button:');
        expect(written).toContain('0.75');
        // Should NOT still be commented
        expect(written).not.toMatch(/\/\*.*--density-button.*\*\//);
    });

    it('sets an already-uncommented per-component density var', async () => {
        const cssWithVar = makeCss('\n    --density-button: 1;');
        mockFs.readFile = vi.fn(() => Promise.resolve(cssWithVar));
        mockFs.writeFile = vi.fn(() => Promise.resolve());

        await setDensityCore(5, ['button'], '/project');

        const written = (mockFs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
        expect(written).toContain('--density-button: 1.25;');
    });

    it('appends a per-component var if not present in the file', async () => {
        mockFs.readFile = vi.fn(() => Promise.resolve(makeCss()));
        mockFs.writeFile = vi.fn(() => Promise.resolve());

        // 'table' is not in the default makeCss, so it should be appended
        await setDensityCore(2, ['table'], '/project');

        const written = (mockFs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
        expect(written).toContain('--density-table: 0.875;');
    });

    it('throws for unknown component names', async () => {
        await expect(setDensityCore(3, ['unknown-widget'], '/project')).rejects.toThrow('Unknown component');
    });

    it('handles multiple components in one call', async () => {
        mockFs.readFile = vi.fn(() => Promise.resolve(makeCss()));
        mockFs.writeFile = vi.fn(() => Promise.resolve());

        await setDensityCore(4, ['button', 'input'], '/project');

        // writeFile is called once per component
        expect((mockFs.writeFile as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });
});
