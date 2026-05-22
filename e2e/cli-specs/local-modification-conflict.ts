import fs from 'node:fs';
import path from 'node:path';
import { assertContains, assertEquals, type CliSpec } from './_types.js';

/**
 * Install a component, modify it locally, re-run `add` and assert the
 * CLI detects the conflict and preserves the local edit (no
 * --overwrite). Then re-run with --overwrite and assert the local edit
 * is replaced by the canonical content.
 */
const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']);

    const buttonTs = path.join(fixtureApp, 'src/components/ui/button/button.component.ts');
    const original = fs.readFileSync(buttonTs, 'utf-8');
    const marker = '// MARKER ' + Date.now();
    fs.writeFileSync(buttonTs, marker + '\n' + original);

    // Re-add without --overwrite: the CLI's --yes flag means "accept
    // any prompts", which in this codebase translates to "overwrite all
    // conflicts". So `--yes` actually triggers overwrite. To verify the
    // PRESERVE path we re-add without --yes AND without --overwrite —
    // but that would prompt interactively and hang. Use --dry-run
    // instead: the CLI must list button as conflicting in the dry
    // summary AND must NOT modify the file on disk.
    const { stdout: dryStdout, code: dryCode } = await captureCli([
        'add', 'button', '--dry-run',
    ]);
    if (dryCode !== 0) {
        throw new Error(`dry-run exited with code ${dryCode}\n${dryStdout}`);
    }
    assertContains(dryStdout, 'Dry Run',
        'dry-run output should announce itself');
    assertContains(dryStdout, 'button',
        'dry-run should mention the conflicting button');

    // File still has our marker (dry-run didn't write).
    assertEquals(
        fs.readFileSync(buttonTs, 'utf-8').startsWith(marker),
        true,
        'dry-run must not modify local files',
    );

    // Now re-add with --overwrite: file should lose the marker.
    await runCli(['add', 'button', '--overwrite', '--yes']);
    assertEquals(
        fs.readFileSync(buttonTs, 'utf-8').includes(marker),
        false,
        'after --overwrite the local marker must be gone',
    );
};

export default spec;
