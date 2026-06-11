import fs from 'fs-extra';
import path from 'node:path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { getDefaultConfig, type Config } from '../utils/config.js';
import { DEFAULT_PREFIX, isValidPrefix } from '../utils/prefix.js';
import { initProject, toAlias } from '../core/init-core.js';
import { setDensityCore, DENSITY_MULTIPLIERS } from './set-density.js';
import { setRadiusCore, resolveRadiusValue } from './set-radius.js';
import { setMotionCore, MOTION_MULTIPLIERS } from './set-motion.js';
import { changeThemeCore, VALID_THEMES } from './change-theme.js';
import { setLocaleCore, isValidLocaleCode } from './set-locale.js';
import { isValidHex } from '../utils/color.js';
import type { ThemeColor } from '../templates/styles.js';

const onCancel = (): void => {
    console.log(chalk.dim('\nCancelled.'));
    process.exit(0);
};

interface InitOptions {
    yes?: boolean;
    defaults?: boolean;
    remote?: boolean;
    branch: string;
    registry?: string;
    prefix?: string;
    density?: string;
    radius?: string;
    motion?: string;
    theme?: string;
    themeFrom?: string;
    locale?: string;
}

/** Design defaults applied after the project files are written. */
export interface InitDefaults {
    density?: number;
    radius?: string;
    motion?: number;
    themeFrom?: string;
    locale?: string;
}

function parseLevelFlag(raw: string, valid: Record<number, number>, flag: string, hint: string): number {
    const level = Number.parseInt(raw, 10);
    if (Number.isNaN(level) || !(level in valid)) {
        throw new Error(`Invalid ${flag} "${raw}" — ${hint}`);
    }
    return level;
}

function validateThemeFlags(options: InitOptions): void {
    if (options.theme !== undefined && options.themeFrom !== undefined) {
        throw new Error('Pass either --theme or --theme-from, not both.');
    }
    if (options.theme !== undefined && !VALID_THEMES.includes(options.theme as ThemeColor)) {
        throw new Error(`Invalid --theme "${options.theme}". Valid themes: ${VALID_THEMES.join(', ')}`);
    }
    if (options.themeFrom !== undefined && !isValidHex(options.themeFrom)) {
        throw new Error(`Invalid --theme-from "${options.themeFrom}" — use a hex color like "#3b82f6".`);
    }
}

/**
 * Validates the design-default flags and returns the normalized set.
 * Throws on the first invalid value so init fails before writing anything.
 */
export function parseInitDefaults(options: InitOptions): InitDefaults {
    validateThemeFlags(options);

    const defaults: InitDefaults = {};
    if (options.themeFrom !== undefined) {
        defaults.themeFrom = options.themeFrom;
    }
    if (options.density !== undefined) {
        defaults.density = parseLevelFlag(options.density, DENSITY_MULTIPLIERS, '--density', 'must be an integer 1–5.');
    }
    if (options.radius !== undefined) {
        resolveRadiusValue(options.radius);
        defaults.radius = options.radius;
    }
    if (options.motion !== undefined) {
        defaults.motion = parseLevelFlag(options.motion, MOTION_MULTIPLIERS, '--motion', 'must be 0, 1, or 2.');
    }
    if (options.locale !== undefined) {
        if (!isValidLocaleCode(options.locale)) {
            throw new Error(`Invalid --locale "${options.locale}" — use a BCP-47 code like "en", "he", or "pt-BR".`);
        }
        defaults.locale = options.locale;
    }
    return defaults;
}

/**
 * Applies design defaults to a freshly initialized project by reusing the
 * standalone command cores. Returns the messages of the applied steps.
 */
export async function applyInitDefaults(
    cwd: string,
    defaults: InitDefaults,
    fetchOptions: { branch: string; remote?: boolean; registry?: string },
): Promise<string[]> {
    const messages: string[] = [];
    if (defaults.themeFrom !== undefined) {
        messages.push(await changeThemeCore(null, cwd, { from: defaults.themeFrom }));
    }
    if (defaults.density !== undefined) {
        messages.push(await setDensityCore(defaults.density, undefined, cwd));
    }
    if (defaults.radius !== undefined) {
        messages.push(await setRadiusCore(defaults.radius, cwd));
    }
    if (defaults.motion !== undefined) {
        messages.push(await setMotionCore(defaults.motion, cwd));
    }
    if (defaults.locale !== undefined) {
        messages.push(await setLocaleCore(defaults.locale, cwd, fetchOptions));
    }
    return messages;
}

function hasAnyDefaultFlag(options: InitOptions): boolean {
    return options.density !== undefined || options.radius !== undefined
        || options.motion !== undefined || options.themeFrom !== undefined
        || options.locale !== undefined;
}

