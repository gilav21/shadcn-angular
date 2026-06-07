import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../utils/config.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { setRootVar } from '../utils/styles-vars.js';

/** Motion level → multiplier map. */
export const MOTION_MULTIPLIERS: Record<number, number> = {
    0: 0,
    1: 1,
    2: 1.5,
};

export const MOTION_LABELS: Record<number, string> = {
    0: 'no motion',
    1: 'default',
    2: 'expressive',
};

/**
 * Returns the multiplier for a given level, or null if invalid.
 */
export function motionMultiplier(level: number): number | null {
    return MOTION_MULTIPLIERS[level] ?? null;
}

/**
 * Core motion-setting logic — no chalk/ora.
 */
export async function setMotionCore(level: number, cwd: string): Promise<string> {
    const multiplier = motionMultiplier(level);
    if (multiplier === null) {
        throw new Error(`Invalid motion level "${level}" — must be 0 (none), 1 (default), or 2 (expressive).`);
    }

    const config = await getConfig(cwd);
    if (!config) {
        throw new Error('Project not initialized — run shadcn-angular init first.');
    }

    const cssPath = resolveProjectPath(cwd, aliasToProjectPath(config.tailwind.css));
    await setRootVar(cssPath, '--motion', String(multiplier));

    const label = MOTION_LABELS[level];
    return `Set --motion to ${multiplier} (${label})`;
}

export async function setMotion(level: string, cwd = process.cwd()): Promise<void> {
    const levelNum = Number.parseInt(level, 10);
    if (Number.isNaN(levelNum) || !(levelNum in MOTION_MULTIPLIERS)) {
        console.error(chalk.red(`Error: motion level must be 0, 1, or 2. Got: "${level}"`));
        process.exit(1);
    }

    const spinner = ora('Updating motion…').start();
    try {
        const message = await setMotionCore(levelNum, cwd);
        spinner.succeed(chalk.green(message));
    } catch (error) {
        spinner.fail(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
}
