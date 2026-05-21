import fs from 'fs-extra';
import path from 'node:path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { applyPrefixTransforms, DEFAULT_PREFIX } from '../utils/prefix.js';
import { registry, getComponentNames, type ComponentDefinition, type ComponentName } from '../registry/index.js';
import { installPackages } from '../utils/package-manager.js';
import { writeShortcutRegistryIndex, type ShortcutRegistryEntry } from '../utils/shortcut-registry.js';
import {
    getRegistryBaseUrl,
    getLibRegistryBaseUrl,
    getLocalComponentsDir,
    getLocalLibDir,
    resolveProjectPath,
    aliasToProjectPath,
} from '../utils/paths.js';

const onCancel = () => {
    console.log(chalk.dim('\nCancelled.'));
    process.exit(0);
};

export interface AddOptions {
    yes?: boolean;
    overwrite?: boolean;
    all?: boolean;
    path?: string;
    remote?: boolean;
    dryRun?: boolean;
    branch: string;
    registry?: string;
}

interface ConflictCheckResult {
    toInstall: ComponentName[];
    toSkip: string[];
    conflicting: ComponentName[];
    peerFilesToUpdate: Set<string>;
    contentCache: Map<string, string>;
}

export function normalizeContent(str: string): string {
    return str.replaceAll('\r\n', '\n').trim();
}

// ---------------------------------------------------------------------------
// Remote content fetching
// ---------------------------------------------------------------------------

