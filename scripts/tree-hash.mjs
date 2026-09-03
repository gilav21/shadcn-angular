// A fingerprint of the working tree, so a coverage report can say which tree
// it measured. `npm run coverage` writes it next to the lcov; `npm run sonar`
// compares it to the tree being scanned and refuses to call stale coverage
// "true" — the check used to live in the human's memory ("did I run coverage
// before this scan?"), which is the one place it cannot be trusted.
//
// Three inputs, all cheap (well under a second on this repo):
//   - `git ls-files -s`          tracked files with their blob hashes and modes
//   - `git diff HEAD`            every staged and unstaged change to them
//   - untracked, non-ignored files, by path, size and mtime
//
// Anything that could change what the test suite covers is in there: source,
// specs, configs, the lockfile. Ignored files (node_modules, coverage/, caches)
// are deliberately not — regenerating a cache must not invalidate a report.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} [cwd] repository root; defaults to the current directory.
 * @returns {string} 64-char hex digest.
 */
export function treeHash(cwd = process.cwd()) {
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

  const hash = createHash('sha256');
  hash.update(git('ls-files', '-s'));
  hash.update(git('diff', 'HEAD', '--no-color', '--no-ext-diff'));
  for (const file of git('ls-files', '--others', '--exclude-standard').split('\n')) {
    if (!file) continue;
    try {
      const stat = statSync(join(cwd, file));
      hash.update(`${file}:${stat.size}:${stat.mtimeMs}\n`);
    } catch {
      // Listed a moment ago, gone now — it cannot have been covered either.
    }
  }
  return hash.digest('hex');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(`${treeHash()}\n`);
}
