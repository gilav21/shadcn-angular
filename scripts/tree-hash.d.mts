/**
 * Fingerprint of the working tree — tracked blobs, uncommitted diff and
 * untracked non-ignored files. See tree-hash.mjs.
 *
 * @param cwd repository root; defaults to `process.cwd()`.
 * @returns 64-char hex digest.
 */
export function treeHash(cwd?: string): string;
