/**
 * Pure helpers for `npm run release:cli` — argument parsing, semver bumping,
 * conventional-commit changelog rendering, and the publish-required detector.
 *
 * Everything here is a value→value function so the release flow is unit-testable
 * without touching git, npm or disk (see `release-cli.spec.ts`). The fs /
 * child-process side lives in `release-cli.ts`.
 *
 * ── Why a publish-required detector? ────────────────────────────────────
 * The published CLI fetches the registry manifest AND all component/lib source
 * from the git branch at runtime (`src/registry/load.ts`, `src/core/fetch.ts`).
 * So component edits, lib edits and registry *data* edits ship the moment they
 * land on master — republishing for them is pure noise. A publish is only
 * required when the BUNDLED CLI changes:
 *
 *   1. CLI logic — real code under `packages/cli/src/**` (commands, core/, mcp/,
 *      utils/, registry/load.ts, and the helper functions in registry/index.ts).
 *   2. The manifest SHAPE — the `ComponentDefinition` interface and the
 *      `isValidRegistryShape` validator. An installed CLI can't parse a
 *      registry.json whose shape it predates.
 *   3. Utils baselines — `registry/*-baselines.ts`, `core/baseline.ts`.
 *   4. Packaging — `packages/cli/package.json` (deps, bin), tsconfig, README
 *      (shipped in `files[]`).
 *
 * `registry/index.ts` is the subtle one: it is BOTH the manifest shape + helper
 * logic AND an offline-fallback DATA snapshot of the registry. A regenerated
 * snapshot alone does not warrant a publish, so the detector strips the
 * `defineRegistry({...})` literal from both revisions and compares only what's
 * left (`stripRegistryData`).
 */

export const BUMP_LEVELS = ['patch', 'minor', 'major'] as const;
export type BumpLevel = (typeof BUMP_LEVELS)[number];

export interface ReleaseArgs {
    readonly level: BumpLevel;
    readonly dryRun: boolean;
    readonly allowDirty: boolean;
    readonly allowBranch: boolean;
    readonly skipPreflight: boolean;
    readonly force: boolean;
}

export class ArgError extends Error {}

export function isBumpLevel(value: string): value is BumpLevel {
    return (BUMP_LEVELS as readonly string[]).includes(value);
}

/** Parses the argv tail after `release:cli --`. Throws `ArgError` on misuse. */
export function parseArgs(argv: readonly string[]): ReleaseArgs {
    const flags = argv.filter((a) => a.startsWith('--'));
    const positionals = argv.filter((a) => !a.startsWith('--'));

    const known = new Set(['--dry-run', '--allow-dirty', '--allow-branch', '--skip-preflight', '--force']);
    const unknown = flags.find((f) => !known.has(f));
    if (unknown) throw new ArgError(`Unknown flag: ${unknown}`);

    if (positionals.length === 0) throw new ArgError('Missing bump level. Expected one of: patch | minor | major');
    if (positionals.length > 1) throw new ArgError(`Too many arguments: ${positionals.join(' ')}`);

    const level = positionals[0];
    if (!isBumpLevel(level)) throw new ArgError(`Invalid bump level "${level}". Expected one of: patch | minor | major`);

    return {
        level,
        dryRun: flags.includes('--dry-run'),
        allowDirty: flags.includes('--allow-dirty'),
        allowBranch: flags.includes('--allow-branch'),
        skipPreflight: flags.includes('--skip-preflight'),
        force: flags.includes('--force'),
    };
}

// ── Version ─────────────────────────────────────────────────────────────

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

