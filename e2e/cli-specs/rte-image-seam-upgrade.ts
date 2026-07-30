import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertContains, type CliSpec } from './_types.js';
import { oldBlob } from './_seed.js';
import { npmInstall, ngBuild, buildClean } from './_build.js';

/**
 * Upgrade journey for the addon-host image seam.
 *
 * The images addon owns image files for the whole editor and registers itself
 * through `registerImageFileHandler` on the base editor; the file-import addon
 * routes picked images to it via `insertImageFile`. Both entry points live in
 * the BASE files (`rich-text-editor.host.ts` + `rich-text-editor.component.ts`),
 * so a consumer running new addons against a base installed before the seam
 * gets a compile error. `requiresBaseFiles` cannot catch this: it is a
 * file-PRESENCE check (see core/apply-core.ts), and the stale base file is
 * present — just old.
 *
 * This proves the safety net that does catch it: `doctor` reports the stale
 * base, and `--fix` brings it current. The failing build in the middle is the
 * control — without it, a green run at the end would prove nothing, since a
 * seam that was never load-bearing would also "pass".
 */

const SEAM = 'registerImageFileHandler';
const UI_DIR = 'src/components/ui';

/** Mirrors the CLI's manifest hash (core/manifest.ts + core/fetch.ts normalizeContent). */
function hashContent(content: string): string {
    return createHash('sha256').update(content.replaceAll('\r\n', '\n').trim(), 'utf8').digest('hex');
}

/**
 * Rewinds an installed file to a pre-seam revision AND re-records its manifest
 * hash. Re-recording is the point: without it the file reads as `modified` —
 * a hand edit, which the tools deliberately PROTECT — instead of `clean` but
 * outdated, which is what a consumer who installed at an older version has.
 * Seeding only the bytes would test the wrong branch of `classifyDrift`.
 */
function rewindToPreSeam(fixtureApp: string, registryFile: string): void {
    const stale = oldBlob(`packages/components/ui/${registryFile}`, { before: SEAM });
    if (stale.includes(SEAM)) {
        throw new Error(`setup: seeded ${registryFile} unexpectedly already contains ${SEAM}`);
    }
    fs.writeFileSync(path.join(fixtureApp, UI_DIR, registryFile), stale);

    const lockPath = path.join(fixtureApp, 'components.lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8')) as {
        files: Record<string, { sha256: string; component: string }>;
    };
    const entry = lock.files[registryFile];
    if (!entry) throw new Error(`setup: no manifest entry for ${registryFile}`);
    entry.sha256 = hashContent(stale);
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));
}

function readInstalled(fixtureApp: string, registryFile: string): string {
    return fs.readFileSync(path.join(fixtureApp, UI_DIR, registryFile), 'utf-8');
}

const BASE_FILES = [
    'rich-text-editor/rich-text-editor.host.ts',
    'rich-text-editor/rich-text-editor.component.ts',
];

const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli([
        'add', 'rich-text-editor', 'rich-text-editor/images', 'rich-text-editor/file-import', '--yes',
    ]);

    // A fresh install must ship the seam on both sides, or the rest is vacuous.
    for (const file of BASE_FILES) {
        if (!readInstalled(fixtureApp, file).includes(SEAM)) {
            throw new Error(`fresh install of ${file} is missing ${SEAM}`);
        }
    }
    const imagesDirective = readInstalled(
        fixtureApp, 'rich-text-editor/addons/images/rich-text-images.directive.ts',
    );
    if (!imagesDirective.includes(SEAM)) {
        throw new Error(`the images addon does not call ${SEAM} — seam not wired`);
    }

    // --- rewind the BASE to before the seam; the addons stay current ---
    for (const file of BASE_FILES) rewindToPreSeam(fixtureApp, file);

    // Control: this combination must genuinely fail to build. If it compiles,
    // the seam is not load-bearing and the green build at the end proves nothing.
    await npmInstall(fixtureApp);
    const broken = await ngBuild(fixtureApp);
    if (broken.code === 0) {
        throw new Error(
            'expected a stale base + current addons to FAIL the build; it succeeded, ' +
            'so this spec would not catch a real seam regression',
        );
    }
    // ...and fail FOR THE SEAM. A non-zero exit alone would also be satisfied by
    // a missing toolchain or an unrelated error, which would make this control
    // vacuous and the whole spec a false positive.
    if (!broken.output.includes(SEAM)) {
        throw new Error(
            `the stale-base build failed, but not because of ${SEAM} — this control ` +
            `proves nothing unless the error names the seam.\n--- build output ---\n` +
            `${broken.output.slice(-3000)}`,
        );
    }

    // 1. doctor must SURFACE the stale base rather than report a clean install.
    const report = await captureCli(['doctor']);
    assertContains(report.stdout, 'rich-text-editor', 'doctor should name the stale component');

    // 2. --fix must bring the base current with no manual step.
    await runCli(['doctor', '--fix']);
    for (const file of BASE_FILES) {
        if (!readInstalled(fixtureApp, file).includes(SEAM)) {
            throw new Error(`doctor --fix did not refresh ${file} to include ${SEAM}`);
        }
    }

    // 3. ...and the consumer is buildable again.
    await buildClean(fixtureApp);
};

export default spec;
