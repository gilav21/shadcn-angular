import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertContains, assertNotContains, assertEquals, type CliSpec, type CliSpecContext } from './_types.js';

/**
 * Real-CLI gate for the non-destructive (3-way merge) update feature.
 *
 * In local-dir mode the CLI fetches THEIRS from the monorepo working tree and
 * BASE via `git show <recorded-ref>:<path>` — the ref is recorded at `add` time
 * (= HEAD). So to make THEIRS differ from BASE we temporarily edit the monorepo
 * button source (the "upstream change", uncommitted: BASE stays at HEAD while
 * THEIRS becomes the edit) and ALWAYS restore it in `finally`. All three inputs
 * (BASE, OURS, THEIRS) flow through the same prefix/alias transform, so the only
 * varying axis is the change we inject.
 *
 * Asserts: a non-conflicting edit survives an upstream change with no markers
 * (clean 3-way merge); a conflicting edit yields <<< markers AND a non-zero exit
 * under --yes; --overwrite clobbers; --dry-run writes nothing; and a ref-less
 * (pre-feature) manifest falls back to keep-and-warn without crashing.
 */

interface Ctx {
    readonly cli: CliSpecContext;
    readonly fixTs: string;
    readonly monoTs: string;
    readonly original: string;
    readonly lockFile: string;
}

const readFix = (c: Ctx): string => fs.readFileSync(c.fixTs, 'utf-8');
const writeFix = (c: Ctx, content: string): void => fs.writeFileSync(c.fixTs, content);
const setMonoUpstream = (c: Ctx, token: string): void => fs.writeFileSync(c.monoTs, c.original + `\n// ${token}\n`);
const restoreMono = (c: Ctx): void => fs.writeFileSync(c.monoTs, c.original);

/** Reset the installed button to the canonical version (working tree must be `original`). */
const freshInstall = (c: Ctx): Promise<void> => c.cli.runCli(['add', 'button', '--overwrite', '--yes']);

/** A non-conflicting edit survives an upstream change with no markers. */
async function cleanMerge(c: Ctx): Promise<void> {
    await freshInstall(c);
    writeFix(c, `// USER_EDIT_TOP\n${readFix(c)}`); // user edits the top
    setMonoUpstream(c, 'UPSTREAM_BOTTOM'); // upstream appends at the bottom
    const res = await c.cli.captureCli(['update', 'button', '--yes']);
    assertEquals(res.code, 0, `clean merge should exit 0\n${res.stdout}`);
    const merged = readFix(c);
    assertContains(merged, 'USER_EDIT_TOP', 'the user edit must survive the merge');
    assertContains(merged, 'UPSTREAM_BOTTOM', 'the upstream change must be applied');
    assertNotContains(merged, '<<<<<<<', 'a clean merge writes no conflict markers');
    restoreMono(c);
}

/**
 * A merged edit must survive a SECOND consecutive update (the durable-
 * customization scenario). Regression guard: if the manifest baseline recorded
 * the merged result instead of the pristine upstream, the unedited-since-merge
 * file would equal its baseline and the refresh fast-path would silently
 * clobber the earlier edit.
 */
async function editSurvivesSecondUpdate(c: Ctx): Promise<void> {
    await freshInstall(c);
    writeFix(c, `// USER_PERSIST\n${readFix(c)}`); // user edit (top)
    setMonoUpstream(c, 'UPSTREAM_ONE'); // first upstream change (bottom)
    let res = await c.cli.captureCli(['update', 'button', '--yes']);
    assertEquals(res.code, 0, `first update should be clean\n${res.stdout}`);
    assertContains(readFix(c), 'USER_PERSIST', 'edit present after the first update');
    assertContains(readFix(c), 'UPSTREAM_ONE', 'first upstream change applied');

    // Second update: the user does NOT re-edit; upstream additionally changes a
    // disjoint middle line (and keeps UPSTREAM_ONE so it's a strict advance).
    const lines = c.original.split('\n');
    lines[Math.floor(lines.length / 2)] = '// UPSTREAM_TWO';
    fs.writeFileSync(c.monoTs, `${lines.join('\n')}\n// UPSTREAM_ONE\n`);
    res = await c.cli.captureCli(['update', 'button', '--yes']);
    assertEquals(res.code, 0, `second update should be clean (no conflict)\n${res.stdout}`);
    const after = readFix(c);
    assertContains(after, 'USER_PERSIST', 'the user edit MUST survive a second update (no fast-path clobber)');
    assertContains(after, 'UPSTREAM_TWO', 'second upstream change applied');
    assertNotContains(after, '<<<<<<<', 'second update is clean, no markers');
    restoreMono(c);
}

/** An edit and an upstream change on the same line conflict (markers + non-zero exit). */
async function realConflict(c: Ctx): Promise<void> {
    await freshInstall(c);
    const ours = readFix(c).split('\n');
    ours[0] = '// OURS_FIRST_LINE';
    writeFix(c, ours.join('\n'));
    const upstream = c.original.split('\n');
    upstream[0] = '// UPSTREAM_FIRST_LINE';
    fs.writeFileSync(c.monoTs, upstream.join('\n'));
    const res = await c.cli.captureCli(['update', 'button', '--yes']);
    assertEquals(res.code !== 0, true, `a written conflict must exit non-zero under --yes\n${res.stdout}`);
    const conflicted = readFix(c);
    assertContains(conflicted, '<<<<<<<', 'conflict open marker must be written');
    assertContains(conflicted, '=======', 'conflict separator must be written');
    assertContains(conflicted, '>>>>>>>', 'conflict close marker must be written');
    assertContains(conflicted, 'OURS_FIRST_LINE', 'our side is preserved in the conflict');
    assertContains(conflicted, 'UPSTREAM_FIRST_LINE', 'their side is preserved in the conflict');
    restoreMono(c);
}

