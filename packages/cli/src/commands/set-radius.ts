import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../utils/config.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { setRootVar } from '../utils/styles-vars.js';

/** Named radius → rem/px value map. */
export const RADIUS_NAMED: Record<string, string> = {
    none: '0rem',
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.625rem',
    xl: '0.75rem',
    full: '9999px',
};

/** Validates a raw CSS length value (rem or px). Returns true if safe to use. */
export function isValidRadiusValue(value: string): boolean {
    return /^[\d.]+(?:rem|px)$/.test(value) && !value.includes(';') && !value.includes('}');
}

/**
 * Resolve a named or raw radius value, returning the CSS string.
 * Throws if the value is unrecognized or unsafe.
 */
export function resolveRadiusValue(input: string): string {
    if (RADIUS_NAMED[input] !== undefined) {
        return RADIUS_NAMED[input];
    }
    if (isValidRadiusValue(input)) {
        return input;
    }
    throw new Error(
        `Invalid radius value "${input}". Use a named value (${Object.keys(RADIUS_NAMED).join(', ')}) or a raw value like "0.5rem" or "8px".`,
    );
}

/**
 * Core radius-setting logic — no chalk/ora.
 */
export async function setRadiusCore(input: string, cwd: string): Promise<string> {
    const value = resolveRadiusValue(input);

    const config = await getConfig(cwd);
    if (!config) {
        throw new Error('Project not initialized — run shadcn-angular init first.');
    }

    const cssPath = resolveProjectPath(cwd, aliasToProjectPath(config.tailwind.css));
    await setRootVar(cssPath, '--radius', value);
    return `Set --radius to ${value}`;
}

export async function setRadius(input: string, cwd = process.cwd()): Promise<void> {
    const spinner = ora('Updating radius…').start();
    try {
        const message = await setRadiusCore(input, cwd);
        spinner.succeed(chalk.green(message));
    } catch (error) {
        spinner.fail(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
}
