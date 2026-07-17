import fs from 'fs-extra';
import path from 'node:path';
import { fetchAndTransform, fetchLibContent, normalizeContent, type SourceKind } from './fetch.js';
import { resolveDependencies } from './resolve.js';
import { detectConflicts, summarizePlan, type AddOptions, type ConflictCheckResult, type InstallPlan } from './plan.js';
import { type Config, type TestRunner, getPrefix, getBlocksAlias } from '../utils/config.js';
import { installPackages } from '../utils/package-manager.js';
import { transformSpecForRunner, VITEST_COMPAT_LIB_FILE } from '../utils/test-transform.js';
import { hasJestGlobals } from '../utils/test-runner.js';
import { writeShortcutRegistryIndex, type ShortcutRegistryEntry } from '../utils/shortcut-registry.js';
import { registry, type ComponentDefinition, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { readManifest, writeManifest, recordFile, recordComponentRef, fileStatus, removeFiles, type Manifest } from './manifest.js';
import { resolveRef } from './ref.js';
import { mergeWriteFile, previewMergeFile, emptyMergeReport, shouldAdvanceRef, type MergeReport, type MergeOutcome, type MergeWriteContext } from './merge.js';
import { isPristineLib } from './lib-reconcile.js';

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
    /** Ship each component's portable specs alongside its source. */
    includeTests: boolean;
    /** Runner the shipped specs are transformed for (`jest` → vitest-compat shim). */
    testRunner: TestRunner;
    /** Components whose OWN specs ship (excludes source pulled only as a testDependency). */
    testsFor: Set<ComponentName>;
}

/**
 * Fetch THEIRS for a file: the conflict-scan cache when present, else a fresh
 * fetch+transform. Spec files additionally get the runner transform (jest →
 * vitest-compat import rewrite) and are never in the cache, since the conflict
 * scan only covers component source.
 */
async function fetchTheirs(file: string, ctx: WriteFilesContext, kind: SourceKind, isTest: boolean): Promise<string> {
    const cached = ctx.contentCache.get(file);
    if (cached !== undefined) return cached;
    const transformed = await fetchAndTransform(file, ctx.options, ctx.utilsAlias, ctx.prefix, kind);
    return isTest ? transformSpecForRunner(transformed, ctx.testRunner, ctx.utilsAlias) : transformed;
}