/** Bumps a plain `x.y.z` version. Pre-release / build metadata is rejected. */
export function bumpVersion(current: string, level: BumpLevel): string {
    const match = SEMVER_REGEX.exec(current.trim());
    if (!match) throw new ArgError(`Cannot bump non-semver version "${current}" (expected x.y.z)`);

    const [major, minor, patch] = match.slice(1, 4).map((n) => Number.parseInt(n, 10));
    if (level === 'major') return `${major + 1}.0.0`;
    if (level === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
}

/** Rewrites the `"version"` field of a package.json source, preserving formatting. */
export function setPackageVersion(source: string, version: string): string {
    const replaced = source.replace(/("version"\s*:\s*)"[^"]+"/, `$1"${version}"`);
    if (replaced === source) throw new ArgError('Could not find a "version" field to rewrite in package.json');
    return replaced;
}

export function readPackageVersion(source: string): string {
    const match = /"version"\s*:\s*"([^"]+)"/.exec(source);
    if (!match) throw new ArgError('No "version" field in package.json');
    return match[1];
}

export function tagName(version: string): string {
    return `cli-v${version}`;
}

// ── Publish-required detector ───────────────────────────────────────────

export type PathKind =
    /** Bundled CLI code / packaging — a change here REQUIRES a publish. */
    | 'cli-logic'
    /** `registry/index.ts` — needs a shape-vs-data diff to decide. */
    | 'registry-module'
    /** Served live from the branch, or never shipped — no publish needed. */
    | 'live';

const CLI_PREFIX = 'packages/cli/';
const REGISTRY_MODULE = 'packages/cli/src/registry/index.ts';

/** Dev-only tooling inside packages/cli that never enters the tarball. */
function isCliDevOnly(file: string): boolean {
    return (
        file.startsWith(`${CLI_PREFIX}scripts/`) ||
        file.endsWith('.spec.ts') ||
        file.endsWith('.test.ts') ||
        file.startsWith(`${CLI_PREFIX}dist/`)
    );
}

export function classifyPath(file: string): PathKind {
    const normalized = file.replaceAll('\\', '/');
    if (!normalized.startsWith(CLI_PREFIX)) return 'live';
    if (isCliDevOnly(normalized)) return 'live';
    if (normalized === REGISTRY_MODULE) return 'registry-module';
    return 'cli-logic';
}

/**
 * Removes the `export const registry = defineRegistry({ … })` literal from a
 * `registry/index.ts` source, leaving the manifest SHAPE (interfaces) and the
 * helper LOGIC around it. Two revisions whose stripped sources are identical
 * differ only in registry DATA — which the live CLI fetches from the branch, so
 * it needs no publish.
 */
export function stripRegistryData(source: string): string {
    const marker = 'registry = defineRegistry(';
    const start = source.indexOf(marker);
    if (start === -1) return source;

    let depth = 0;
    for (let i = start + marker.length - 1; i < source.length; i += 1) {
        const char = source[i];
        if (char === '(') depth += 1;
        else if (char === ')') {
            depth -= 1;
            if (depth === 0) return source.slice(0, start) + source.slice(i + 1);
        }
    }
    return source.slice(0, start);
}

export interface PublishVerdict {
    readonly required: boolean;
    /** Files that force a publish. */
    readonly triggers: readonly string[];
    /** Human-readable reasons, one per line. */
    readonly reasons: readonly string[];
}

export interface VerdictInput {
    readonly changedFiles: readonly string[];
    /** `registry/index.ts` minus its data literal, at the base ref. Null if absent/unchanged. */
    readonly registryShapeBefore: string | null;
    /** Same, at HEAD. */
    readonly registryShapeAfter: string | null;
}

export function publishVerdict(input: VerdictInput): PublishVerdict {
    const triggers: string[] = [];
    const reasons: string[] = [];
    let registryDataOnly = false;

    for (const file of input.changedFiles) {
        const kind = classifyPath(file);
        if (kind === 'cli-logic') {
            triggers.push(file);
        } else if (kind === 'registry-module') {
            const shapeChanged = input.registryShapeBefore !== input.registryShapeAfter;
            if (shapeChanged) {
                triggers.push(file);
                reasons.push(`${file} — manifest SHAPE / helper logic changed (not just the data snapshot)`);
            } else {
                registryDataOnly = true;
            }
        }
    }

    if (triggers.length > 0) {
        if (triggers.some((f) => f !== REGISTRY_MODULE)) {
            reasons.unshift(`${triggers.length} bundled CLI file(s) changed — the published tarball is stale`);
        }
        return { required: true, triggers, reasons };
    }

    if (registryDataOnly) {
        reasons.push(
            `${REGISTRY_MODULE} changed, but only its registry DATA snapshot — the live CLI fetches ` +
            'registry.json from the branch, so this ships on merge with no publish',
        );
    }
    reasons.push('No bundled CLI logic, manifest shape or baseline changed — a publish may be unnecessary.');
    return { required: false, triggers: [], reasons };
}