const DEFAULT_PROMPTS_QUESTIONS = [
    {
        type: 'select' as const,
        name: 'density',
        message: 'Density level:',
        choices: [
            { title: '1 — ultra-compact', value: 1 },
            { title: '2 — compact', value: 2 },
            { title: '3 — default', value: 3 },
            { title: '4 — comfortable', value: 4 },
            { title: '5 — spacious', value: 5 },
        ],
        initial: 2,
    },
    {
        type: 'select' as const,
        name: 'radius',
        message: 'Border radius:',
        choices: [
            { title: 'none (0rem)', value: 'none' },
            { title: 'sm (0.25rem)', value: 'sm' },
            { title: 'md (0.375rem)', value: 'md' },
            { title: 'lg (0.625rem) — default', value: 'lg' },
            { title: 'xl (0.75rem)', value: 'xl' },
            { title: 'full (9999px)', value: 'full' },
        ],
        initial: 3,
    },
    {
        type: 'select' as const,
        name: 'motion',
        message: 'Motion level:',
        choices: [
            { title: '0 — no motion', value: 0 },
            { title: '1 — default', value: 1 },
            { title: '2 — expressive', value: 2 },
        ],
        initial: 1,
    },
    {
        type: 'text' as const,
        name: 'locale',
        message: 'Default UI locale (BCP-47 code):',
        initial: 'en',
        validate: (value: string) =>
            isValidLocaleCode(value) ? true : 'Use a BCP-47 code like "en", "he", or "pt-BR".',
    },
];

async function promptForDefaults(): Promise<InitDefaults> {
    const { configure } = await prompts({
        type: 'confirm',
        name: 'configure',
        message: 'Configure design defaults now? (density, radius, motion, locale)',
        initial: false,
    }, { onCancel });
    if (!configure) return {};

    const responses = await prompts(DEFAULT_PROMPTS_QUESTIONS, { onCancel });

    const defaults: InitDefaults = {};
    if (responses.density !== 3) defaults.density = responses.density;
    if (responses.radius !== 'lg') defaults.radius = responses.radius;
    if (responses.motion !== 1) defaults.motion = responses.motion;
    if (responses.locale !== 'en') defaults.locale = responses.locale;
    return defaults;
}

interface InitConfig {
    readonly config: Config;
    readonly createShortcutRegistry: boolean;
}

const THEME_COLORS: Record<string, string> = {
    zinc: '#71717a', slate: '#64748b', stone: '#78716c',
    gray: '#6b7280', neutral: '#737373', red: '#ef4444',
    rose: '#f43f5e', orange: '#f97316', green: '#22c55e',
    blue: '#3b82f6', yellow: '#eab308', violet: '#8b5cf6',
    amber: '#d97706',
};

function colorSwatch(value: string, label: string): string {
    return `${chalk.hex(THEME_COLORS[value])('██')} ${label}`;
}

function buildColorChoices(labels: string[]): { title: string; value: string }[] {
    return labels.map(label => ({ title: colorSwatch(label.toLowerCase(), label), value: label.toLowerCase() }));
}

function buildConfigFromResponses(responses: Record<string, string | boolean>): InitConfig {
    const componentsAlias = toAlias(responses['componentsPath'] as string);
    const uiAlias = componentsAlias.endsWith('/ui') ? componentsAlias : componentsAlias + '/ui';
    return {
        config: {
            style: 'default',
            prefix: responses['prefix'] as string,
            tailwind: {
                css: responses['globalCss'] as string,
                baseColor: responses['baseColor'] as Config['tailwind']['baseColor'],
                theme: responses['theme'] as Config['tailwind']['theme'],
                cssVariables: true,
            },
            aliases: {
                components: componentsAlias.replace(/\/ui$/, ''),
                utils: toAlias(responses['utilsPath'] as string),
                ui: uiAlias,
                blocks: toAlias(responses['blocksPath'] as string),
            },
        },
        createShortcutRegistry: (responses['createShortcutRegistry'] ?? true) as boolean,
    };
}

