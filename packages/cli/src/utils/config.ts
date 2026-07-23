import fs from 'fs-extra';
import path from 'node:path';
import { DEFAULT_PREFIX, isValidPrefix } from './prefix.js';

export interface Config {
    style: 'default';
    registry?: string;
    /**
     * Component selector prefix used when components are copied into the
     * user's project. Defaults to `'ui'` (matches the source library).
     * Set this to e.g. `'acme'` to make `<ui-button>` render as
     * `<acme-button>` in the copied source.
     */
    prefix?: string;
    tailwind: {
        css: string;
        baseColor: 'neutral' | 'slate' | 'stone' | 'gray' | 'zinc';
        theme?: 'zinc' | 'slate' | 'stone' | 'gray' | 'neutral' | 'red' | 'rose' | 'orange' | 'green' | 'blue' | 'yellow' | 'violet' | 'amber';
        cssVariables: boolean;
    };
    aliases: {
        components: string;
        utils: string;
        ui: string;
        /** Destination for installed blocks. Defaults to `@/blocks`. */
        blocks?: string;
    };
    /**
     * Update-command defaults. `overwrite: true` makes `update`/`apply` take the
     * upstream version whole-file (no 3-way merge) unless a CLI flag overrides it.
     */
    update?: {
        overwrite?: boolean;
    };
    /**
     * Test-shipping defaults for `add`/`update`. `include: true` makes every
     * install also copy the component's portable spec files; `runner` selects
     * the consumer test runner the specs are transformed for (`'jest'` rewrites
     * the vitest import to the installed vitest-compat shim).
     */
    tests?: {
        include?: boolean;
        runner?: TestRunner;
    };
}

/** Consumer test runners the shipped specs support. */
export type TestRunner = 'vitest' | 'jest';

export const TEST_RUNNERS: readonly TestRunner[] = ['vitest', 'jest'];

export function isTestRunner(value: unknown): value is TestRunner {
    return TEST_RUNNERS.includes(value as TestRunner);
}

/** Returns the configured prefix or the default when none is set. */
export function getPrefix(config: Pick<Config, 'prefix'>): string {
    return config.prefix ?? DEFAULT_PREFIX;
}

/** Returns the configured blocks alias or the default when none is set. */
export function getBlocksAlias(config: Pick<Config, 'aliases'>): string {
    return config.aliases.blocks ?? '@/blocks';
}

export function getDefaultConfig(): Config {
    return {
        style: 'default',
        tailwind: {
            css: 'src/styles.scss',
            baseColor: 'neutral',
            theme: 'zinc',
            cssVariables: true,
        },
        aliases: {
            components: '@/components',
            utils: '@/components/lib',
            ui: '@/components/ui',
            blocks: '@/blocks',
        },
    };
}

function validateTailwind(obj: Record<string, unknown>): boolean {
    if (!obj['tailwind'] || typeof obj['tailwind'] !== 'object') return false;
    const tw = obj['tailwind'] as Record<string, unknown>;
    return typeof tw['css'] === 'string' && typeof tw['baseColor'] === 'string';
}

function validateAliases(obj: Record<string, unknown>): boolean {
    if (!obj['aliases'] || typeof obj['aliases'] !== 'object') return false;
    const aliases = obj['aliases'] as Record<string, unknown>;
    if (typeof aliases['components'] !== 'string' || typeof aliases['utils'] !== 'string' || typeof aliases['ui'] !== 'string') return false;
    if ('blocks' in aliases && aliases['blocks'] !== undefined && typeof aliases['blocks'] !== 'string') return false;
    return true;
}

function validateUpdate(obj: Record<string, unknown>): boolean {
    if (!('update' in obj) || obj['update'] === undefined) return true;
    if (typeof obj['update'] !== 'object' || obj['update'] === null) return false;
    const upd = obj['update'] as Record<string, unknown>;
    return !('overwrite' in upd) || upd['overwrite'] === undefined || typeof upd['overwrite'] === 'boolean';
}

function validateTests(obj: Record<string, unknown>): boolean {
    if (!('tests' in obj) || obj['tests'] === undefined) return true;
    if (typeof obj['tests'] !== 'object' || obj['tests'] === null) return false;
    const tests = obj['tests'] as Record<string, unknown>;
    if ('include' in tests && tests['include'] !== undefined && typeof tests['include'] !== 'boolean') return false;
    return !('runner' in tests) || tests['runner'] === undefined || isTestRunner(tests['runner']);
}

function validateConfig(data: unknown): data is Config {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    if (!validateTailwind(obj)) return false;
    if (!validateAliases(obj)) return false;
    if ('prefix' in obj && obj['prefix'] !== undefined && !isValidPrefix(obj['prefix'])) return false;
    if (!validateUpdate(obj)) return false;
    return validateTests(obj);
}

export async function getConfig(cwd: string): Promise<Config | null> {
    const configPath = path.join(cwd, 'components.json');

    if (!await fs.pathExists(configPath)) {
        return null;
    }

    try {
        const data: unknown = await fs.readJson(configPath);
        if (!validateConfig(data)) {
            console.error('Error: components.json is missing required fields (tailwind.css, tailwind.baseColor, aliases.components, aliases.utils, aliases.ui).');
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

export async function writeConfig(cwd: string, config: Config): Promise<void> {
    const configPath = path.join(cwd, 'components.json');
    await fs.writeJson(configPath, config, { spaces: 2 });
}
