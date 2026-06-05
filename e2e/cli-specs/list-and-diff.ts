import { assertContains, type CliSpec } from './_types.js';

/**
 * `list` and `diff` are read-only inspection commands. The suite
 * verifies their basic output shape so a refactor that breaks them
 * (renamed registry field, wrong cwd, missing locale handling) is
 * caught immediately.
 */
const spec: CliSpec = async ({ runCli, captureCli }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', 'badge', '--yes']);

    // list: button + badge should appear under "Installed"; an
    // arbitrary uninstalled component (e.g. accordion) under
    // "Available".
    const lst = await captureCli(['list']);
    if (lst.code !== 0) {
        throw new Error(`list exited with code ${lst.code}\n${lst.stdout}`);
    }
    assertContains(lst.stdout, 'installed', 'list output should label installed section');
    assertContains(lst.stdout, 'available', 'list output should label available section');
    assertContains(lst.stdout, 'button', 'button should appear in list output');
    assertContains(lst.stdout, 'badge', 'badge should appear in list output');
    assertContains(lst.stdout, 'accordion', 'an uninstalled component should still appear');

    // diff: nothing was modified after install, so it must report
    // "up to date".
    const dff = await captureCli(['diff']);
    if (dff.code !== 0) {
        throw new Error(`diff exited with code ${dff.code}\n${dff.stdout}`);
    }
    assertContains(dff.stdout, 'up to date',
        'fresh install should diff clean');
};

export default spec;