async function fetchComponentContent(file: string, options: AddOptions): Promise<string> {
    const localDir = getLocalComponentsDir();

    if (localDir && !options.remote) {
        const localPath = path.join(localDir, file);
        if (await fs.pathExists(localPath)) {
            return fs.readFile(localPath, 'utf-8');
        }
    }

    const url = `${getRegistryBaseUrl(options.branch, options.registry)}/${file}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch component from ${url}: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        if (localDir) {
            throw new Error(`Component file not found locally or remotely: ${file}`);
        }
        throw error;
    }
}

async function fetchLibContent(file: string, options: AddOptions): Promise<string> {
    const localDir = getLocalLibDir();

    if (localDir && !options.remote) {
        const localPath = path.join(localDir, file);
        if (await fs.pathExists(localPath)) {
            return fs.readFile(localPath, 'utf-8');
        }
    }

    const url = `${getLibRegistryBaseUrl(options.branch, options.registry)}/${file}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch library file from ${url}: ${response.statusText}`);
    }
    return response.text();
}

export async function fetchAndTransform(
    file: string,
    options: AddOptions,
    utilsAlias: string,
    prefix: string = DEFAULT_PREFIX,
): Promise<string> {
    const raw = await fetchComponentContent(file, options);
    // The `../lib/` → alias rewrite only applies to TypeScript sources.
    // Template (.html) and style (.css) files are copied verbatim apart
    // from any prefix rewrite below.
    const withAlias = file.endsWith('.ts')
        ? raw.replaceAll(/(\.\.\/)+lib\//g, utilsAlias + '/')
        : raw;
    return applyPrefixTransforms(file, withAlias, prefix);
}

// ---------------------------------------------------------------------------
// Component selection & dependency resolution
// ---------------------------------------------------------------------------

async function selectComponents(components: string[], options: AddOptions): Promise<ComponentName[]> {
    if (options.all) {
        return getComponentNames();
    }

    if (components.length === 0) {
        const { selected } = await prompts({
            type: 'multiselect',
            name: 'selected',
            message: 'Which components would you like to add?',
            choices: getComponentNames().map(name => ({
                title: name,
                value: name,
            })),
            hint: '- Space to select, Enter to confirm',
        }, { onCancel });
        return selected;
    }

    return components as ComponentName[];
}

function validateComponents(names: ComponentName[]): void {
    const invalid = names.filter(c => !(c in registry));
    if (invalid.length > 0) {
        console.log(chalk.red(`Invalid component(s): ${invalid.join(', ')}`));
        console.log(chalk.dim('Available components: ' + getComponentNames().join(', ')));
        process.exit(1);
    }
}

export function resolveDependencies(names: ComponentName[]): Set<ComponentName> {
    const all = new Set<ComponentName>();
    const walk = (name: ComponentName) => {
        if (all.has(name)) return;
        all.add(name);
        for (const dep of registry[name].dependencies ?? []) {
            walk(dep as ComponentName);
        }
    };
    for (const name of names) walk(name);
    return all;
}

// ---------------------------------------------------------------------------
// Optional dependency prompt
// ---------------------------------------------------------------------------

interface OptionalChoice {
    readonly name: string;
    readonly description: string;
    readonly requestedBy: string;
}

export async function promptOptionalDependencies(
    resolved: Set<ComponentName>,
    options: AddOptions,
): Promise<ComponentName[]> {
    const seen = new Set<string>();
    const choices: OptionalChoice[] = [];

    for (const name of resolved) {
        const component = registry[name];
        if (!component.optionalDependencies) continue;

        for (const opt of component.optionalDependencies) {
            if (resolved.has(opt.name as ComponentName) || seen.has(opt.name)) continue;
            seen.add(opt.name);
            choices.push({ name: opt.name, description: opt.description, requestedBy: name });
        }
    }

    if (choices.length === 0) return [];
    if (options.yes) return [];
    if (options.all) return choices.map(c => c.name as ComponentName);

    const { selected } = await prompts({
        type: 'multiselect',
        name: 'selected',
        message: 'Optional companion components available:',
        choices: choices.map(c => ({
            title: c.name + ' ' + chalk.dim('- ' + c.description + ' (for ' + c.requestedBy + ')'),
            value: c.name,
        })),
        hint: '- Space to select, Enter to confirm (or press Enter to skip)',
    }, { onCancel });

    return selected || [];
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export async function checkFileConflict(
    file: string,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    contentCache: Map<string, string>,
    prefix: string = DEFAULT_PREFIX,
): Promise<'identical' | 'changed' | 'missing'> {
    const targetPath = path.join(targetDir, file);

    if (!await fs.pathExists(targetPath)) {
        return 'missing';
    }

    const localContent = await fs.readFile(targetPath, 'utf-8');
    try {
        const remoteContent = await fetchAndTransform(file, options, utilsAlias, prefix);
        contentCache.set(file, remoteContent);

        return normalizeContent(localContent) === normalizeContent(remoteContent)
            ? 'identical'
            : 'changed';
    } catch {
        return 'changed';
    }
}

async function checkPeerFiles(
    component: ComponentDefinition,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    contentCache: Map<string, string>,
    peerFilesToUpdate: Set<string>,
    prefix: string,
): Promise<void> {
    if (!component.peerFiles) return;

    for (const file of component.peerFiles) {
        const status = await checkFileConflict(file, targetDir, options, utilsAlias, contentCache, prefix);
        if (status === 'changed') {
            peerFilesToUpdate.add(file);
        }
    }
}

export async function classifyComponent(
    name: ComponentName,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    contentCache: Map<string, string>,
    peerFilesToUpdate: Set<string>,
    prefix: string = DEFAULT_PREFIX,
): Promise<'install' | 'skip' | 'conflict'> {
    const component = registry[name];
    let ownFilesChanged = false;
    let isFullyPresent = true;

    for (const file of component.files) {
        const status = await checkFileConflict(file, targetDir, options, utilsAlias, contentCache, prefix);
        if (status === 'missing') isFullyPresent = false;
        if (status === 'changed') ownFilesChanged = true;
    }

    await checkPeerFiles(
        component, targetDir, options, utilsAlias, contentCache, peerFilesToUpdate, prefix,
    );

    if (options.overwrite) return isFullyPresent ? 'conflict' : 'install';
    if (isFullyPresent && !ownFilesChanged) return 'skip';
    if (ownFilesChanged) return 'conflict';
    return 'install';
}

class ConcurrencyLimiter {
    private active = 0;
    private readonly queue: Array<() => void> = [];

    constructor(private readonly concurrency: number) {}

    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.active >= this.concurrency) {
            await new Promise<void>(resolve => this.queue.push(resolve));
        }
        this.active++;
        try {
            return await fn();
        } finally {
            this.active--;
            if (this.queue.length > 0) this.queue.shift()!();
        }
    }
}

export async function detectConflicts(
    allComponents: Set<ComponentName>,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    prefix: string = DEFAULT_PREFIX,
): Promise<ConflictCheckResult> {
    const toInstall: ComponentName[] = [];
    const toSkip: string[] = [];
    const conflicting: ComponentName[] = [];
    const peerFilesToUpdate = new Set<string>();
    const contentCache = new Map<string, string>();

    const limiter = new ConcurrencyLimiter(8);

    const results = await Promise.all(
        [...allComponents].map(name =>
            limiter.run(async () => ({
                name,
                result: await classifyComponent(
                    name, targetDir, options, utilsAlias, contentCache, peerFilesToUpdate, prefix,
                ),
            })),
        ),
    );

    for (const { name, result } of results) {
        if (result === 'skip') toSkip.push(name);
        else if (result === 'conflict') conflicting.push(name);
        else toInstall.push(name);
    }

    return { toInstall, toSkip, conflicting, peerFilesToUpdate, contentCache };
}

// ---------------------------------------------------------------------------
// Overwrite prompt
// ---------------------------------------------------------------------------

function showConflictDiffs(
    conflicting: ComponentName[],
    targetDir: string,
    contentCache: Map<string, string>,
): void {
    for (const name of conflicting) {
        const component = registry[name];
        const changedFiles: string[] = [];

        for (const file of component.files) {
            const remote = contentCache.get(file);
            if (!remote) continue;
            const localPath = path.join(targetDir, file);
            if (!fs.existsSync(localPath)) continue;

            const local = normalizeContent(fs.readFileSync(localPath, 'utf-8'));
            if (local !== normalizeContent(remote)) {
                changedFiles.push(file);
            }
        }

        if (changedFiles.length > 0) {
            console.log(chalk.dim(`  ${name}: `) + chalk.yellow(changedFiles.join(', ')));
        }
    }
}

async function promptOverwrite(
    conflicting: ComponentName[],
    options: AddOptions,
    targetDir: string,
    contentCache: Map<string, string>,
): Promise<ComponentName[]> {
    if (conflicting.length === 0) return [];

    if (options.overwrite || options.yes) return conflicting;

    console.log(chalk.yellow(`\n${conflicting.length} component(s) have local changes or are different from remote:`));
    showConflictDiffs(conflicting, targetDir, contentCache);
    console.log(chalk.dim('\n  Use `npx shadcn-angular diff <component>` for full diffs.\n'));

    const { selected } = await prompts({
        type: 'multiselect',
        name: 'selected',
        message: 'Select components to OVERWRITE (Unselected will be skipped):',
        choices: conflicting.map(name => ({ title: name, value: name })),
        hint: '- Space to select, Enter to confirm',
    }, { onCancel });
    return selected || [];
}

// ---------------------------------------------------------------------------
// File writing
// ---------------------------------------------------------------------------

async function writeComponentFiles(
    component: ComponentDefinition,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    contentCache: Map<string, string>,
    spinner: Ora,
    prefix: string,
): Promise<boolean> {
    let success = true;

    for (const file of component.files) {
        const targetPath = path.join(targetDir, file);
        try {
            const content = contentCache.get(file)
                ?? await fetchAndTransform(file, options, utilsAlias, prefix);

            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            spinner.warn(`Could not add ${file}: ${message}`);
            success = false;
        }
    }

    return success;
}

async function writePeerFiles(
    component: ComponentDefinition,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
    contentCache: Map<string, string>,
    peerFilesToUpdate: Set<string>,
    spinner: Ora,
    prefix: string,
): Promise<void> {
    if (!component.peerFiles) return;

    for (const file of component.peerFiles) {
        if (!peerFilesToUpdate.has(file)) continue;

        const targetPath = path.join(targetDir, file);
        try {
            const content = contentCache.get(file)
                ?? await fetchAndTransform(file, options, utilsAlias, prefix);

            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content);
            spinner.text = `Updated peer file ${file}`;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            spinner.warn(`Could not update peer file ${file}: ${message}`);
        }
    }
}

async function installSingleLibFile(
    libFile: string,
    libDir: string,
    options: AddOptions,
): Promise<void> {
    const targetPath = path.join(libDir, libFile);
    const content = await fetchLibContent(libFile, options);

    if (!await fs.pathExists(targetPath) || options.overwrite) {
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, content);
        return;
    }

    const local = normalizeContent(await fs.readFile(targetPath, 'utf-8'));
    if (local !== normalizeContent(content)) {
        console.log(chalk.yellow(`  Lib file ${libFile} differs from remote (use --overwrite to update)`));
    }
}

async function installLibFiles(
    allComponents: Set<ComponentName>,
    cwd: string,
    libDir: string,
    options: AddOptions,
): Promise<void> {
    const required = new Set<string>();
    for (const name of allComponents) {
        for (const f of registry[name].libFiles ?? []) required.add(f);
    }

    if (required.size === 0) return;

    await fs.ensureDir(libDir);
    for (const libFile of required) {
        try {
            await installSingleLibFile(libFile, libDir, options);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(chalk.yellow(`Could not install lib file ${libFile}: ${message}`));
        }
    }
}

async function installNpmDependencies(
    finalComponents: ComponentName[],
    cwd: string,
): Promise<void> {
    const deps = new Set<string>();
    for (const name of finalComponents) {
        for (const dep of registry[name].npmDependencies ?? []) deps.add(dep);
    }

    if (deps.size === 0) return;

    const spinner = ora('Installing dependencies...').start();
    try {
        await installPackages(Array.from(deps), { cwd });
        spinner.succeed('Dependencies installed.');
    } catch (e: unknown) {
        spinner.fail('Failed to install dependencies.');
        if (e && typeof e === 'object' && 'stderr' in e && typeof e.stderr === 'string') {
            console.error(chalk.red(e.stderr));
        } else {
            console.error(e);
        }
    }
}

async function ensureShortcutService(
    targetDir: string,
    cwd: string,
    config: Config,
    options: AddOptions,
): Promise<void> {
    const entries = collectInstalledShortcutEntries(targetDir);

    if (entries.length > 0) {
        const libDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.utils));
        const servicePath = path.join(libDir, 'shortcut-binding.service.ts');
        if (!await fs.pathExists(servicePath)) {
            const content = await fetchLibContent('shortcut-binding.service.ts', options);
            await fs.ensureDir(libDir);
            await fs.writeFile(servicePath, content);
        }
    }

    await writeShortcutRegistryIndex(cwd, config, entries);
}

function collectInstalledShortcutEntries(targetDir: string): ShortcutRegistryEntry[] {
    const entries: ShortcutRegistryEntry[] = [];
    for (const definition of Object.values(registry)) {
        if (!definition.shortcutDefinitions?.length) continue;
        for (const sd of definition.shortcutDefinitions) {
            if (fs.existsSync(path.join(targetDir, sd.sourceFile))) {
                entries.push(sd);
            }
        }
    }
    return entries;
}

// ---------------------------------------------------------------------------
// Peer file & summary helpers
// ---------------------------------------------------------------------------

function pruneDeclinedPeerFiles(
    declined: ComponentName[],
    finalComponents: ComponentName[],
    peerFilesToUpdate: Set<string>,
): void {
    for (const name of declined) {
        const component = registry[name];
        if (!component.peerFiles) continue;
        for (const file of component.peerFiles) {
            const stillNeeded = finalComponents.some(fc =>
                registry[fc].peerFiles?.includes(file),
            );
            if (!stillNeeded) {
                peerFilesToUpdate.delete(file);
            }
        }
    }
}

function printNothingToInstall(toSkip: string[], declined: ComponentName[]): void {
    if (toSkip.length > 0 || declined.length > 0) {
        printSkipSummary(toSkip, declined);
    } else {
        console.log(chalk.dim('\nNo components to install.'));
    }
}

function printDryRunSummary(
    toInstall: ComponentName[],
    toOverwrite: ComponentName[],
    toSkip: string[],
    declined: ComponentName[],
): void {
    console.log(chalk.bold('\n[Dry Run] No changes will be made.\n'));
    if (toInstall.length > 0) {
        console.log(chalk.green(`  Would install ${toInstall.length} component(s):`));
        for (const name of toInstall) console.log(chalk.dim('    + ') + chalk.cyan(name));
    }
    if (toOverwrite.length > 0) {
        console.log(chalk.yellow(`  Would overwrite ${toOverwrite.length} component(s):`));
        for (const name of toOverwrite) console.log(chalk.dim('    ~ ') + chalk.yellow(name));
    }
    printSkipSummary(toSkip, declined);
    console.log('');
}

function printSkipSummary(toSkip: string[], declined: ComponentName[]): void {
    if (toSkip.length > 0) {
        console.log('\n' + chalk.dim('Components skipped (up to date):'));
        for (const name of toSkip) console.log(chalk.dim('  - ') + chalk.gray(name));
    }
    if (declined.length > 0) {
        console.log('\n' + chalk.dim('Components skipped (kept local changes):'));
        for (const name of declined) console.log(chalk.dim('  - ') + chalk.yellow(name));
    }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function add(components: string[], options: AddOptions) {
    const cwd = process.cwd();

    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }

    // CLI flag takes priority over components.json
    if (!options.registry && config.registry) {
        options.registry = config.registry;
    }

    const componentsToAdd = await selectComponents(components, options);
    if (!componentsToAdd || componentsToAdd.length === 0) {
        console.log(chalk.dim('No components selected.'));
        return;
    }

    validateComponents(componentsToAdd);

    const resolvedComponents = resolveDependencies(componentsToAdd);
    const optionalChoices = await promptOptionalDependencies(resolvedComponents, options);
    const allComponents = optionalChoices.length > 0
        ? resolveDependencies([...resolvedComponents, ...optionalChoices])
        : resolvedComponents;
    const uiBasePath = options.path ?? aliasToProjectPath(config.aliases.ui || 'src/components/ui');
    const targetDir = resolveProjectPath(cwd, uiBasePath);
    const utilsAlias = config.aliases.utils;
    const prefix = getPrefix(config);

    const checkSpinner = ora('Checking for conflicts...').start();
    const { toInstall, toSkip, conflicting, peerFilesToUpdate, contentCache } =
        await detectConflicts(allComponents, targetDir, options, utilsAlias, prefix);
    checkSpinner.stop();

    const toOverwrite = await promptOverwrite(conflicting, options, targetDir, contentCache);
    const finalComponents = [...toInstall, ...toOverwrite];
    const declined = conflicting.filter(c => !toOverwrite.includes(c));

    pruneDeclinedPeerFiles(declined, finalComponents, peerFilesToUpdate);

    if (options.dryRun) {
        printDryRunSummary(toInstall, toOverwrite, toSkip, declined);
        return;
    }

    if (finalComponents.length === 0) {
        printNothingToInstall(toSkip, declined);
        return;
    }

    const spinner = ora('Installing components...').start();
    let successCount = 0;

    try {
        await fs.ensureDir(targetDir);

        for (const name of finalComponents) {
            const component = registry[name];
            const ok = await writeComponentFiles(component, targetDir, options, utilsAlias, contentCache, spinner, prefix);
            await writePeerFiles(component, targetDir, options, utilsAlias, contentCache, peerFilesToUpdate, spinner, prefix);
            if (ok) {
                successCount++;
                spinner.text = `Added ${name}`;
            }
        }

        if (successCount > 0) {
            spinner.succeed(chalk.green(`Success! Added ${successCount} component(s)`));
            console.log('\n' + chalk.dim('Components added:'));
            for (const name of finalComponents) console.log(chalk.dim('  - ') + chalk.cyan(name));
        } else {
            spinner.info('No new components installed.');
        }

        const libDir = resolveProjectPath(cwd, aliasToProjectPath(utilsAlias));
        await installLibFiles(new Set(finalComponents), cwd, libDir, options);
        await installNpmDependencies(finalComponents, cwd);
        await ensureShortcutService(targetDir, cwd, config, options);

        printSkipSummary(toSkip, declined);
        console.log('');
    } catch (error) {
        spinner.fail('Failed to add components');
        console.error(error);
        process.exit(1);
    }
}
