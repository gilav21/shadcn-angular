import chalk from 'chalk';
import fs from 'fs-extra';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { readRootVar, resolveTokenCssPath } from '../utils/styles-vars.js';
import { DENSITY_MULTIPLIERS, COMPONENT_DENSITY_VARS } from './set-density.js';
import { MOTION_MULTIPLIERS, MOTION_LABELS } from './set-motion.js';
import { RADIUS_NAMED } from './set-radius.js';
import { collectDoctorReport, installedComponents } from './doctor.js';
import { baseColors, themeColors, type BaseColor, type ThemeColor } from '../templates/styles.js';
import type { AddOptions } from '../core/plan.js';

export interface StatusReport {
    tokens: {
        density: {
            value: string | null;
            /** Level 1–5 when the value matches a standard multiplier, else null. */
            level: number | null;
            /** Uncommented per-component --density-* overrides (component → value). */
            overrides: Record<string, string>;
        };
        radius: {
            value: string | null;
            /** Named radius (none/sm/md/lg/xl/full) when the value matches one, else null. */
            named: string | null;
        };
        motion: {
            value: string | null;
            /** Label for a standard motion multiplier (no motion/default/expressive), else null. */
            label: string | null;
        };
        theme: {
            /** Matched preset name, "custom" for an unrecognized --primary, or "unknown" when unset. */
            name: string;
            primary: string | null;
        };
    };
    components: {
        installed: number;
        missingFiles: string[];
        userEdited: string[];
        updateAvailable: string[];
        legacy: string[];
        missingNpmDeps: string[];
        healthy: boolean;
    };
    config: {
        prefix: string;
        css: string;
        baseColor: string;
        registry: string | null;
        aliases: Config['aliases'];
    };
}

/** Reverse-map a CSS multiplier value to its level in a level→multiplier map. */
function levelForMultiplier(map: Record<number, number>, value: string | null): number | null {
    if (value === null) return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    for (const [level, multiplier] of Object.entries(map)) {
        if (multiplier === num) return Number(level);
    }
    return null;
}

/** Reverse-map a raw radius value to its named alias, if any. */
function namedRadius(value: string | null): string | null {
    if (value === null) return null;
    for (const [name, raw] of Object.entries(RADIUS_NAMED)) {
        if (raw === value) return name;
    }
    return null;
}

/**
 * Detect the theme preset from the :root --primary value.
 * zinc and neutral share an identical triplet, so ties are broken by the
 * configured theme first, then by matching the base palette's --foreground.
 */
export function detectTheme(
    primary: string | null,
    foreground: string | null,
    configuredTheme: string | undefined,
): string {
    if (!primary) return 'unknown';
    const candidates = (Object.keys(themeColors) as ThemeColor[])
        .filter(t => themeColors[t].light['--primary'] === primary);
    if (candidates.length === 0) return 'custom';
    if (candidates.length === 1) return candidates[0];

    if (configuredTheme && candidates.includes(configuredTheme as ThemeColor)) {
        return configuredTheme;
    }
    const byBase = candidates.find(t =>
        t in baseColors && baseColors[t as BaseColor].light['--foreground'] === foreground);
    return byBase ?? candidates[0];
}

function collectDensityOverrides(css: string): Record<string, string> {
    const overrides: Record<string, string> = {};
    for (const [component, varName] of Object.entries(COMPONENT_DENSITY_VARS)) {
        const value = readRootVar(css, varName);
        if (value !== null) overrides[component] = value;
    }
    return overrides;
}

async function readCss(cssFile: string): Promise<string> {
    if (await fs.pathExists(cssFile)) {
        return fs.readFile(cssFile, 'utf-8');
    }
    return '';
}

function buildTokens(css: string, configuredTheme: string | undefined): StatusReport['tokens'] {
    const density = readRootVar(css, '--density');
    const radius = readRootVar(css, '--radius');
    const motion = readRootVar(css, '--motion');
    const primary = readRootVar(css, '--primary');
    const foreground = readRootVar(css, '--foreground');
    const motionLevel = levelForMultiplier(MOTION_MULTIPLIERS, motion);
    return {
        density: {
            value: density,
            level: levelForMultiplier(DENSITY_MULTIPLIERS, density),
            overrides: collectDensityOverrides(css),
        },
        radius: { value: radius, named: namedRadius(radius) },
        motion: { value: motion, label: motionLevel === null ? null : MOTION_LABELS[motionLevel] },
        theme: { name: detectTheme(primary, foreground, configuredTheme), primary },
    };
}

