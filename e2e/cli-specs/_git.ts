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
 * Returns a real historical blob of a legacy flat component from this repo's
 * git history. The migrate specs need *pristine* legacy content — content that
 * canonicalizes to a baked baseline hash so migrate classifies it as
 * unmodified and converts it. Synthetic content would be (correctly) flagged as
 * customized and left alone, so the migrate assertions would never fire.
 */
export function realLegacyBlob(name: string): string {
    const rel = `packages/components/ui/${name}.component.ts`;
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
    ensureFullHistory(root);
    // --diff-filter=d excludes the deletion commit (the file is absent in its tree).
    const commit = execFileSync(
        'git', ['-C', root, 'log', '--all', '--diff-filter=d', '--pretty=format:%H', '--', rel],
        { encoding: 'utf-8' },
    ).split('\n')[0];
    if (!commit) throw new Error(`no historical blob found for ${rel}`);
    return execFileSync('git', ['-C', root, 'show', `${commit}:${rel}`], { encoding: 'utf-8' });
}
