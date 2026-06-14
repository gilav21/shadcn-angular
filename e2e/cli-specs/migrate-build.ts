import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { assertContains, type CliSpec } from './_types.js';
import { realLegacyBlob } from './_git.js';

/**
 * The ultimate migrate gate: after migrating a fabricated legacy install, the
 * consumer app must still PRODUCTION-BUILD. A real `ng build` type-checks the
 * whole program, proving the rewritten folder/trio compiles AND that every
 * rewritten import resolves. Covers two paths unit specs can't:
 *  - the consumer's own app file imports button via the legacy path (rewritten
 *    to the barrel);
 *  - a pre-existing consumer FOLDER component imports a now-migrated sibling via
 *    the old flat path `../button.component` (Bug 3 — must become `../button`).
 */
function writeConsumerApp(appTs: string): void {
    // Consumer bootstrap component imports button via the LEGACY path and
    // references a consumer-owned widget, so both are in the compile graph.
    fs.writeFileSync(appTs,
        `import { Component, signal } from '@angular/core';\n` +
        `import { RouterOutlet } from '@angular/router';\n` +
        `import { ButtonComponent } from '@/components/ui/button.component';\n` +
        `import { MyWidgetComponent } from '@/components/ui/my-widget/my-widget.component';\n\n` +
        `@Component({\n` +
        `  selector: 'app-root',\n` +
        `  imports: [RouterOutlet],\n` +
        `  templateUrl: './app.html',\n` +
        `  styleUrl: './app.scss'\n` +
        `})\n` +
        `export class App {\n` +
        `  protected readonly title = signal('shadcn-angular-e2e-fixture');\n` +
        `  protected readonly buttonRef: unknown = ButtonComponent;\n` +
        `  protected readonly widgetRef: unknown = MyWidgetComponent;\n` +
        `}\n`,
    );
}

function writeConsumerWidget(widgetTs: string): void {
    // A consumer-owned FOLDER component that imports the button via the old FLAT
    // sibling path. migrate must rewrite `../button.component` → `../button`.
    fs.mkdirSync(path.dirname(widgetTs), { recursive: true });
    fs.writeFileSync(widgetTs,
        `import { Component } from '@angular/core';\n` +
        `import { ButtonComponent } from '../button.component';\n` +
        `@Component({\n` +
        `  selector: 'app-my-widget',\n` +
        `  imports: [ButtonComponent],\n` +
        `  template: '<ui-button>hi</ui-button>'\n` +
        `})\n` +
        `export class MyWidgetComponent {}\n`,
    );
}

const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']);

    const uiDir = path.join(fixtureApp, 'src/components/ui');
    const folder = path.join(uiDir, 'button');
    const flat = path.join(uiDir, 'button.component.ts');
    const appTs = path.join(fixtureApp, 'src/app/app.ts');
    const widgetTs = path.join(uiDir, 'my-widget/my-widget.component.ts');

    writeConsumerApp(appTs);
    writeConsumerWidget(widgetTs);

    // Fabricate a PRISTINE legacy flat button (real historical source) so migrate
    // classifies it unmodified and converts it.
    fs.writeFileSync(flat, realLegacyBlob('button'));
    fs.rmSync(folder, { recursive: true, force: true });

    const run = await captureCli(['migrate', '--force', '--yes']);
    if (run.code !== 0) {
        throw new Error(`migrate --force --yes failed\n${run.stdout}`);
    }

    // App import rewritten to the barrel.
    const appAfter = fs.readFileSync(appTs, 'utf-8');
    assertContains(appAfter, `'@/components/ui/button'`, 'app import should point at the folder barrel');
    if (appAfter.includes(`ui/button.component`)) {
        throw new Error(`no legacy ui/button.component specifier should remain in app.ts:\n${appAfter}`);
    }

    // The consumer folder component's flat sibling import rewritten (Bug 3).
    const widgetAfter = fs.readFileSync(widgetTs, 'utf-8');
    assertContains(widgetAfter, `from '../button'`, 'widget sibling import should be rewritten to the barrel');
    if (widgetAfter.includes(`'../button.component'`)) {
        throw new Error(`Bug 3: widget still imports the deleted flat sibling:\n${widgetAfter}`);
    }

    // The real gate: production build must succeed.
    await runAndWait('npm', ['install', '--no-audit', '--no-fund'], fixtureApp);
    await runAndWait('npx', ['ng', 'build', '--configuration', 'production'], fixtureApp);

    if (!fs.existsSync(path.join(fixtureApp, 'dist'))) {
        throw new Error('ng build exited 0 but produced no dist/ — migrated app did not build');
    }
};

function runAndWait(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) resolve();
            else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

export default spec;
