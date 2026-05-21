import { assertContains, assertEquals, type CliSpec } from './_types.js';

/**
 * `add` before `init` must surface a clear "run init first" message and
 * exit non-zero. Without this guard, `add` would try to copy files into
 * undefined alias paths and produce a confusing crash deeper in the
 * pipeline. Regression check for the precondition.
 */
const spec: CliSpec = async ({ captureCli }) => {
    // No init beforehand — fresh fixture, no components.json.
    const { stdout, code } = await captureCli(['add', 'button', '--yes']);

    assertEquals(code !== 0, true, 'add without init should exit non-zero');
    assertContains(stdout, 'components.json',
        'error should mention the missing config file');
    assertContains(stdout, 'init',
        'error should tell the user to run init first');
};

export default spec;
