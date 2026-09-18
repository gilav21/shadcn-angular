/**
 * `npm run stage:package -- <rte|data-table>`
 *
 * Regenerates one compiled package's `src/` tree and `schematics/` from the
 * registry closure. Nothing but WIRING: it resolves the repo root, and prints
 * and exits with what `runStage` decides — every decision, including the staged
 * paths, lives in `stage-package-lib.ts` and is unit-tested in process
 * (subprocess tests contribute nothing to v8 coverage).
 *
 * Like every maintainer script here, the repo root is resolved from this file's
 * OWN location, so `cwd` cannot redirect it and the subprocess tests can drive a
 * copy inside a throwaway repo.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { nodeStageEffects, runStage } from './stage-package-lib.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');

/** The composed effects, exported so the wiring itself is checkable. */
export const EFFECTS = nodeStageEffects(REPO_ROOT);

export function main(argv: readonly string[]): number {
    const outcome = runStage(argv, EFFECTS);
    for (const line of outcome.stdout) console.log(line);
    for (const line of outcome.stderr) console.error(line);
    return outcome.status;
}

/**
 * Exit only when RUN, never when imported. Guarding on the entry URL is what
 * lets a test import this module to check its wiring without the import
 * terminating the test process.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main(process.argv.slice(2)));
}