async function promptForConfig(initialPrefix: string): Promise<InitConfig> {
    const themeChoices = buildColorChoices([
        'Zinc', 'Slate', 'Stone', 'Gray', 'Neutral',
        'Red', 'Rose', 'Orange', 'Green', 'Blue', 'Yellow', 'Violet', 'Amber',
    ]);
    const baseColorChoices = buildColorChoices(['Neutral', 'Slate', 'Stone', 'Gray', 'Zinc']);

    const responses = await prompts([
        { type: 'select', name: 'baseColor', message: 'Which color would you like to use as base color?', choices: baseColorChoices, initial: 0 },
        { type: 'select', name: 'theme', message: 'Which color would you like to use for the main theme?', choices: themeChoices, initial: (prev: string): number => { const i = themeChoices.findIndex(c => c.value === prev); return i === -1 ? 0 : i; } },
        { type: 'text', name: 'componentsPath', message: 'Where would you like to install components?', initial: 'src/components/ui' },
        { type: 'text', name: 'utilsPath', message: 'Where would you like to install utils?', initial: 'src/components/lib' },
        { type: 'text', name: 'blocksPath', message: 'Where would you like to install blocks?', initial: 'src/blocks' },
        { type: 'text', name: 'globalCss', message: 'Where is your global styles file?', initial: 'src/styles.scss' },
        { type: 'text', name: 'prefix', message: 'Component selector prefix (e.g. "ui", "acme", "acme-ui"):', initial: initialPrefix, validate: (value: string) => isValidPrefix(value) ? true : 'Prefix must be lowercase kebab-case starting with a letter (e.g. "ui", "myapp", "acme-ui").' },
        { type: 'confirm', name: 'createShortcutRegistry', message: 'Would you like to create a shortcut registry scaffold?', initial: true },
    ], { onCancel });

    return buildConfigFromResponses(responses);
}

async function checkAngularProject(cwd: string): Promise<void> {
    const angularJsonPath = path.join(cwd, 'angular.json');
    if (!await fs.pathExists(angularJsonPath)) {
        console.log(chalk.red('Error: This does not appear to be an Angular project.'));
        console.log(chalk.dim('Please run this command in the root of your Angular project.'));
        process.exit(1);
    }
}

async function checkExistingComponentsJson(cwd: string, yes: boolean | undefined): Promise<boolean> {
    const componentsJsonPath = path.join(cwd, 'components.json');
    if (!await fs.pathExists(componentsJsonPath)) return true;
    const overwrite = yes
        ? true
        : (await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: 'components.json already exists. Overwrite?',
            initial: false,
        }, { onCancel })).overwrite;
    if (!overwrite) {
        console.log(chalk.dim('Initialization cancelled.'));
        return false;
    }
    return true;
}

function applyConfigOverrides(config: Config, options: InitOptions): void {
    if (options.theme !== undefined) config.tailwind.theme = options.theme as ThemeColor;
    if (options.prefix !== undefined) config.prefix = options.prefix;
    if (options.registry) config.registry = options.registry;
}

async function runInitProject(cwd: string, config: Config, createShortcutRegistry: boolean, defaults: InitDefaults, options: InitOptions): Promise<void> {
    const spinner = ora('Initializing project...').start();
    try {
        const { created, warnings } = await initProject({
            cwd, config, createShortcutRegistry,
            fetchOptions: { branch: options.branch, remote: options.remote, registry: options.registry },
        });
        spinner.succeed(chalk.green('Project initialized successfully!'));
        for (const c of created) console.log(chalk.dim('  + ') + chalk.cyan(c));
        for (const w of warnings) console.log(chalk.yellow('  ' + w));
        const applied = await applyInitDefaults(cwd, defaults, {
            branch: options.branch, remote: options.remote, registry: options.registry,
        });
        for (const msg of applied) console.log(chalk.dim('  ✓ ') + msg);
        console.log('\n' + chalk.bold('Next steps:'));
        console.log(chalk.dim('  1. Add components: ') + chalk.cyan('npx @gilav21/shadcn-angular add button'));
        console.log(chalk.dim('  2. Import and use in your templates'));
        console.log('');
    } catch (error) {
        spinner.fail('Failed to initialize project');
        console.error(error);
        process.exit(1);
    }
}

export async function init(options: InitOptions): Promise<void> {
    console.log(chalk.bold('\n🎨 Welcome to shadcn-angular!\n'));
    const cwd = process.cwd();

    await checkAngularProject(cwd);

    if (!await checkExistingComponentsJson(cwd, options.yes)) return;

    if (options.prefix !== undefined && !isValidPrefix(options.prefix)) {
        console.log(chalk.red(`Error: invalid --prefix value "${options.prefix}".`));
        console.log(chalk.dim('Prefix must be lowercase kebab-case starting with a letter (e.g. "ui", "myapp", "acme-ui").'));
        process.exit(1);
    }

    let defaults: InitDefaults;
    try {
        defaults = parseInitDefaults(options);
    } catch (error) {
        console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }

    const initialPrefix = options.prefix ?? DEFAULT_PREFIX;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- boolean flags: false should also be checked
    const nonInteractive = Boolean(options.defaults || options.yes);

    const { config, createShortcutRegistry } = nonInteractive
        ? { config: { ...getDefaultConfig(), prefix: initialPrefix }, createShortcutRegistry: true }
        : await promptForConfig(initialPrefix);

    if (!nonInteractive && !hasAnyDefaultFlag(options)) {
        defaults = { ...await promptForDefaults(), ...defaults };
    }

    applyConfigOverrides(config, options);
    await runInitProject(cwd, config, createShortcutRegistry, defaults, options);
}
