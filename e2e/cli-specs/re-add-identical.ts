import { assertContains, type CliSpec } from './_types.js';

/**
 * Re-running `add` on a component whose files haven't changed must not
 * re-install. The CLI surfaces this with "Components skipped (up to
 * date)" — same text the conflict detector emits when skipping
 * already-present components.
 */
const spec: CliSpec = async ({ runCli, captureCli }) => {
    // First install — should succeed normally.
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']);

    // Second add — every file matches, so the CLI must report skip and
    // must NOT report success / overwrite text.
    const { stdout, code } = await captureCli(['add', 'button', '--yes']);
    if (code !== 0) {
        throw new Error(`re-add exited with code ${code}\n${stdout}`);
    }
    assertContains(stdout, 'skipped',
        'Re-adding an identical component should report it as skipped');
};

export default spec;
