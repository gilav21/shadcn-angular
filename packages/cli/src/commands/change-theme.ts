import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import { getConfig } from '../utils/config.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { resolveTokenCssPath } from '../utils/styles-vars.js';
import { baseColors, themeColors, type ThemeColor, type BaseColor } from '../templates/styles.js';
import { buildBrandTriplet, isValidHex } from '../utils/color.js';

export const VALID_THEMES: ThemeColor[] = [
    'zinc', 'slate', 'stone', 'gray', 'neutral',
    'red', 'rose', 'orange', 'green', 'blue', 'yellow', 'violet', 'amber',
];

function escapeRegex(text: string): string {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace a single CSS custom property in a CSS block string by name.
 * Returns the updated block or the original if the var was not found.
 */
function replaceColorVar(block: string, varName: string, value: string): string {
    return block.replace(
        new RegExp(`(${escapeRegex(varName)}\\s*:\\s*)[^;]*(;)`, 'g'),
        (_m, prefix, semi) => `${prefix}${value}${semi}`,
    );
}

/**
 * Apply a set of color vars to a CSS block string.
 * Vars not present in the block are appended before the closing brace.
 */
function applyVarsToBlock(block: string, vars: Record<string, string>): string {
    let result = block;
    const missing: string[] = [];

    for (const [varName, value] of Object.entries(vars)) {
        const pattern = new RegExp(`${escapeRegex(varName)}\\s*:\\s*[^;]*;`);
        if (pattern.test(result)) {
            result = replaceColorVar(result, varName, value);
        } else {
            missing.push(`    ${varName}: ${value};`);
        }
    }

    if (missing.length > 0) {
        const separator = result.endsWith('\n') ? '' : '\n';
        result = `${result}${separator}${missing.join('\n')}\n`;
    }

    return result;
}

/**
 * Replace a CSS block (matched by selector) in a full CSS string.
 * Returns the updated full string.
 */
function replaceBlock(
    css: string,
    selector: string,
    vars: Record<string, string>,
): string {
    const blockPattern = new RegExp(`(${escapeRegex(selector)}\\s*\\{)([\\s\\S]*?)(\\})`, 'm');
    const match = blockPattern.exec(css);
    if (!match) {
        return css;
    }
    const [fullMatch, openBrace, inner, closeBrace] = match;
    const updatedInner = applyVarsToBlock(inner, vars);
    return css.replace(fullMatch, `${openBrace}${updatedInner}${closeBrace}`);
}

/**
 * Core change-theme logic — no chalk/ora.
 *
 * Strategy: replace ONLY the color CSS custom properties in :root and .dark.
 * Does NOT touch --radius, --density, --motion, --chart-*, --sidebar-*.
 *
 * For themes with a baseColors entry (neutral, slate, stone, gray, zinc):
 *   - replaces both base colors + theme triplet
 * For accent-only themes (red, rose, orange, green, blue, yellow, violet, amber):
 *   - replaces only the theme triplet (--primary, --primary-foreground, --ring)
 *   - base colors are inherited from the project's configured baseColor
 * With `opts.from` (a brand hex color):
 *   - generates the triplet from the hex instead of a preset; base colors are
 *     inherited from the project's configured baseColor
 */
export async function changeThemeCore(
    themeName: string | null,
    cwd: string,
    opts: { from?: string } = {},
): Promise<string> {
    if (themeName && opts.from) {
        throw new Error('Pass either a theme name or --from <hex>, not both.');
    }
    if (!themeName && !opts.from) {
        throw new Error(
            `Missing theme. Pass a preset name (${VALID_THEMES.join(', ')}) or --from "#hex".`,
        );
    }
    if (themeName && !VALID_THEMES.includes(themeName as ThemeColor)) {
        throw new Error(
            `Unknown theme "${themeName}". Valid themes: ${VALID_THEMES.join(', ')}`,
        );
    }
    if (opts.from && !isValidHex(opts.from)) {
        throw new Error(`Invalid hex color "${opts.from}" — expected #rgb or #rrggbb.`);
    }

    const config = await getConfig(cwd);
    if (!config) {
        throw new Error('Project not initialized — run shadcn-angular init first.');
    }

    const cssPath = await resolveTokenCssPath(resolveProjectPath(cwd, aliasToProjectPath(config.tailwind.css)));
    if (!await fs.pathExists(cssPath)) {
        throw new Error(`CSS file not found: ${cssPath}`);
    }

    let css = await fs.readFile(cssPath, 'utf-8');

    const theme = themeName as ThemeColor | null;
    const isBaseTheme = theme !== null && theme in baseColors;
    const baseColor: BaseColor = config.tailwind.baseColor ?? 'neutral';

    // Build light vars: base colors + theme triplet
    const lightVars: Record<string, string> = {};
    const darkVars: Record<string, string> = {};

    if (isBaseTheme) {
        const base = baseColors[theme as BaseColor];
        Object.assign(lightVars, base.light);
        Object.assign(darkVars, base.dark);
    } else {
        // For accent-only and brand themes, use the project's configured base color
        const base = baseColors[baseColor];
        Object.assign(lightVars, base.light);
        Object.assign(darkVars, base.dark);
    }

    // Always apply the theme triplet
    const triplet = theme ? themeColors[theme] : buildBrandTriplet(opts.from as string);
    Object.assign(lightVars, triplet.light);
    Object.assign(darkVars, triplet.dark);

    css = replaceBlock(css, ':root', lightVars);
    css = replaceBlock(css, '.dark', darkVars);

    await fs.writeFile(cssPath, css, 'utf-8');

    return theme
        ? `Changed theme to "${theme}"`
        : `Changed theme to brand color ${opts.from} (${triplet.light['--primary']})`;
}

interface ChangeThemeOptions {
    readonly from?: string;
}

export async function changeTheme(
    name: string | undefined,
    options: ChangeThemeOptions = {},
    cwd = process.cwd(),
): Promise<void> {
    const label = name ?? options.from ?? '';
    const spinner = ora(`Applying theme "${label}"…`).start();
    try {
        const message = await changeThemeCore(name ?? null, cwd, { from: options.from });
        spinner.succeed(chalk.green(message));
    } catch (error) {
        spinner.fail(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
}