/**
 * Core status logic — no chalk/ora. Read-only: collects design tokens from the
 * project's CSS, component health from the doctor report, and config basics.
 */
export async function statusCore(cwd: string, options: AddOptions): Promise<StatusReport> {
    const config = await getConfig(cwd);
    if (!config) {
        throw new Error('Project not initialized — run shadcn-angular init first.');
    }
    const opts: AddOptions = { ...options, registry: options.registry ?? config.registry };

    const cssPath = await resolveTokenCssPath(resolveProjectPath(cwd, aliasToProjectPath(config.tailwind.css)));
    const css = await readCss(cssPath);

    const report = await collectDoctorReport(cwd, config, opts);
    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const installed = await installedComponents(targetDir);

    return {
        tokens: buildTokens(css, config.tailwind.theme),
        components: {
            installed: installed.length,
            missingFiles: report.missingFiles,
            userEdited: report.userEdited,
            updateAvailable: report.updateAvailable,
            legacy: report.legacy,
            missingNpmDeps: report.missingNpmDeps,
            healthy: report.ok,
        },
        config: {
            prefix: getPrefix(config),
            css: config.tailwind.css,
            baseColor: config.tailwind.baseColor,
            registry: config.registry ?? null,
            aliases: config.aliases,
        },
    };
}

function tokenLine(label: string, value: string | null, extra?: string | null): void {
    const display = value === null ? chalk.dim('(not set)') : chalk.cyan(value);
    const suffix = extra ? chalk.gray(` — ${extra}`) : '';
    console.log(`  ${label.padEnd(10)} ${display}${suffix}`);
}

function listLine(label: string, items: string[], colorFn: (s: string) => string): void {
    if (items.length === 0) return;
    const count = chalk.gray(`(${items.length})`);
    console.log(`  ${colorFn(label)} ${count}: ${items.join(', ')}`);
}

function printTokens(tokens: StatusReport['tokens']): void {
    console.log('\n' + chalk.bold('Design tokens'));
    tokenLine('density', tokens.density.value, tokens.density.level === null ? null : `level ${tokens.density.level}`);
    for (const [component, value] of Object.entries(tokens.density.overrides)) {
        tokenLine(`  ↳ ${component}`, value);
    }
    tokenLine('radius', tokens.radius.value, tokens.radius.named);
    tokenLine('motion', tokens.motion.value, tokens.motion.label);
    tokenLine('theme', tokens.theme.name, tokens.theme.primary);
}

function printComponents(components: StatusReport['components']): void {
    console.log('\n' + chalk.bold('Components') + chalk.gray(` (${components.installed} installed)`));
    if (components.healthy) {
        console.log('  ' + chalk.green('All installed components are healthy.'));
        return;
    }
    listLine('Missing files', components.missingFiles, chalk.yellow);
    listLine('Locally modified (your edits)', components.userEdited, chalk.yellow);
    listLine('Update available', components.updateAvailable, chalk.cyan);
    listLine('Legacy layout — run `migrate`', components.legacy, chalk.magenta);
    listLine('Missing npm deps', components.missingNpmDeps, chalk.red);
}

function printConfig(config: StatusReport['config']): void {
    console.log('\n' + chalk.bold('Config'));
    tokenLine('prefix', config.prefix);
    tokenLine('css', config.css);
    tokenLine('baseColor', config.baseColor);
    tokenLine('registry', config.registry, config.registry ? null : 'default GitHub registry');
    tokenLine('ui alias', config.aliases.ui);
    console.log('');
}

interface StatusOptions extends AddOptions {
    json?: boolean;
}

export async function status(options: StatusOptions): Promise<void> {
    const cwd = process.cwd();
    try {
        const report = await statusCore(cwd, options);
        if (options.json) {
            console.log(JSON.stringify(report, null, 2));
            return;
        }
        printTokens(report.tokens);
        printComponents(report.components);
        printConfig(report.config);
    } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
}
