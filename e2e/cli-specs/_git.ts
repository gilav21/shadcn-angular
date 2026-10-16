import { execFileSync } from 'node:child_process';

/**
 * Deepen a shallow checkout so the legacy-blob lookups below can reach
 * pre-migration / pre-marker history. On CI a PR is checked out from
 * `refs/pull/N/merge`, which `actions/checkout` leaves **shallow** (its
 * ancestry is truncated at the merge-base) even with `fetch-depth: 0` — so the
 * old commits these specs need are absent. A local checkout is already
 * complete, so this is a no-op there.
 */
export function ensureFullHistory(root: string): void {
    const shallow = execFileSync('git', ['-C', root, 'rev-parse', '--is-shallow-repository'], {
        encoding: 'utf-8',
    }).trim();
    if (shallow !== 'true') return;
    // --unshallow errors on an already-complete repo, so it's guarded above.
    execFileSync('git', ['-C', root, 'fetch', '--tags', '--unshallow', '--quiet', 'origin'], {
        encoding: 'utf-8',
    });
}

/**
 * Returns a real historical blob of a component source file from this repo's
 * git history (`rel` is relative to `packages/components/ui`). Specs need
 * *pristine* content — content that canonicalizes to a baked baseline hash —
 * because the CLI deliberately leaves anything else alone as possibly edited.
 * Synthetic content would be (correctly) kept, so the assertions would never fire.
 */
export function realHistoricalBlob(rel: string): string {
    const path = `packages/components/ui/${rel}`;
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
    ensureFullHistory(root);
    // --diff-filter=d excludes the deletion commit (the file is absent in its tree).
    const commit = execFileSync(
        'git', ['-C', root, 'log', '--all', '--diff-filter=d', '--pretty=format:%H', '--', path],
        { encoding: 'utf-8' },
    ).split('\n')[0];
    if (!commit) throw new Error(`no historical blob found for ${path}`);
    return execFileSync('git', ['-C', root, 'show', `${commit}:${path}`], { encoding: 'utf-8' });
}

/** A real historical blob of a legacy flat component (`ui/<name>.component.ts`). */
export function realLegacyBlob(name: string): string {
    return realHistoricalBlob(`${name}.component.ts`);
}
