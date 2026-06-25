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
import { readManifest, writeManifest, recordFile, fileStatus, removeFiles, type Manifest } from './manifest.js';

export interface InstallResult {
    installed: ComponentName[];
    skipped: string[];
    /** Conflicting components that were NOT in the overwrite set. */
    declined: ComponentName[];
    /** Old-layout files deleted because the current manifest no longer ships them. */
    pruned: string[];
    warnings: string[];
}

interface WriteFilesContext {
    targetDir: string;
    options: AddOptions;
    utilsAlias: string;
    contentCache: Map<string, string>;
    prefix: string;
    warnings: string[];
    manifest: Manifest;
    kind?: SourceKind;
}

async function writeComponentFiles(
    component: ComponentDefinition,
    ctx: WriteFilesContext,
): Promise<boolean> {
    const kind = ctx.kind ?? 'component';
    let success = true;
    for (const file of component.files) {
        const targetPath = path.join(ctx.targetDir, file);
        try {
            const content = ctx.contentCache.get(file) ?? await fetchAndTransform(file, ctx.options, ctx.utilsAlias, ctx.prefix, kind);
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content);
            recordFile(ctx.manifest, file, content, component.name);
        } catch (err: unknown) {
            ctx.warnings.push(`Could not add ${file}: ${err instanceof Error ? err.message : String(err)}`);
            success = false;
        }
    }
    return success;
}

async function writePeerFiles(
    component: ComponentDefinition,
    ctx: WriteFilesContext,
    peerFilesToUpdate: Set<string>,
): Promise<void> {
    if (!component.peerFiles) return;
    const kind = ctx.kind ?? 'component';
    for (const file of component.peerFiles) {
        if (!peerFilesToUpdate.has(file)) continue;
        const targetPath = path.join(ctx.targetDir, file);
        try {
            const content = ctx.contentCache.get(file) ?? await fetchAndTransform(file, ctx.options, ctx.utilsAlias, ctx.prefix, kind);
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content);
            recordFile(ctx.manifest, file, content, component.name);
        } catch (err: unknown) {
            ctx.warnings.push(`Could not update peer file ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

async function installSingleLibFile(libFile: string, targetPath: string, options: AddOptions, warnings: string[], manifest: Manifest): Promise<void> {
    try {
        const content = await fetchLibContent(libFile, options);
        const exists = await fs.pathExists(targetPath);
        if (!exists || options.overwrite) {
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content);
            // Fingerprint the lib file so future drift is detectable (pristine vs
            // user-edited) the same way component files are — this is what lets
            // `doctor`/`update` later refresh a stale lib file safely.
            recordFile(manifest, libFile, content, '(lib)');
            return;
        }
        const local = normalizeContent(await fs.readFile(targetPath, 'utf-8'));
        if (local !== normalizeContent(content)) {
            warnings.push(`Lib file ${libFile} differs from remote (run doctor_fix or update to refresh)`);
        }
    } catch (err: unknown) {
        warnings.push(`Could not install lib file ${libFile}: ${err instanceof Error ? err.message : String(err)}`);
    }
}

async function installLibFiles(
    components: Set<ComponentName>, libDir: string, options: AddOptions, warnings: string[], manifest: Manifest,
): Promise<void> {
    const required = new Set<string>();
    for (const name of components) {
        for (const f of registry[name].libFiles ?? []) required.add(f);
    }
    if (required.size === 0) return;
    await fs.ensureDir(libDir);
    for (const libFile of required) {
        await installSingleLibFile(libFile, path.join(libDir, libFile), options, warnings, manifest);
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
function prunePeerFilesForDeclined(declined: ComponentName[], finalComponents: ComponentName[], peerFilesToUpdate: Set<string>): void {
    for (const name of declined) {
        for (const file of registry[name].peerFiles ?? []) {
            const stillNeeded = finalComponents.some(fc => registry[fc].peerFiles?.includes(file));
            if (!stillNeeded) peerFilesToUpdate.delete(file);
        }
    }
}

async function writeAllComponents(
    finalComponents: ComponentName[], targetDir: string, blocksBase: string,
    ctx: Omit<WriteFilesContext, 'targetDir' | 'kind'>,
    peerFilesToUpdate: Set<string>,
): Promise<ComponentName[]> {
    const installed: ComponentName[] = [];
    for (const name of finalComponents) {
        const component = registry[name];
        const isBlock = component.type === 'block';
        const dir = isBlock ? blocksBase : targetDir;
        const kind: SourceKind = isBlock ? 'block' : 'component';
        await fs.ensureDir(dir);
        const writeCtx: WriteFilesContext = { ...ctx, targetDir: dir, kind };
        const ok = await writeComponentFiles(component, writeCtx);
        await writePeerFiles(component, writeCtx, peerFilesToUpdate);
        if (ok) installed.push(name);
    }
    return installed;
}

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

    prunePeerFilesForDeclined(declined, finalComponents, result.peerFilesToUpdate);

    if (finalComponents.length === 0) {
        return { installed: [], skipped: result.toSkip, declined, pruned: [], warnings };
    }

    const manifest = await readManifest(input.cwd);
    const blocksBase = resolveProjectPath(input.cwd, input.blocksPath ?? aliasToProjectPath(getBlocksAlias(input.config)));
    const baseCtx = { options: input.options, utilsAlias, contentCache: result.contentCache, prefix, warnings, manifest };
    const installed = await writeAllComponents(finalComponents, targetDir, blocksBase, baseCtx, result.peerFilesToUpdate);

    const libDir = resolveProjectPath(input.cwd, aliasToProjectPath(utilsAlias));
    await installLibFiles(new Set(finalComponents), libDir, input.options, warnings, manifest);
    await installNpmDependencies(finalComponents, input.cwd, warnings);
    const pruned = await pruneObsoleteFiles(finalComponents, targetDir, manifest, warnings);
    await ensureShortcutService(targetDir, input.cwd, input.config, input.options);
    try {
        await writeManifest(input.cwd, manifest);
    } catch (err: unknown) {
        warnings.push(`Could not write components.lock.json: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { installed, skipped: result.toSkip, declined, pruned, warnings };
}

/**
 * Delete old-layout files the current registry no longer ships for a
 * (re)installed component — a type relocated to `lib/`, a sub-component moved
 * into `sub/`. Without this, a reinstall writes the new layout but leaves the
 * old files as orphans, and a stale duplicate type clashes with its relocated
 * copy (report B7). A file the user has edited from our recorded baseline is
 * kept and flagged, never silently removed.
 */
async function pruneObsoleteFiles(
    finalComponents: ComponentName[], targetDir: string, manifest: Manifest, warnings: string[],
): Promise<string[]> {
    const pruned: string[] = [];
    for (const name of finalComponents) {
        for (const rel of registry[name].obsoleteFiles ?? []) {
            const abs = path.join(targetDir, rel);
            if (!await fs.pathExists(abs)) continue;
            if (fileStatus(manifest, rel, await fs.readFile(abs, 'utf-8')) === 'modified') {
                warnings.push(`Kept ${rel}: it differs from the version we installed (delete it manually if intended).`);
                continue;
            }
            await fs.remove(abs);
            removeFiles(manifest, [rel]);
            pruned.push(rel);
        }
    }
    return pruned;
}
