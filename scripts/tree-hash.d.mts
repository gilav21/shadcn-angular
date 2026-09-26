/**
 * Fingerprint of the working tree — tracked blobs, uncommitted diff and
 * untracked non-ignored files. See tree-hash.mjs.
 *
 * @param cwd repository root; defaults to `process.cwd()`.
 * @returns 64-char hex digest.
 */
export function treeHash(cwd?: string): string;

/**
 * The current environment without any `GIT_*` variable, so a git command run
 * with `cwd` targets that directory rather than a repository a git hook
 * exported. See tree-hash.mjs.
 */
export function envForGitAt(): NodeJS.ProcessEnv;
