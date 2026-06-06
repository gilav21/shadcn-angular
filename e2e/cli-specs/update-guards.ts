import fs from 'node:fs';
import path from 'node:path';
import { assertContains, type CliSpec } from './_types.js';

/**
 * Covers `update`'s two high-risk guard branches (spec Part A):
 *  - A newly-required dependency that isn't installed: `update` aborts
 *    without `--yes` (and writes nothing), then installs it with `--yes`.
 *  - A component installed in the legacy flat layout: `update` aborts and
 *    routes the user to `migrate`.
 */
const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']); // installs button + its dep ripple

    const uiDir = path.join(fixtureApp, 'src/components/ui');
    const rippleFile = path.join(uiDir, 'ripple.directive.ts');

    // --- newly-required dependency consent path ---
    // Remove button's dependency so updating button must re-add it.
    fs.rmSync(rippleFile, { force: true });

    const noConsent = await captureCli(['update', 'button']);
    if (noConsent.code === 0) {
        throw new Error(`update must abort when a required dep is missing and --yes absent\n${noConsent.stdout}`);
    }
    assertContains(noConsent.stdout, 'ripple', 'should name the newly-required dependency');
    assertContains(noConsent.stdout, '--yes', 'should instruct to re-run with --yes');
    if (fs.existsSync(rippleFile)) {
        throw new Error('the abort path must not write the missing dependency');
    }

    const consent = await captureCli(['update', 'button', '--yes']);
    if (consent.code !== 0) {
        throw new Error(`update --yes should install the newly-required dep\n${consent.stdout}`);
    }
    if (!fs.existsSync(rippleFile)) {
        throw new Error('update --yes must install the newly-required dependency');
    }

    // --- legacy-layout abort ---
    // Fabricate a flat (legacy) install of a folderized component — must carry
    // our selector ('ui-badge') so detection recognizes it as a genuine install.
    fs.writeFileSync(
        path.join(uiDir, 'badge.component.ts'),
        `import { Component } from '@angular/core';\n@Component({ selector: 'ui-badge', template: '' })\nexport class BadgeComponent {}\n`,
    );
    const legacy = await captureCli(['update', 'badge']);
    if (legacy.code === 0) {
        throw new Error(`update must abort on a legacy flat install\n${legacy.stdout}`);
    }
    assertContains(legacy.stdout, 'migrate', 'legacy installs should be routed to `migrate`');
};

export default spec;
