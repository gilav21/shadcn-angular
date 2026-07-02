import { execa } from 'execa';
import { fetchAndTransform, transformSource, type FetchOptions, type SourceKind } from './fetch.js';
import { getLocalComponentsDir, getRepoSlug, validateBranch } from '../utils/paths.js';
import { DEFAULT_PREFIX } from '../utils/prefix.js';

/**
 * Resolve the version a component is pinned at (its recorded `ref`) and fetch a
 * file's content as of that ref. Two transports:
 *  - **local-dir mode** (monorepo / offline): git — `rev-parse HEAD` for the
 *    current ref, `git show <ref>:<repo-path>` for historical content.
 *  - **remote (default GitHub) registry**: the GitHub commits API for branch→SHA
 *    and the ref-pinned raw URL for content (a SHA works in place of a branch).
 *
 * Both return `null` for a custom non-GitHub registry or on any failure, so the
 * caller (the merge write-path) can fall back to today's whole-file behavior.
 */

/** True when installing from the in-repo component sources rather than the network. */
function isLocalMode(options: FetchOptions): boolean {
    return getLocalComponentsDir() !== null && !options.remote;
}

/**
 * Run a git command in `cwd`, returning raw stdout or `null` on failure.
 * `stripFinalNewline: false` keeps file content byte-identical (execa@9 strips
 * the trailing newline by default — that would inject a phantom EOF hunk into
 * the merge); callers that want a trimmed token (`rev-parse`) trim themselves.
 */
async function gitOutput(args: readonly string[], cwd: string): Promise<string | null> {
    try {
        const { stdout } = await execa('git', args, { cwd, stripFinalNewline: false });
        return stdout;
    } catch {
        return null;
    }
}

async function resolveLocalRef(): Promise<string | null> {
    const dir = getLocalComponentsDir();
    if (!dir) return null;
    const out = await gitOutput(['rev-parse', 'HEAD'], dir);
    return out === null ? null : out.trim() || null;
}

async function resolveRemoteSha(branch: string): Promise<string | null> {
    try {
        validateBranch(branch);
    } catch {
        return null;
    }
    const { owner, repo } = getRepoSlug();
    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;
    try {
        const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
        if (!res.ok) return null;
        const data = await res.json() as { sha?: unknown };
        return typeof data.sha === 'string' ? data.sha : null;
    } catch {
        return null;
    }
}

/** Resolve the branch in `options` to a commit ref, or `null` when not resolvable. */
export async function resolveRef(options: FetchOptions): Promise<string | null> {
    // Local-dir mode serves content from the monorepo regardless of `registry`
    // (see fetch.ts), so a stray registry override must not disable merging here.
    if (isLocalMode(options)) return resolveLocalRef();
    if (options.registry) return null;
    return resolveRemoteSha(options.branch);
}

/** Repo-relative path of a registry file for `git show`. */
function repoPathFor(file: string, kind: SourceKind): string {
    return kind === 'block' ? `packages/blocks/${file}` : `packages/components/ui/${file}`;
}

async function fetchAtRefLocal(
    file: string, ref: string, utilsAlias: string, prefix: string, kind: SourceKind,
): Promise<string | null> {
    const dir = getLocalComponentsDir();
    if (!dir) return null;
    const raw = await gitOutput(['show', `${ref}:${repoPathFor(file, kind)}`], dir);
    return raw === null ? null : transformSource(file, raw, utilsAlias, prefix);
}

/** Fetch `file` as of `ref`, transformed into the consumer's prefix/alias space. */
export async function fetchAtRef(
    file: string,
    ref: string,
    options: FetchOptions,
    utilsAlias: string,
    prefix: string = DEFAULT_PREFIX,
    kind: SourceKind = 'component',
): Promise<string | null> {
    if (isLocalMode(options)) return fetchAtRefLocal(file, ref, utilsAlias, prefix, kind);
    if (options.registry) return null;
    try {
        return await fetchAndTransform(file, { ...options, branch: ref, remote: true }, utilsAlias, prefix, kind);
    } catch {
        return null;
    }
}
