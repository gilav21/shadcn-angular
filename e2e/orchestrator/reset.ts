/**
 * Standalone entry point for `npm run e2e:reset`. Restores the
 * fixture-app to its committed pristine state without running any test
 * — useful after manually poking at the fixture (e.g. via
 * `e2e:headed -- <spec>` + Ctrl-C, or just running ng serve inside
 * `e2e/fixture-app/` to explore), or to clean up if a previous run
 * crashed before its own reset.
 *
 * This is the same function the orchestrator runs between specs;
 * sharing the code keeps the reset semantics identical.
 */
import fs from 'node:fs';

import { FIXTURE_APPS } from './paths.js';
import { resetFixtureApp } from './reset-app.js';

async function main(): Promise<void> {
    // Both fixtures, so `e2e:reset` still means "put the e2e trees back" now
    // that the compiled-package legs run on the Angular 21 one too.
    for (const [id, fixtureApp] of Object.entries(FIXTURE_APPS)) {
        if (!fs.existsSync(fixtureApp)) continue;
        await resetFixtureApp(fixtureApp);
        console.log(`[e2e] ${id} fixture reset.`);
    }
}

main().catch(err => {
    console.error('[e2e] reset failed:', err);
    process.exit(1);
});
