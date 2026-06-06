import fs from 'node:fs';
import path from 'node:path';
import type { CliSpec } from './_types.js';

/**
 * Bug 2 regression: a peer file that is MISSING on disk (not merely changed)
 * must be (re)installed. `data-table` is the only component with peerFiles —
 * five context-menu directives delivered alongside it. The original bug skipped
 * "missing" peers (only "changed" were queued), so a consumer whose install
 * predated those directives could never get them and `ng build` broke.
 *
 * `data-table` was always a folder component (never a flat file), so this is
 * tested via the add/overwrite path rather than `migrate`: install it, delete
 * the peer directives to simulate the broken state, then `add --overwrite` and
 * assert all five are restored. (A plain re-`add` would "skip" the unchanged
 * component and never reach the peer-write step — `--overwrite` forces it.)
 */
const PEER_FILES = [
    'context-menu-attach.directive.ts',
    'context-menu-integrations.ts',
    'data-table-context-menu.directive.ts',
    'table-context-menu.directive.ts',
    'tree-context-menu.directive.ts',
];

const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'data-table', '--yes']);

    const uiDir = path.join(fixtureApp, 'src/components/ui');

    // Sanity: a fresh install delivered the peer files.
    for (const file of PEER_FILES) {
        if (!fs.existsSync(path.join(uiDir, file))) {
            throw new Error(`setup: expected ${file} after a fresh data-table install`);
        }
    }

    // Simulate the broken state: the peer directives were never delivered.
    for (const file of PEER_FILES) fs.rmSync(path.join(uiDir, file), { force: true });

    // Re-classify with overwrite: the now-"missing" peers must be reinstalled.
    await runCli(['add', 'data-table', '--overwrite', '--yes']);

    for (const file of PEER_FILES) {
        if (!fs.existsSync(path.join(uiDir, file))) {
            throw new Error(`Bug 2: missing peer file ${file} was not reinstalled`);
        }
    }
};

export default spec;
