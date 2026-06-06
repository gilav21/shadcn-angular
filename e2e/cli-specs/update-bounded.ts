import fs from 'node:fs';
import path from 'node:path';
import { assertContains, assertNotContains, type CliSpec } from './_types.js';

/**
 * Proves the two `update` regressions are fixed:
 *  - `update <name>` only touches the named component + already-installed
 *    deps, NOT the full transitive closure (the reported bug rewrote 16
 *    components and installed brand-new ones).
 *  - `--dry-run` reports what it would do and writes nothing.
 */
const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']);

    const uiDir = path.join(fixtureApp, 'src/components/ui');
    const before = fs.readdirSync(uiDir).sort();

    // Introduce local drift so `update` has something to write.
    const buttonTs = path.join(uiDir, 'button/button.component.ts');
    fs.appendFileSync(buttonTs, '\n// local drift\n');
    const driftedContent = fs.readFileSync(buttonTs, 'utf-8');

    // --- dry-run: must list button and change nothing on disk ---
    const dry = await captureCli(['update', 'button', '--dry-run']);
    if (dry.code !== 0) {
        throw new Error(`update --dry-run exited ${dry.code}\n${dry.stdout}`);
    }
    assertContains(dry.stdout, 'button', 'dry-run should list the component it would update');
    assertContains(dry.stdout, 'Dry Run', 'dry-run must announce itself');

    const afterDry = fs.readdirSync(uiDir).sort();
    if (JSON.stringify(afterDry) !== JSON.stringify(before)) {
        throw new Error(
            `dry-run must not add/remove component folders.\nbefore: ${before}\nafter:  ${afterDry}`,
        );
    }
    // dry-run must not touch file CONTENTS either.
    if (fs.readFileSync(buttonTs, 'utf-8') !== driftedContent) {
        throw new Error('dry-run must not modify file contents');
    }

    // --- real run: bounded to button (+ its installed dep ripple) ---
    const run = await captureCli(['update', 'button', '--yes']);
    if (run.code !== 0) {
        throw new Error(`update exited ${run.code}\n${run.stdout}`);
    }
    assertContains(run.stdout, 'Updated', 'update should report completion');

    // No unrelated component should be installed by `update button`.
    const afterRun = fs.readdirSync(uiDir);
    for (const stray of ['dialog', 'select', 'calendar', 'command', 'popover', 'data-table']) {
        if (afterRun.includes(stray)) {
            throw new Error(`update button must not install unrelated component "${stray}"`);
        }
    }
    // The blast-radius bug printed "Updated 16 component(s)"; it must stay small.
    assertNotContains(run.stdout, 'Updated 16', 'update must not fan out to the full closure');
};

export default spec;
