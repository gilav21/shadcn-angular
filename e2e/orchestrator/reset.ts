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
import { resetFixtureApp } from './reset-app.js';

async function main(): Promise<void> {
    await resetFixtureApp();
    console.log('[e2e] fixture-app reset.');
}

main().catch(err => {
    console.error('[e2e] reset failed:', err);
    process.exit(1);
});
