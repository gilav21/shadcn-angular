import { assertContains, assertEquals, type CliSpec } from './_types.js';

/**
 * `add` must fail gracefully on an unknown component name: non-zero
 * exit, no partial install, and a helpful message that points at the
 * list of available components. Regression: an earlier version silently
 * exited 0 after printing a warning.
 */
const spec: CliSpec = async ({ runCli, captureCli }) => {
    await runCli(['init', '--yes']);

    const { stdout, code } = await captureCli(['add', 'not-a-real-component', '--yes']);

    assertEquals(code !== 0, true, 'add with unknown component should exit non-zero');
    assertContains(stdout, 'not-a-real-component',
        'error message should mention the name the user typed');
    assertContains(stdout, 'Available components',
        'error message should hint at the available components list');
};

export default spec;
