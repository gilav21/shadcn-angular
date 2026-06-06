import fs from 'node:fs';
import path from 'node:path';
import { assertContains, type CliSpec } from './_types.js';
import { realLegacyBlob } from './_git.js';

/**
 * The current CLI can no longer *produce* a legacy single-file install, so this
 * spec fabricates one and exercises:
 *  - `update` on a legacy component aborts and points at `migrate`;
 *  - `migrate` refuses a dirty tree without `--force`;
 *  - `migrate --force --yes` migrates a PRISTINE legacy component (real
 *    historical content, so it matches a baseline hash) flat→folder, deletes the
 *    flat file, and rewrites the consumer's import to the barrel;
 *  - a CUSTOMIZED legacy component (edited content, matching no baseline) is
 *    left exactly as-is, gets no folder, and is reported as protected;
 *  - a consumer's own same-named component (its own selector) is never touched.
 */
const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']);

    const uiDir = path.join(fixtureApp, 'src/components/ui');
    const folder = path.join(uiDir, 'button');
    const flat = path.join(uiDir, 'button.component.ts');

    // Fabricate a PRISTINE legacy flat button: real historical source, so its
    // canonical hash matches a baked baseline → migrate classifies it unmodified.
    fs.writeFileSync(flat, realLegacyBlob('button'));
    fs.rmSync(folder, { recursive: true, force: true });

    // A CUSTOMIZED legacy badge: our selector (so it's detected as a shadcn
    // install) but hand-edited content that matches NO baseline → must be left
    // untouched and reported, never overwritten or folderized.
    const customizedBadge = path.join(uiDir, 'badge.component.ts');
    fs.writeFileSync(customizedBadge,
        `import { Component, input } from '@angular/core';\n` +
        `@Component({ selector: 'ui-badge', template: '<span>{{ myCustomLabel() }}</span>' })\n` +
        `export class BadgeComponent {\n  readonly myCustomLabel = input('hi');\n}\n`);

    // A consumer's OWN component sharing a registry name ('card') with its OWN
    // selector — migrate must never touch or delete it (detection is anchored to
    // the selector: metadata, not bare content).
    const userCard = path.join(uiDir, 'card.component.ts');
    fs.writeFileSync(userCard, `import { Component } from '@angular/core';\n@Component({ selector: 'app-card', template: '<ui-card>wrapped</ui-card>' })\nexport class MyCardComponent {}\n`);

    // A consumer app file importing the legacy button path (alias form).
    const appFile = path.join(fixtureApp, 'src/legacy-consumer.ts');
    fs.writeFileSync(appFile, `import { ButtonComponent } from '@/components/ui/button.component';\nexport const C = ButtonComponent;\n`);

    // 1. `update` on a legacy component must route to `migrate`.
    const upd = await captureCli(['update', 'button']);
    if (upd.code === 0) {
        throw new Error(`update on a legacy install must abort\n${upd.stdout}`);
    }
    assertContains(upd.stdout, 'migrate', 'update should route legacy installs to migrate');

    // 2. `migrate` must refuse a dirty tree without --force.
    const dirty = await captureCli(['migrate']);
    if (dirty.code === 0) {
        throw new Error(`migrate must refuse a dirty git tree without --force\n${dirty.stdout}`);
    }
    assertContains(dirty.stdout, '--force', 'migrate should mention the --force escape hatch');

    // 3. Real migration.
    const run = await captureCli(['migrate', '--force', '--yes']);
    if (run.code !== 0) {
        throw new Error(`migrate --force --yes failed\n${run.stdout}`);
    }
    assertContains(run.stdout, 'Migrated', 'migrate should report completion');

    // Pristine button migrated to the folder layout; flat file gone.
    if (!fs.existsSync(path.join(folder, 'button.component.ts'))) {
        throw new Error('migrate must write the folder entry button/button.component.ts');
    }
    if (fs.existsSync(flat)) {
        throw new Error('migrate must delete the legacy flat button.component.ts');
    }

    // Customized badge: left exactly as-is, no folder, and reported as protected.
    if (!fs.existsSync(customizedBadge)) {
        throw new Error('migrate must NOT delete a customized component (data loss)');
    }
    if (fs.existsSync(path.join(uiDir, 'badge'))) {
        throw new Error('migrate must NOT folderize a customized component');
    }
    assertContains(fs.readFileSync(customizedBadge, 'utf-8'), 'myCustomLabel',
        "the user's customization must be preserved verbatim");
    assertContains(run.stdout, 'badge', 'migrate should list the customized component it protected');
    assertContains(run.stdout, 'kept', 'migrate should reassure that customizations were kept');

    // The consumer's own card.component.ts (different selector) must survive.
    if (!fs.existsSync(userCard)) {
        throw new Error("migrate must NOT delete the consumer's own card.component.ts");
    }
    assertContains(fs.readFileSync(userCard, 'utf-8'), `selector: 'app-card'`,
        "the consumer's card component must be left untouched");
    if (fs.existsSync(path.join(uiDir, 'card'))) {
        throw new Error("migrate must NOT create a card/ folder over the consumer's own card");
    }

    // Consumer import rewritten to the folder barrel.
    const rewritten = fs.readFileSync(appFile, 'utf-8');
    assertContains(rewritten, `'@/components/ui/button'`, 'consumer import should point at the folder barrel');
    if (rewritten.includes('button.component')) {
        throw new Error(`no legacy ".component" specifier should remain:\n${rewritten}`);
    }
};

export default spec;
