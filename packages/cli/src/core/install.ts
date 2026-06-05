import fs from 'fs-extra';
import path from 'node:path';
import { fetchAndTransform, fetchLibContent, normalizeContent, type SourceKind } from './fetch.js';
import { resolveDependencies } from './resolve.js';
import { detectConflicts, summarizePlan, type AddOptions, type ConflictCheckResult, type InstallPlan } from './plan.js';
import { type Config, getPrefix, getBlocksAlias } from '../utils/config.js';
import { installPackages } from '../utils/package-manager.js';
import { writeShortcutRegistryIndex, type ShortcutRegistryEntry } from '../utils/shortcut-registry.js';
import { registry, type ComponentDefinition, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { readManifest, writeManifest, recordFile, type Manifest } from './manifest.js';

export interface InstallResult {
    installed: ComponentName[];
    skipped: string[];
    /** Conflicting components that were NOT in the overwrite set. */
    declined: ComponentName[];
    warnings: string[];
}

async function writeComponentFiles(
    component: ComponentDefinition, targetDir: string, options: AddOptions,
    utilsAlias: string, contentCache: Map<string, string>, prefix: string, warnings: string[],
    manifest: Manifest, kind: SourceKind = 'component',
): Promise<boolean> {
    let success = true;
    for (const file of component.files) {
        const targetPath = path.join(targetDir, file);
        try {
            const content = contentCache.get(file) ?? await fetchAndTransform(file, options, utilsAlias, prefix, kind);
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content);
            recordFile(manifest, file, content, component.name);
        } catch (err: unknown) {
            warnings.push(`Could not add ${file}: ${err instanceof Error ? err.message : String(err)}`);
            success = false;
        }
    }
    return success;
}

