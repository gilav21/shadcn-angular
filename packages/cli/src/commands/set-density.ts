import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../utils/config.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { setRootVar, resolveTokenCssPath } from '../utils/styles-vars.js';

/** Density level → multiplier map. */
export const DENSITY_MULTIPLIERS: Record<number, number> = {
    1: 0.75,
    2: 0.875,
    3: 1,
    4: 1.125,
    5: 1.25,
};

/** Per-component density var names that can be overridden. */
export const COMPONENT_DENSITY_VARS: Record<string, string> = {
    button: '--density-button',
    input: '--density-input',
    select: '--density-select',
    card: '--density-card',
    badge: '--density-badge',
    avatar: '--density-avatar',
    table: '--density-table',
    tabs: '--density-tabs',
    checkbox: '--density-checkbox',
    switch: '--density-switch',
    menu: '--density-menu',
    dialog: '--density-dialog',
    accordion: '--density-accordion',
    radio: '--density-radio',
    slider: '--density-slider',
    picker: '--density-picker',
    popover: '--density-popover',
};

/**
 * Pure logic: returns the multiplier for a given level, or null if invalid.
 */
export function densityMultiplier(level: number): number | null {
    return DENSITY_MULTIPLIERS[level] ?? null;
}

/**
 * Core density-setting logic — no chalk/ora. Used by both the CLI command and
 * the MCP tool.
 */
export async function setDensityCore(
    level: number,
    components: string[] | undefined,
    cwd: string,
): Promise<string> {
    const multiplier = densityMultiplier(level);
    if (multiplier === null) {
        throw new Error(`Invalid density level "${level}" — must be an integer 1–5.`);
    }

    const config = await getConfig(cwd);
    if (!config) {
        throw new Error('Project not initialized — run shadcn-angular init first.');
    }

    const cssPath = await resolveTokenCssPath(resolveProjectPath(cwd, aliasToProjectPath(config.tailwind.css)));

    if (components && components.length > 0) {
        for (const name of components) {
            const varName = COMPONENT_DENSITY_VARS[name];
            if (!varName) {
                throw new Error(
                    `Unknown component "${name}". Valid components: ${Object.keys(COMPONENT_DENSITY_VARS).join(', ')}`,
                );
            }
            await setRootVar(cssPath, varName, String(multiplier));
        }
        return `Set density level ${level} (${multiplier}) for: ${components.join(', ')}`;
    }

    await setRootVar(cssPath, '--density', String(multiplier));
    return `Set global density level ${level} (${multiplier})`;
}

interface SetDensityOptions {
    readonly component?: string;
}

export async function setDensity(
    level: string,
    options: SetDensityOptions,
    cwd = process.cwd(),
): Promise<void> {
    const levelNum = Number.parseInt(level, 10);
    if (Number.isNaN(levelNum) || levelNum < 1 || levelNum > 5) {
        console.error(chalk.red(`Error: density level must be an integer 1–5. Got: "${level}"`));
        process.exit(1);
    }

    const components = options.component
        ? options.component.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

    const spinner = ora('Updating density…').start();
    try {
        const message = await setDensityCore(levelNum, components, cwd);
        spinner.succeed(chalk.green(message));
    } catch (error) {
        spinner.fail(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
}
