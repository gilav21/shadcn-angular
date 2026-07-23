import { execFileSync } from 'node:child_process';
import { ensureFullHistory } from './_git.js';

/**
 * Seeds an *older* revision of a repository file into the fixture app so a spec
 * can replay an upgrade journey: a consumer who installed component/lib source
 * at an earlier version, then runs `doctor`/`update`. The whole e2e suite is
 * otherwise fresh-install-only (every spec installs current HEAD into a clean
 * app), so it never exercises the path where a stale local file must be
 * reconciled with newer registry source. These helpers fill that gap.
 *
 * Unlike a synthetic "make it different" edit, a *real* historical blob is the
 * faithful pre-upgrade state — the same content a real consumer would carry —
 * which matters because the CLI's drift detection compares normalized content,
 * and a hand-written stub could canonicalize differently than a true old copy.
 *
 * @see ./_git.ts `realLegacyBlob` — the narrower precedent this generalizes.
 */

function repoRoot(): string {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
}

/** The file's content at an explicit commit-ish (`<commit>:<path>`). */
export function historicalBlob(repoRelPath: string, commitish: string): string {
    const root = repoRoot();
    ensureFullHistory(root);
    return execFileSync('git', ['-C', root, 'show', `${commitish}:${repoRelPath}`], {
        encoding: 'utf-8',
    });
}

/** Commits that touched `repoRelPath`, newest first, excluding its deletion commit. */
function commitsTouching(root: string, repoRelPath: string): string[] {
    ensureFullHistory(root);
    const out = execFileSync(
        'git',
        ['-C', root, 'log', '--all', '--diff-filter=d', '--pretty=format:%H', '--', repoRelPath],
        { encoding: 'utf-8' },
    ).trim();
    return out ? out.split('\n') : [];
}

export interface OldBlobOptions {
    /**
     * Return the newest historical version of the file whose content does NOT
     * contain this marker — i.e. the last revision before the marker (a new
     * export, a renamed selector, a hardened type) was introduced. This is the
     * deterministic way to seed "the version a consumer had before feature X".
     */
    readonly before?: string;
    /** Return the file's content at this exact commit-ish instead of searching. */
    readonly at?: string;
}

/**
 * Returns an older revision of a repo file (path relative to the repo root, e.g.
 * `packages/components/lib/utils.ts`). Provide `at` for an explicit commit, or
 * `before` to find the last version that predates a marker string.
 *
 * Example — seed `utils.ts` as it was before `stringifyValue` was added:
 *   oldBlob('packages/components/lib/utils.ts', { before: 'stringifyValue' })
 */
export function oldBlob(repoRelPath: string, options: OldBlobOptions): string {
    if (options.at) return historicalBlob(repoRelPath, options.at);

    const marker = options.before;
    if (!marker) {
        throw new Error('oldBlob: provide either { at } or { before }');
    }

    const root = repoRoot();
    for (const commit of commitsTouching(root, repoRelPath)) {
        const content = historicalBlob(repoRelPath, commit);
        if (!content.includes(marker)) return content;
    }
    throw new Error(
        `oldBlob: no historical version of ${repoRelPath} predates marker ${JSON.stringify(marker)} ` +
        `(every commit that touched it already contains the marker)`,
    );
}
