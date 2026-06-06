import fs from 'node:fs';
import path from 'node:path';
import { assertContains, type CliSpec } from './_types.js';

/**
 * The current CLI can no longer *produce* a legacy single-file install, so
 * this spec fabricates one (a flat `button.component.ts`, no `button/` folder)
 * plus an app file importing the old path, then exercises:
 *  - `update` on a legacy component aborts and points at `migrate`;
 *  - `migrate` refuses a dirty tree without `--force` (the fixture lives inside
 *    the repo, so its tree is never clean during a run);
 *  - `migrate --force --yes` writes the folder/trio, deletes the flat file, and
 *    rewrites the consumer's import to the folder barrel.
 */
const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']);

    const uiDir = path.join(fixtureApp, 'src/components/ui');
    const folder = path.join(uiDir, 'button');
    const flat = path.join(uiDir, 'button.component.ts');

    // Fabricate a legacy flat install of button — must carry OUR selector
    // (`ui-button`) so detection recognizes it as a genuine shadcn install.
    fs.writeFileSync(flat, `import { Component } from '@angular/core';\n@Component({ selector: 'ui-button', template: '' })\nexport class ButtonComponent {}\n`);
    fs.rmSync(folder, { recursive: true, force: true });

    // A consumer's OWN component that shares a registry name ('card') AND even
    // renders our <ui-card> in its template — but declares its OWN selector.
    // migrate must NOT touch/delete it: detection is anchored to the selector:
    // metadata, not bare file content (a content `.includes('ui-card')` would
    // have wrongly matched and deleted it).
    const userCard = path.join(uiDir, 'card.component.ts');
    fs.writeFileSync(userCard, `import { Component } from '@angular/core';\n@Component({ selector: 'app-card', template: '<ui-card>wrapped</ui-card>' })\nexport class MyCardComponent {}\n`);

    // A consumer app file importing the legacy path (alias form).
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

    if (!fs.existsSync(path.join(folder, 'button.component.ts'))) {
        throw new Error('migrate must write the folder entry button/button.component.ts');
    }
    if (fs.existsSync(flat)) {
        throw new Error('migrate must delete the legacy flat button.component.ts');
    }

    // The consumer's own card.component.ts (different selector) must survive.
    if (!fs.existsSync(userCard)) {
        throw new Error("migrate must NOT delete the consumer's own card.component.ts");
    }
    assertContains(fs.readFileSync(userCard, 'utf-8'), `selector: 'app-card'`,
        "the consumer's card component must be left untouched");
    if (fs.existsSync(path.join(uiDir, 'card'))) {
        throw new Error("migrate must NOT create a card/ folder over the consumer's own card");
    }

    const rewritten = fs.readFileSync(appFile, 'utf-8');
    assertContains(rewritten, `'@/components/ui/button'`, 'consumer import should point at the folder barrel');
    if (rewritten.includes('button.component')) {
        throw new Error(`no legacy ".component" specifier should remain:\n${rewritten}`);
    }
};

export default spec;