/** `--overwrite` clobbers the local edit whole-file. */
async function overwriteClobbers(c: Ctx): Promise<void> {
    await freshInstall(c);
    writeFix(c, `// CLOBBER_ME\n${readFix(c)}`);
    const res = await c.cli.captureCli(['update', 'button', '--overwrite', '--yes']);
    assertEquals(res.code, 0, `--overwrite should exit 0\n${res.stdout}`);
    assertNotContains(readFix(c), 'CLOBBER_ME', '--overwrite must discard the local edit');
}

/** `--dry-run` reports without writing. */
async function dryRunWritesNothing(c: Ctx): Promise<void> {
    await freshInstall(c);
    writeFix(c, `// DRYRUN_EDIT\n${readFix(c)}`);
    const before = readFix(c);
    setMonoUpstream(c, 'DRYRUN_UPSTREAM'); // a real run WOULD write
    const res = await c.cli.captureCli(['update', 'button', '--dry-run']);
    assertEquals(res.code, 0, `dry-run should exit 0\n${res.stdout}`);
    assertEquals(readFix(c), before, 'dry-run must not modify any file');
    restoreMono(c);
}

/** A ref-less (pre-feature) manifest falls back to keep-and-warn without crashing. */
async function backCompatFallback(c: Ctx): Promise<void> {
    await freshInstall(c);
    writeFix(c, `// LEGACY_EDIT\n${readFix(c)}`);
    const manifest = JSON.parse(fs.readFileSync(c.lockFile, 'utf-8')) as { components?: unknown };
    delete manifest.components; // simulate a manifest written before per-component refs
    fs.writeFileSync(c.lockFile, JSON.stringify(manifest, null, 2));
    setMonoUpstream(c, 'LEGACY_UPSTREAM');
    const res = await c.cli.captureCli(['update', 'button', '--yes']);
    assertEquals(res.code, 0, `back-compat fallback should exit 0 (no conflict)\n${res.stdout}`);
    const legacy = readFix(c);
    assertContains(legacy, 'LEGACY_EDIT', 'fallback keeps the local edit (no baseline → no clobber)');
    assertNotContains(legacy, '<<<<<<<', 'fallback writes no markers');
    assertContains(res.stdout, 'no recorded baseline', 'fallback prints the one-line notice');
    restoreMono(c);
}

/**
 * `update`'s post-merge "run apply <addon> now?" prompt (added for data-table's
 * rowActions/enableColumnMenu → context-menu addon breaking change) must be
 * skipped entirely under `--yes` — no prompt, no addon auto-install — since a
 * non-interactive run can't be asked and installing an addon edits app code,
 * a bigger action than the file merge `update` already performs.
 */
async function addonSuggestionSkippedUnderYes(cli: CliSpecContext, repoRoot: string): Promise<void> {
    const dtMonoTs = path.join(repoRoot, 'packages/components/ui/data-table/data-table.component.ts');
    const dtOriginal = fs.readFileSync(dtMonoTs, 'utf-8');
    const dtFixTs = path.join(cli.fixtureApp, 'src/components/ui/data-table/data-table.component.ts');
    const addonDir = path.join(cli.fixtureApp, 'src/components/ui/data-table/addons/context-menu');
    try {
        await cli.runCli(['add', 'data-table', '--yes']);
        fs.writeFileSync(dtMonoTs, `${dtOriginal}\n// DATA_TABLE_UPSTREAM_CHANGE\n`);
        const res = await cli.captureCli(['update', 'data-table', '--yes']);
        assertEquals(res.code, 0, `update --yes must not hang/fail on an addon-suggesting breaking change\n${res.stdout}`);
        assertContains(fs.readFileSync(dtFixTs, 'utf-8'), 'DATA_TABLE_UPSTREAM_CHANGE', 'the upstream change was still merged in');
        assertEquals(fs.existsSync(addonDir), false, '--yes must not auto-install the suggested addon');
    } finally {
        fs.writeFileSync(dtMonoTs, dtOriginal);
    }
}

const spec: CliSpec = async (cli) => {
    const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
    const monoTs = path.join(repoRoot, 'packages/components/ui/button/button.component.ts');
    const c: Ctx = {
        cli,
        fixTs: path.join(cli.fixtureApp, 'src/components/ui/button/button.component.ts'),
        monoTs,
        original: fs.readFileSync(monoTs, 'utf-8'),
        lockFile: path.join(cli.fixtureApp, 'components.lock.json'),
    };

    try {
        await cli.runCli(['init', '--yes']);
        await cleanMerge(c);
        await editSurvivesSecondUpdate(c);
        await realConflict(c);
        await overwriteClobbers(c);
        await dryRunWritesNothing(c);
        await backCompatFallback(c);
        await addonSuggestionSkippedUnderYes(cli, repoRoot);
    } finally {
        // Bulletproof: the monorepo source must be byte-identical after the spec.
        fs.writeFileSync(monoTs, c.original);
    }

    assertEquals(fs.readFileSync(monoTs, 'utf-8'), c.original, 'monorepo button.component.ts restored after the spec');
};

export default spec;
