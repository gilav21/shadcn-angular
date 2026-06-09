import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'node:path';
import { getConfig } from '../utils/config.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { fetchLibContent, type FetchOptions } from '../core/fetch.js';

/** The i18n lib files installed when set-locale runs before any i18n-using component. */
export const I18N_LIB_FILES = [
    'i18n/i18n.token.ts',
    'i18n/i18n.types.ts',
    'i18n/i18n.utils.ts',
];

/**
 * Validates a BCP-47-ish locale code: a 2–3 letter lowercase primary subtag,
 * optionally followed by subtags like "-BR" or "-Hant" (e.g. "en", "he", "pt-BR").
 */
export function isValidLocaleCode(code: string): boolean {
    return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code);
}

const DEFAULT_LOCALE_PATTERN = /(factory:\s*\(\)\s*=>\s*signal\(')[^']*('\)\.asReadonly\(\))/;

async function ensureI18nInstalled(libDir: string, fetchOptions: FetchOptions): Promise<void> {
    for (const libFile of I18N_LIB_FILES) {
        const targetPath = path.join(libDir, libFile);
        if (await fs.pathExists(targetPath)) continue;
        const content = await fetchLibContent(libFile, fetchOptions);
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, content);
    }
}

/**
 * Core locale-setting logic — no chalk/ora. Rewrites the default value of
 * `UI_LOCALE_ID` in the user's installed copy of `i18n/i18n.token.ts` (under
 * the utils alias). Installs the i18n lib files first when they aren't
 * present yet (e.g. `init --locale he` on a pristine project).
 */
export async function setLocaleCore(
    code: string,
    cwd: string,
    fetchOptions: FetchOptions = { branch: 'master' },
): Promise<string> {
    if (!isValidLocaleCode(code)) {
        throw new Error(
            `Invalid locale code "${code}" — use a BCP-47 code like "en", "he", or "pt-BR".`,
        );
    }

    const config = await getConfig(cwd);
    if (!config) {
        throw new Error('Project not initialized — run shadcn-angular init first.');
    }

    const libDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.utils));
    await ensureI18nInstalled(libDir, fetchOptions);

    const tokenPath = path.join(libDir, 'i18n', 'i18n.token.ts');
    const content = await fs.readFile(tokenPath, 'utf-8');
    if (!DEFAULT_LOCALE_PATTERN.test(content)) {
        throw new Error(
            `Could not find the default-locale signal in ${tokenPath} — the file may have been customized. Edit its UI_LOCALE_ID factory manually.`,
        );
    }

    await fs.writeFile(tokenPath, content.replace(DEFAULT_LOCALE_PATTERN, `$1${code}$2`));
    return `Set default UI locale to "${code}" in ${path.relative(cwd, tokenPath)}`;
}

interface SetLocaleOptions {
    readonly remote?: boolean;
    readonly branch: string;
    readonly registry?: string;
}

export async function setLocale(
    code: string,
    options: SetLocaleOptions,
    cwd = process.cwd(),
): Promise<void> {
    const spinner = ora('Updating default locale…').start();
    try {
        const message = await setLocaleCore(code, cwd, {
            branch: options.branch,
            remote: options.remote,
            registry: options.registry,
        });
        spinner.succeed(chalk.green(message));
    } catch (error) {
        spinner.fail(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
}
