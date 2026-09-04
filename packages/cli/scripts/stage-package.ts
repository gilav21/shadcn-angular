/**
 * `npm run stage:package -- <rte|data-table>`
 *
 * Regenerates one compiled package's `src/` tree and `theme.css` from the
 * registry closure. Thin on purpose: argv, I/O and exit codes only — every
 * decision lives in `stage-package-lib.ts`, which is unit-tested in process
 * (subprocess tests contribute nothing to v8 coverage).
 *
 * Like every maintainer script here, the repo root is resolved from this file's
 * OWN location, so `cwd` cannot redirect it and the subprocess tests can drive a
 * copy inside a throwaway repo.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    PACKAGE_IDS,
    auditStagedImports,
    isPackageId,
    packageDir,
    stagePackage,
} from './stage-package-lib.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');

function usage(): string {
    return `Usage: npm run stage:package -- <${PACKAGE_IDS.join('|')}>`;
}

function main(): number {
    const id = process.argv[2];

    if (!id) {
        console.error('Missing package id.');
        console.error(usage());
        return 1;
    }
    if (!isPackageId(id)) {
        console.error(`Unknown package "${id}".`);
        console.error(usage());
        return 1;
    }

    const result = stagePackage(id, REPO_ROOT);
    const srcRoot = path.join(REPO_ROOT, packageDir(id), 'src');

    // The closure is only useful if it is EXACT: an import that escapes the
    // staged tree means a file the registry never declared, and ng-packagr would
    // fail minutes later with a far less obvious message.
    const unresolved = auditStagedImports(srcRoot);
    if (unresolved.length > 0) {
        console.error(`[stage-package] ${id}: ${unresolved.length} import(s) escape the staged tree:`);
        for (const entry of unresolved) console.error(`  ${entry}`);
        return 1;
    }

    console.log(`[stage-package] ${id}: staged ${result.written} files (removed ${result.removed} stale).`);
    console.log(`[stage-package] ${id}: ${path.relative(REPO_ROOT, srcRoot)} + theme.css`);
    return 0;
}

process.exit(main());
