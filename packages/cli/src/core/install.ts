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
import { readManifest, writeManifest, recordFile, recordComponentRef, fileStatus, removeFiles, type Manifest } from './manifest.js';
import { resolveRef } from './ref.js';
import { mergeWriteFile, emptyMergeReport, shouldAdvanceRef, type MergeReport, type MergeOutcome, type MergeWriteContext } from './merge.js';

export interface InstallResult {
    installed: ComponentName[];
    skipped: string[];
    /** Conflicting components that were NOT in the overwrite set. */
    declined: ComponentName[];
    /** Old-layout files deleted because the current manifest no longer ships them. */
    pruned: string[];
    warnings: string[];
    /** Per-file merge outcomes (merged/overwritten/skipped/conflicted/fell-back). */
    mergeReport: MergeReport;
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
    /** Current ref every written component is advanced TO (`null` ⇒ no advance). */
    currentRef: string | null;
    /** `--overwrite`: bypass the 3-way merge and write the upstream version whole-file. */
    forceWholeFile: boolean;
    report: MergeReport;
}

/** Build the per-file merge context, fetching THEIRS (from cache or remote). */
async function mergeContextFor(
    file: string, component: ComponentDefinition, ctx: WriteFilesContext, kind: SourceKind,
): Promise<MergeWriteContext> {
    const theirs = ctx.contentCache.get(file) ?? await fetchAndTransform(file, ctx.options, ctx.utilsAlias, ctx.prefix, kind);
    return {
        targetDir: ctx.targetDir,
        component: component.name,
        theirs,
        options: ctx.options,
        utilsAlias: ctx.utilsAlias,
        prefix: ctx.prefix,
        kind,
        manifest: ctx.manifest,
        forceWholeFile: ctx.forceWholeFile,
        report: ctx.report,
    };
}

/** One-line notice when a file is skipped because it's edited and has no baseline to merge. */
function warnFellBack(file: string, warnings: string[]): void {
    warnings.push(
        `Skipped ${file}: locally edited and no recorded baseline to 3-way merge — ` +
        `re-run with --overwrite to take the upstream version (your changes are kept).`,
    );
}

async function writeComponentFiles(
    component: ComponentDefinition,
    ctx: WriteFilesContext,
    outcomes: MergeOutcome[],
): Promise<boolean> {
    const kind = ctx.kind ?? 'component';
    let success = true;
    for (const file of component.files) {
        try {
            const outcome = await mergeWriteFile(file, await mergeContextFor(file, component, ctx, kind));
            outcomes.push(outcome);
            if (outcome === 'fellback-kept') warnFellBack(file, ctx.warnings);
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
    outcomes: MergeOutcome[],
): Promise<void> {
    if (!component.peerFiles) return;
    const kind = ctx.kind ?? 'component';
    for (const file of component.peerFiles) {
        if (!peerFilesToUpdate.has(file)) continue;
        try {
            const outcome = await mergeWriteFile(file, await mergeContextFor(file, component, ctx, kind));
            outcomes.push(outcome);
            if (outcome === 'fellback-kept') warnFellBack(file, ctx.warnings);
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
    /** Subset of conflicting components the caller authorizes writing (the write set). */
    overwrite?: ComponentName[];
    /**
     * The `overwrite` set was chosen as an EXPLICIT override (the `--overwrite`
     * flag or an interactive "overwrite" selection) — clobber those components
     * whole-file rather than 3-way merging. `update`'s programmatic write set
     * leaves this false so edited files merge instead of being clobbered.
     */
    forceOverwrite?: boolean;
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
    ctx: Omit<WriteFilesContext, 'targetDir' | 'kind' | 'forceWholeFile'>,
    peerFilesToUpdate: Set<string>,
    forcedSet: Set<ComponentName>,
): Promise<ComponentName[]> {
    const installed: ComponentName[] = [];
    for (const name of finalComponents) {
        const component = registry[name];
        const isBlock = component.type === 'block';
        const dir = isBlock ? blocksBase : targetDir;
        const kind: SourceKind = isBlock ? 'block' : 'component';
        await fs.ensureDir(dir);
        const writeCtx: WriteFilesContext = { ...ctx, targetDir: dir, kind, forceWholeFile: forcedSet.has(name) };
        const outcomes: MergeOutcome[] = [];
        const ok = await writeComponentFiles(component, writeCtx, outcomes);
        await writePeerFiles(component, writeCtx, peerFilesToUpdate, outcomes);
        // Per-component ref advances only when no file fell back (see shouldAdvanceRef).
        if (writeCtx.currentRef && shouldAdvanceRef(outcomes)) {
            recordComponentRef(writeCtx.manifest, name, writeCtx.currentRef);
        }
        if (ok) installed.push(name);
    }
    return installed;
}

/**
 * Components to clobber whole-file (bypass the 3-way merge). The `--overwrite`
 * flag forces every written component; an explicit `forceOverwrite` (interactive
 * "overwrite" selection) forces just the chosen overwrite set. Otherwise the set
 * is empty and edited files 3-way merge against their recorded baseline.
 */
function resolveForcedSet(
    finalComponents: ComponentName[], toOverwrite: ComponentName[], input: InstallInput,
): Set<ComponentName> {
    if (input.options.overwrite) return new Set(finalComponents);
    if (input.forceOverwrite) return new Set(toOverwrite);
    return new Set();
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
        return { installed: [], skipped: result.toSkip, declined, pruned: [], warnings, mergeReport: emptyMergeReport() };
    }

    const manifest = await readManifest(input.cwd);
    const currentRef = await resolveRef(input.options);
    const report = emptyMergeReport();
    const forcedSet = resolveForcedSet(finalComponents, toOverwrite, input);
    const blocksBase = resolveProjectPath(input.cwd, input.blocksPath ?? aliasToProjectPath(getBlocksAlias(input.config)));
    const baseCtx = { options: input.options, utilsAlias, contentCache: result.contentCache, prefix, warnings, manifest, currentRef, report };
    const installed = await writeAllComponents(finalComponents, targetDir, blocksBase, baseCtx, result.peerFilesToUpdate, forcedSet);

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

    return { installed, skipped: result.toSkip, declined, pruned, warnings, mergeReport: report };
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
