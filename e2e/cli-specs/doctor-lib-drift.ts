import fs from 'node:fs';
import path from 'node:path';
import { assertContains, type CliSpec } from './_types.js';
import { oldBlob } from './_seed.js';
import { npmInstall, buildClean } from './_build.js';

/**
 * B2/B3 regression — the upgrade-journey the fresh-install-only suite never ran.
 *
 * A consumer installed long ago; their shared `lib/utils.ts` predates the
 * `stringifyValue` export. A newer `select` imports it. The old tooling left
 * `utils.ts` behind — `doctor` ignored lib files entirely and `update` only
 * refreshed a component's own closure — so the build broke with
 * `TS2305: has no exported member 'stringifyValue'` and no tool surfaced it.
 *
 * Here: install select, rewind `utils.ts` to a real pre-`stringifyValue`
 * revision, then prove (1) `doctor` now REPORTS the stale lib file and
 * (2) `doctor --fix` brings it current so the build is green — no manual step.
 */
const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'select', '--yes']);

    // Rewind the installed utils.ts to a pristine revision lacking stringifyValue.
    const utilsPath = path.join(fixtureApp, 'src/components/lib/utils.ts');
    const stale = oldBlob('packages/components/lib/utils.ts', { before: 'stringifyValue' });
    if (stale.includes('stringifyValue')) {
        throw new Error('setup: seeded utils.ts unexpectedly contains stringifyValue');
    }
    fs.writeFileSync(utilsPath, stale);

    // 1. doctor must DETECT the stale lib file (it was previously blind to lib/).
    const report = await captureCli(['doctor']);
    assertContains(report.stdout, 'utils.ts', 'doctor should report the stale lib/utils.ts');

    // 2. doctor --fix must refresh it (no manual fetch).
    await runCli(['doctor', '--fix']);
    const fixed = fs.readFileSync(utilsPath, 'utf-8');
    if (!fixed.includes('stringifyValue')) {
        throw new Error('doctor --fix did not refresh utils.ts to include stringifyValue');
    }

    // 3. The build is green — the TS2305 the old tooling shipped is gone.
    await npmInstall(fixtureApp);
    await buildClean(fixtureApp);
};

export default spec;