// ── Changelog ───────────────────────────────────────────────────────────

export interface Commit {
    readonly hash: string;
    readonly subject: string;
}

export interface ParsedCommit {
    readonly hash: string;
    readonly type: string;
    readonly scope: string | null;
    readonly breaking: boolean;
    readonly description: string;
}

const CONVENTIONAL_REGEX = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:(?<desc>.+)$/i;

export function parseCommit(commit: Commit): ParsedCommit | null {
    const match = CONVENTIONAL_REGEX.exec(commit.subject.trim());
    if (!match?.groups) return null;
    return {
        hash: commit.hash,
        type: match.groups['type'].toLowerCase(),
        scope: match.groups['scope'] ?? null,
        breaking: match.groups['bang'] === '!',
        description: match.groups['desc'].trim(),
    };
}

interface Section {
    readonly title: string;
    readonly types: readonly string[];
}

const SECTIONS: readonly Section[] = [
    { title: 'Features', types: ['feat'] },
    { title: 'Bug Fixes', types: ['fix'] },
    { title: 'Performance', types: ['perf'] },
    { title: 'Refactors', types: ['refactor'] },
    { title: 'Docs', types: ['docs'] },
    { title: 'Chores', types: ['chore', 'build', 'ci', 'style', 'test'] },
];

function renderEntry(commit: ParsedCommit): string {
    const scope = commit.scope ? `**${commit.scope}:** ` : '';
    return `- ${scope}${commit.description} (${commit.hash.slice(0, 8)})`;
}

function renderSection(title: string, commits: readonly ParsedCommit[]): string[] {
    if (commits.length === 0) return [];
    return [`### ${title}`, '', ...commits.map(renderEntry), ''];
}

/** Renders one `## <version>` release block from conventional commits. */
export function renderReleaseNotes(version: string, commits: readonly Commit[], date: string): string {
    const parsed = commits.map(parseCommit).filter((c): c is ParsedCommit => c !== null);
    const lines: string[] = [`## ${version} — ${date}`, ''];

    if (parsed.length === 0) {
        lines.push('_No conventional commits touching the CLI since the previous release._', '');
        return lines.join('\n');
    }

    lines.push(...renderSection('BREAKING CHANGES', parsed.filter((c) => c.breaking)));
    for (const section of SECTIONS) {
        const inSection = parsed.filter((c) => !c.breaking && section.types.includes(c.type));
        lines.push(...renderSection(section.title, inSection));
    }
    return lines.join('\n');
}

const CHANGELOG_HEADER = [
    '# Changelog',
    '',
    'All notable changes to `@gilav21/shadcn-angular` (the CLI package).',
    'Generated by `npm run release:cli` from conventional commits touching `packages/cli/`.',
    '',
].join('\n');

/** Prepends a release block below the changelog header, creating the file body if absent. */
export function prependRelease(existing: string | null, block: string): string {
    if (!existing?.trimStart().startsWith('# Changelog')) {
        return `${CHANGELOG_HEADER}\n${block.trimEnd()}\n`;
    }
    const headerEnd = existing.indexOf('\n## ');
    if (headerEnd === -1) {
        return `${existing.trimEnd()}\n\n${block.trimEnd()}\n`;
    }
    const header = existing.slice(0, headerEnd);
    const rest = existing.slice(headerEnd + 1);
    return `${header}\n\n${block.trimEnd()}\n\n${rest.trimEnd()}\n`;
}
