import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { getConfig, type Config } from '../utils/config.js';
import { registry, type ComponentDefinition, type ComponentName } from '../registry/index.js';
import { installPackages } from '../utils/package-manager.js';
import { writeShortcutRegistryIndex, type ShortcutRegistryEntry } from '../utils/shortcut-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AddOptions {
    yes?: boolean;
    overwrite?: boolean;
    all?: boolean;
    path?: string;
    remote?: boolean;
    branch: string;
}

interface ConflictCheckResult {
    toInstall: ComponentName[];
    toSkip: string[];
    conflicting: ComponentName[];
    peerFilesToUpdate: Set<string>;
    contentCache: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Path & URL helpers
// ---------------------------------------------------------------------------

function validateBranch(branch: string): void {
    if (!/^[\w.\-/]+$/.test(branch)) {
        throw new Error(`Invalid branch name: ${branch}`);
    }
}

function getRegistryBaseUrl(branch: string) {
    validateBranch(branch);
    return `https://raw.githubusercontent.com/gilav21/shadcn-angular/${branch}/packages/components/ui`;
}

function getLibRegistryBaseUrl(branch: string) {
    validateBranch(branch);
    return `https://raw.githubusercontent.com/gilav21/shadcn-angular/${branch}/packages/components/lib`;
}

function getLocalComponentsDir(): string | null {
    const localPath = path.resolve(__dirname, '../../../components/ui');
    return fs.existsSync(localPath) ? localPath : null;
}

function getLocalLibDir(): string | null {
    const fromDist = path.resolve(__dirname, '../../../components/lib');
    if (fs.existsSync(fromDist)) {
        return fromDist;
    }
    return null;
}

function resolveProjectPath(cwd: string, inputPath: string): string {
    const resolved = path.resolve(cwd, inputPath);
    const relative = path.relative(cwd, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Path must stay inside the project directory: ${inputPath}`);
    }
    return resolved;
}

function aliasToProjectPath(aliasOrPath: string): string {
    return aliasOrPath.startsWith('@/')
        ? path.join('src', aliasOrPath.slice(2))
        : aliasOrPath;
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

    const url = `${getRegistryBaseUrl(options.branch)}/${file}`;
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

    const url = `${getLibRegistryBaseUrl(options.branch)}/${file}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch library file from ${url}: ${response.statusText}`);
    }
    return response.text();
}

export async function fetchAndTransform(file: string, options: AddOptions, utilsAlias: string): Promise<string> {
    let content = await fetchComponentContent(file, options);
    content = content.replaceAll(/(\.\.\/)+lib\//g, utilsAlias + '/');
    return content;
}

// ---------------------------------------------------------------------------
// Component selection & dependency resolution
// ---------------------------------------------------------------------------

async function selectComponents(components: string[], options: AddOptions): Promise<ComponentName[]> {
    if (options.all) {
        return Object.keys(registry);
    }

    if (components.length === 0) {
        const { selected } = await prompts({
            type: 'multiselect',
            name: 'selected',
            message: 'Which components would you like to add?',
            choices: Object.keys(registry).map(name => ({
                title: name,
                value: name,
            })),
            hint: '- Space to select, Enter to confirm',
        });
        return selected;
    }

    return components;
}

function validateComponents(names: ComponentName[]): void {
    const invalid = names.filter(c => !registry[c]);
    if (invalid.length > 0) {
        console.log(chalk.red(`Invalid component(s): ${invalid.join(', ')}`));
        console.log(chalk.dim('Available components: ' + Object.keys(registry).join(', ')));
        process.exit(1);
    }
}

export function resolveDependencies(names: ComponentName[]): Set<ComponentName> {
    const all = new Set<ComponentName>();
    const walk = (name: ComponentName) => {
        if (all.has(name)) return;
        all.add(name);
        registry[name].dependencies?.forEach(dep => walk(dep));
    };
    names.forEach(walk);
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
            if (resolved.has(opt.name) || seen.has(opt.name)) continue;
            seen.add(opt.name);
            choices.push({ name: opt.name, description: opt.description, requestedBy: name });
        }
    }

    if (choices.length === 0) return [];
    if (options.yes) return [];
    if (options.all) return choices.map(c => c.name);

    const { selected } = await prompts({
        type: 'multiselect',
        name: 'selected',
        message: 'Optional companion components available:',
        choices: choices.map(c => ({
            title: c.name + ' ' + chalk.dim('- ' + c.description + ' (for ' + c.requestedBy + ')'),
            value: c.name,
        })),
        hint: '- Space to select, Enter to confirm (or press Enter to skip)',
    });

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
): Promise<'identical' | 'changed' | 'missing'> {
    const targetPath = path.join(targetDir, file);

    if (!await fs.pathExists(targetPath)) {
        return 'missing';
    }

    const localContent = await fs.readFile(targetPath, 'utf-8');
    try {
        const remoteContent = await fetchAndTransform(file, options, utilsAlias);
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
): Promise<void> {
    if (!component.peerFiles) return;

    for (const file of component.peerFiles) {
        const status = await checkFileConflict(file, targetDir, options, utilsAlias, contentCache);
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
): Promise<'install' | 'skip' | 'conflict'> {
    const component = registry[name];
    let ownFilesChanged = false;
    let isFullyPresent = true;

    for (const file of component.files) {
        const status = await checkFileConflict(file, targetDir, options, utilsAlias, contentCache);
        if (status === 'missing') isFullyPresent = false;
        if (status === 'changed') ownFilesChanged = true;
    }

    await checkPeerFiles(
        component, targetDir, options, utilsAlias, contentCache, peerFilesToUpdate,
    );

    if (isFullyPresent && !ownFilesChanged) return 'skip';
    if (ownFilesChanged) return 'conflict';
    return 'install';
}

export async function detectConflicts(
    allComponents: Set<ComponentName>,
    targetDir: string,
    options: AddOptions,
    utilsAlias: string,
): Promise<ConflictCheckResult> {
    const toInstall: ComponentName[] = [];
    const toSkip: string[] = [];
    const conflicting: ComponentName[] = [];
    const peerFilesToUpdate = new Set<string>();
    const contentCache = new Map<string, string>();

    for (const name of allComponents) {
        const result = await classifyComponent(
            name, targetDir, options, utilsAlias, contentCache, peerFilesToUpdate,
        );

        if (result === 'skip') toSkip.push(name);
        else if (result === 'conflict') conflicting.push(name);
        else toInstall.push(name);
    }

    return { toInstall, toSkip, conflicting, peerFilesToUpdate, contentCache };
}

// ---------------------------------------------------------------------------
// Overwrite prompt
// ---------------------------------------------------------------------------

async function promptOverwrite(
    conflicting: ComponentName[],
    options: AddOptions,
): Promise<ComponentName[]> {
    if (conflicting.length === 0) return [];

    if (options.overwrite) return conflicting;
    if (options.yes) return [];

    console.log(chalk.yellow(`\n${conflicting.length} component(s) have local changes or are different from remote.`));
    const { selected } = await prompts({
        type: 'multiselect',
        name: 'selected',
        message: 'Select components to OVERWRITE (Unselected will be skipped):',
        choices: conflicting.map(name => ({ title: name, value: name })),
        hint: '- Space to select, Enter to confirm',
    });
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
): Promise<boolean> {
    let success = true;

    for (const file of component.files) {
        const targetPath = path.join(targetDir, file);
        try {
            const content = contentCache.get(file)
                ?? await fetchAndTransform(file, options, utilsAlias);

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
): Promise<void> {
    if (!component.peerFiles) return;

    for (const file of component.peerFiles) {
        if (!peerFilesToUpdate.has(file)) continue;

        const targetPath = path.join(targetDir, file);
        try {
            const content = contentCache.get(file)
                ?? await fetchAndTransform(file, options, utilsAlias);

            await fs.writeFile(targetPath, content);
            spinner.text = `Updated peer file ${file}`;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            spinner.warn(`Could not update peer file ${file}: ${message}`);
        }
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
        registry[name].libFiles?.forEach(f => required.add(f));
    }

    if (required.size === 0) return;

    await fs.ensureDir(libDir);
    for (const libFile of required) {
        const targetPath = path.join(libDir, libFile);
        if (!await fs.pathExists(targetPath) || options.overwrite) {
            try {
                const content = await fetchLibContent(libFile, options);
                await fs.writeFile(targetPath, content);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.warn(chalk.yellow(`Could not install lib file ${libFile}: ${message}`));
            }
        }
    }
}

async function installNpmDependencies(
    finalComponents: ComponentName[],
    cwd: string,
): Promise<void> {
    const deps = new Set<string>();
    for (const name of finalComponents) {
        registry[name].npmDependencies?.forEach(dep => deps.add(dep));
    }

    if (deps.size === 0) return;

    const spinner = ora('Installing dependencies...').start();
    try {
        await installPackages(Array.from(deps), { cwd });
        spinner.succeed('Dependencies installed.');
    } catch (e) {
        spinner.fail('Failed to install dependencies.');
        console.error(e);
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

    // Detect conflicts
    const checkSpinner = ora('Checking for conflicts...').start();
    const { toInstall, toSkip, conflicting, peerFilesToUpdate, contentCache } =
        await detectConflicts(allComponents, targetDir, options, utilsAlias);
    checkSpinner.stop();

    // Prompt user for overwrite decisions
    const toOverwrite = await promptOverwrite(conflicting, options);
    const finalComponents = [...toInstall, ...toOverwrite];

    // Remove peer files that belong only to declined components
    const declined = conflicting.filter(c => !toOverwrite.includes(c));
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

    if (finalComponents.length === 0) {
        if (toSkip.length > 0 || declined.length > 0) {
            if (toSkip.length > 0) {
                console.log(chalk.green(`\nAll components are up to date! (${toSkip.length} skipped)`));
            }
            if (declined.length > 0) {
                console.log('\n' + chalk.dim('Components skipped (kept local changes):'));
                declined.forEach(name => console.log(chalk.dim('  - ') + chalk.yellow(name)));
            }
        } else {
            console.log(chalk.dim('\nNo components to install.'));
        }
        return;
    }

    // Install component files
    const spinner = ora('Installing components...').start();
    let successCount = 0;
    const finalComponentSet = new Set(finalComponents);

    try {
        await fs.ensureDir(targetDir);

        for (const name of finalComponents) {
            const component = registry[name];

            const ok = await writeComponentFiles(
                component, targetDir, options, utilsAlias, contentCache, spinner,
            );
            await writePeerFiles(
                component, targetDir, options, utilsAlias, contentCache, peerFilesToUpdate, spinner,
            );

            if (ok) {
                successCount++;
                spinner.text = `Added ${name}`;
            }
        }

        if (successCount > 0) {
            spinner.succeed(chalk.green(`Success! Added ${successCount} component(s)`));
            console.log('\n' + chalk.dim('Components added:'));
            finalComponents.forEach(name => console.log(chalk.dim('  - ') + chalk.cyan(name)));
        } else {
            spinner.info('No new components installed.');
        }

        // Post-install: lib files, npm deps, shortcuts
        const libDir = resolveProjectPath(cwd, aliasToProjectPath(utilsAlias));
        await installLibFiles(finalComponentSet, cwd, libDir, options);
        await installNpmDependencies(finalComponents, cwd);
        await ensureShortcutService(targetDir, cwd, config, options);

        if (toSkip.length > 0) {
            console.log('\n' + chalk.dim('Components skipped (up to date):'));
            toSkip.forEach(name => console.log(chalk.dim('  - ') + chalk.gray(name)));
        }

        if (declined.length > 0) {
            console.log('\n' + chalk.dim('Components skipped (kept local changes):'));
            declined.forEach(name => console.log(chalk.dim('  - ') + chalk.yellow(name)));
        }

        console.log('');
    } catch (error) {
        spinner.fail('Failed to add components');
        console.error(error);
        process.exit(1);
    }
}