async function writePeerFiles(
    component: ComponentDefinition, targetDir: string, options: AddOptions, utilsAlias: string,
    contentCache: Map<string, string>, peerFilesToUpdate: Set<string>, prefix: string, warnings: string[],
    manifest: Manifest, kind: SourceKind = 'component',
): Promise<void> {
    if (!component.peerFiles) return;
    for (const file of component.peerFiles) {
        if (!peerFilesToUpdate.has(file)) continue;
        const targetPath = path.join(targetDir, file);
        try {
            const content = contentCache.get(file) ?? await fetchAndTransform(file, options, utilsAlias, prefix, kind);
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content);
            recordFile(manifest, file, content, component.name);
        } catch (err: unknown) {
            warnings.push(`Could not update peer file ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

async function installLibFiles(
    components: Set<ComponentName>, libDir: string, options: AddOptions, warnings: string[],
): Promise<void> {
    const required = new Set<string>();
    for (const name of components) {
        for (const f of registry[name].libFiles ?? []) required.add(f);
    }
    if (required.size === 0) return;
    await fs.ensureDir(libDir);
    for (const libFile of required) {
        const targetPath = path.join(libDir, libFile);
        try {
            const content = await fetchLibContent(libFile, options);
            if (!await fs.pathExists(targetPath) || options.overwrite) {
                await fs.ensureDir(path.dirname(targetPath));
                await fs.writeFile(targetPath, content);
            } else {
                const local = normalizeContent(await fs.readFile(targetPath, 'utf-8'));
                if (local !== normalizeContent(content)) {
                    warnings.push(`Lib file ${libFile} differs from remote (use --overwrite to update)`);
                }
            }
        } catch (err: unknown) {
            warnings.push(`Could not install lib file ${libFile}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

async function installNpmDependencies(components: ComponentName[], cwd: string, warnings: string[]): Promise<void> {
    const deps = new Set<string>();
    for (const name of components) {
        for (const dep of registry[name].npmDependencies ?? []) deps.add(dep);
    }
    if (deps.size === 0) return;
    try {
        await installPackages([...deps], { cwd });
    } catch (e: unknown) {
        warnings.push(`Failed to install npm dependencies: ${e instanceof Error ? e.message : String(e)}`);
    }
}

function collectInstalledShortcutEntries(targetDir: string): ShortcutRegistryEntry[] {
    const entries: ShortcutRegistryEntry[] = [];
    for (const definition of Object.values(registry)) {
        if (!definition.shortcutDefinitions?.length) continue;
        for (const sd of definition.shortcutDefinitions) {
            if (fs.existsSync(path.join(targetDir, sd.sourceFile))) entries.push(sd);
        }
    }
    return entries;
}

async function ensureShortcutService(targetDir: string, cwd: string, config: Config, options: AddOptions): Promise<void> {
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

export interface InstallInput {
    /** Components the caller explicitly asked for (deps are resolved here). */
    components: ComponentName[];
    /** Optional companion components to also include. */
    optionalDeps?: ComponentName[];
    /** Subset of conflicting components the caller authorizes overwriting. */
    overwrite?: ComponentName[];
    cwd: string;
    config: Config;
    options: AddOptions;
    /** Override the UI target dir for component entries (else config.aliases.ui). */
    path?: string;
    /** Override the destination for block entries (else config.aliases.blocks). */
    blocksPath?: string;
    /**
     * Conflict detection the caller already ran. The interactive `add` command
     * passes this so the file set isn't detected (and remote files re-fetched)
     * a second time. When omitted (e.g. MCP callers), it is computed here.
     */
    precomputedConflicts?: ConflictCheckResult;
}

function resolveTargetDir(input: InstallInput): string {
    return resolveProjectPath(
        input.cwd, input.path ?? aliasToProjectPath(input.config.aliases.ui || 'src/components/ui'),
    );
}

/** Compute the install plan without writing anything (powers MCP get_install_plan). */
export async function planInstall(input: InstallInput): Promise<InstallPlan> {
    const all = resolveDependencies([...input.components, ...(input.optionalDeps ?? [])]);
    const targetDir = resolveTargetDir(input);
    const prefix = getPrefix(input.config);
    const result = await detectConflicts(all, targetDir, input.options, input.config.aliases.utils, prefix);
    return summarizePlan(result, all);
}

/**
 * Perform a non-interactive install. Conflicting components are only
 * overwritten when listed in `overwrite` (or when `options.overwrite` is set);
 * all others are reported as `declined`. Skip semantics for up-to-date
 * components are preserved.
 */
export async function performInstall(input: InstallInput): Promise<InstallResult> {
    const warnings: string[] = [];
    const targetDir = resolveTargetDir(input);
    const utilsAlias = input.config.aliases.utils;
    const prefix = getPrefix(input.config);
    const overwriteSet = new Set(input.overwrite ?? []);

    const result = input.precomputedConflicts ?? await detectConflicts(
        resolveDependencies([...input.components, ...(input.optionalDeps ?? [])]),
        targetDir, input.options, utilsAlias, prefix,
    );
    const toOverwrite = result.conflicting.filter(c => overwriteSet.has(c) || input.options.overwrite);
    const declined = result.conflicting.filter(c => !toOverwrite.includes(c));
    const finalComponents = [...result.toInstall, ...toOverwrite];

    // Drop peer files only needed by declined components.
    for (const name of declined) {
        for (const file of registry[name].peerFiles ?? []) {
            const stillNeeded = finalComponents.some(fc => registry[fc].peerFiles?.includes(file));
            if (!stillNeeded) result.peerFilesToUpdate.delete(file);
        }
    }

    if (finalComponents.length === 0) {
        return { installed: [], skipped: result.toSkip, declined, warnings };
    }

    const manifest = await readManifest(input.cwd);
    const blocksBase = resolveProjectPath(
        input.cwd, input.blocksPath ?? aliasToProjectPath(getBlocksAlias(input.config)),
    );
    const installed: ComponentName[] = [];
    for (const name of finalComponents) {
        const component = registry[name];
        const isBlock = component.type === 'block';
        const dir = isBlock ? blocksBase : targetDir;
        const kind: SourceKind = isBlock ? 'block' : 'component';
        await fs.ensureDir(dir);
        const ok = await writeComponentFiles(component, dir, input.options, utilsAlias, result.contentCache, prefix, warnings, manifest, kind);
        await writePeerFiles(component, dir, input.options, utilsAlias, result.contentCache, result.peerFilesToUpdate, prefix, warnings, manifest, kind);
        if (ok) installed.push(name);
    }

    const libDir = resolveProjectPath(input.cwd, aliasToProjectPath(utilsAlias));
    await installLibFiles(new Set(finalComponents), libDir, input.options, warnings);
    await installNpmDependencies(finalComponents, input.cwd, warnings);
    await ensureShortcutService(targetDir, input.cwd, input.config, input.options);
    await writeManifest(input.cwd, manifest);

    return { installed, skipped: result.toSkip, declined, warnings };
}