/** Build the per-file merge context, fetching THEIRS (from cache or remote). */
async function mergeContextFor(
    file: string, component: ComponentDefinition, ctx: WriteFilesContext, kind: SourceKind, isTest = false,
): Promise<MergeWriteContext> {
    const theirs = await fetchTheirs(file, ctx, kind, isTest);
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

/**
 * Write a component's portable spec files (`add --include-tests`). Specs are
 * manifest-tracked, 3-way merged, and pruned exactly like source — the same
 * `mergeWriteFile` path — so a consumer's local spec edits survive a re-add.
 * No-op unless this component's own specs are being shipped.
 */
async function writeTestFiles(
    component: ComponentDefinition,
    ctx: WriteFilesContext,
    outcomes: MergeOutcome[],
): Promise<void> {
    if (!ctx.includeTests || !ctx.testsFor.has(component.name as ComponentName)) return;
    const kind = ctx.kind ?? 'component';
    for (const file of component.testFiles ?? []) {
        try {
            const outcome = await mergeWriteFile(file, await mergeContextFor(file, component, ctx, kind, true));
            outcomes.push(outcome);
            if (outcome === 'fellback-kept') warnFellBack(file, ctx.warnings);
        } catch (err: unknown) {
            ctx.warnings.push(`Could not add test file ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

async function writeLibFile(targetPath: string, libFile: string, content: string, manifest: Manifest): Promise<void> {
    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, content);
    // Fingerprint the lib file so future drift is detectable (pristine vs
    // user-edited) the same way component files are — this is what lets
    // `doctor`/`update` later refresh a stale lib file safely.
    recordFile(manifest, libFile, content, '(lib)');
}

async function installSingleLibFile(libFile: string, targetPath: string, options: AddOptions, warnings: string[], manifest: Manifest): Promise<void> {
    try {
        const content = await fetchLibContent(libFile, options);
        if (!await fs.pathExists(targetPath)) {
            await writeLibFile(targetPath, libFile, content, manifest);
            return;
        }
        const local = await fs.readFile(targetPath, 'utf-8');
        const upToDate = normalizeContent(local) === normalizeContent(content);
        const status = fileStatus(manifest, libFile, local);
        // Refresh a pristine lib file (or when forced) — but never clobber a
        // locally-edited one; lib files aren't 3-way merged, so an edited lib is
        // preserved and flagged. `clean` matches our recorded baseline; an
        // `untracked` file that matches a published baseline is a pre-manifest
        // pristine install (never recorded) and is equally safe to refresh.
        const pristineUntracked = status === 'untracked' && isPristineLib(libFile, local);
        if (options.overwrite || status === 'clean' || pristineUntracked) {
            if (!upToDate) await writeLibFile(targetPath, libFile, content, manifest);
            return;
        }
        if (!upToDate) {
            warnings.push(`Lib file ${libFile} differs from remote (run doctor_fix or update --overwrite to refresh)`);
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
    /** Ship each installed component's portable specs (resolved `--include-tests`). */
    includeTests?: boolean;
    /** Runner the shipped specs target; required when `includeTests`. Defaults to vitest. */
    testRunner?: TestRunner;
}

/**
 * Expand an install closure with the spec-only sibling source (`testDependencies`)
 * the shipped specs import, and report which components' OWN specs ship. Source
 * pulled purely as a testDependency installs without its own specs.
 */
export function expandForTests(
    closure: Set<ComponentName>, includeTests: boolean,
): { all: Set<ComponentName>; testsFor: Set<ComponentName> } {
    if (!includeTests) return { all: closure, testsFor: new Set() };
    const testDeps: ComponentName[] = [];
    for (const name of closure) {
        for (const dep of registry[name].testDependencies ?? []) testDeps.push(dep as ComponentName);
    }
    return { all: resolveDependencies([...closure, ...testDeps]), testsFor: new Set(closure) };
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
        await writeTestFiles(component, writeCtx, outcomes);
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

/**
 * Install the vitest→jest compat shim when jest specs shipped, and warn if the
 * consumer lacks `@jest/globals` (the shim imports it). No-op for vitest or
 * when no component's own specs were written.
 */
interface TestShimContext {
    readonly finalComponents: ComponentName[];
    readonly testsFor: Set<ComponentName>;
    readonly includeTests: boolean;
    readonly testRunner: TestRunner;
    readonly libDir: string;
}

async function installTestShim(
    shim: TestShimContext, input: InstallInput, warnings: string[], manifest: Manifest,
): Promise<void> {
    if (!shim.includeTests || shim.testRunner !== 'jest') return;
    const shipsSpecs = shim.finalComponents.some(n => shim.testsFor.has(n) && (registry[n].testFiles?.length ?? 0) > 0);
    if (!shipsSpecs) return;
    await installSingleLibFile(VITEST_COMPAT_LIB_FILE, path.join(shim.libDir, VITEST_COMPAT_LIB_FILE), input.options, warnings, manifest);
    if (!hasJestGlobals(input.cwd)) {
        warnings.push('Installed tests import @jest/globals via the vitest-compat shim — add it with `npm i -D @jest/globals`.');
    }
}

export async function performInstall(input: InstallInput): Promise<InstallResult> {
    const warnings: string[] = [];
    const targetDir = resolveTargetDir(input);
    const utilsAlias = input.config.aliases.utils;
    const prefix = getPrefix(input.config);
    const overwriteSet = new Set(input.overwrite ?? []);
    const includeTests = input.includeTests ?? false;
    const testRunner = input.testRunner ?? 'vitest';
    const { all, testsFor } = expandForTests(
        resolveDependencies([...input.components, ...(input.optionalDeps ?? [])]), includeTests,
    );

    const result = input.precomputedConflicts ?? await detectConflicts(
        all, targetDir, input.options, utilsAlias, prefix,
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
    const baseCtx = {
        options: input.options, utilsAlias, contentCache: result.contentCache, prefix, warnings,
        manifest, currentRef, report, includeTests, testRunner, testsFor,
    };
    const installed = await writeAllComponents(finalComponents, targetDir, blocksBase, baseCtx, result.peerFilesToUpdate, forcedSet);

    const libDir = resolveProjectPath(input.cwd, aliasToProjectPath(utilsAlias));
    await installLibFiles(new Set(finalComponents), libDir, input.options, warnings, manifest);
    await installTestShim({ finalComponents, testsFor, includeTests, testRunner, libDir }, input, warnings, manifest);
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

/** One file's predicted merge outcome for `update --dry-run` (no write, no record). */
export interface MergePreview {
    readonly file: string;
    readonly outcome: MergeOutcome;
}

/**
 * Predict per-file merge outcomes for the given (conflicting) components exactly
 * as {@link performInstall} would decide them — same THEIRS (from the conflict
 * scan's content cache or a fresh fetch), same BASE resolution, same
 * force-overwrite gate — WITHOUT writing any file or recording anything. Powers
 * `update --dry-run`'s merge preview.
 */
export async function previewComponentMerges(
    names: ComponentName[], conflicts: ConflictCheckResult, input: InstallInput,
): Promise<MergePreview[]> {
    const targetDir = resolveTargetDir(input);
    const manifest = await readManifest(input.cwd);
    const blocksBase = resolveProjectPath(input.cwd, aliasToProjectPath(getBlocksAlias(input.config)));
    const base: Omit<WriteFilesContext, 'targetDir' | 'kind'> = {
        options: input.options,
        utilsAlias: input.config.aliases.utils,
        contentCache: conflicts.contentCache,
        prefix: getPrefix(input.config),
        warnings: [],
        manifest,
        currentRef: null,
        // `update`'s dry-run mirrors its write: --overwrite clobbers whole-file,
        // otherwise edited files are 3-way merged (never force-overwritten here).
        forceWholeFile: !!input.options.overwrite,
        report: emptyMergeReport(),
        // The merge preview only walks component.files; test-shipping is inert here.
        includeTests: false,
        testRunner: 'vitest' as TestRunner,
        testsFor: new Set<ComponentName>(),
    };
    const previews: MergePreview[] = [];
    for (const name of names) {
        const component = registry[name];
        const isBlock = component.type === 'block';
        const kind: SourceKind = isBlock ? 'block' : 'component';
        const ctx: WriteFilesContext = { ...base, targetDir: isBlock ? blocksBase : targetDir, kind };
        for (const file of component.files) {
            try {
                const decision = await previewMergeFile(file, await mergeContextFor(file, component, ctx, kind));
                previews.push({ file, outcome: decision.outcome });
            } catch {
                // A preview fetch failure is non-fatal — skip the file; the real
                // run surfaces the error. We only omit it from the preview.
            }
        }
    }
    return previews;
}
