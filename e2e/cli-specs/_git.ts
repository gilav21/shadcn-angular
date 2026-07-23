import { execFileSync } from 'node:child_process';

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
    // --diff-filter=d excludes the deletion commit (the file is absent in its tree).
    // `HEAD` alongside `--all`: a CI PR run is a detached checkout of
    // refs/pull/N/merge, whose ancestry `--all` (branch/tag/remote refs only)
    // doesn't walk — so the legacy flat blob is unreachable without it. Locally
    // `--all` already covers HEAD.
    const commit = execFileSync(
        'git', ['-C', root, 'log', '--all', 'HEAD', '--diff-filter=d', '--pretty=format:%H', '--', rel],
        { encoding: 'utf-8' },
    ).split('\n')[0];
    if (!commit) throw new Error(`no historical blob found for ${rel}`);
    return execFileSync('git', ['-C', root, 'show', `${commit}:${rel}`], { encoding: 'utf-8' });
}
