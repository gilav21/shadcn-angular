import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { assertContains, type CliSpec } from './_types.js';

/**
 * The ultimate migrate gate: after migrating a fabricated legacy install,
 * the consumer app must still PRODUCTION-BUILD. A real `ng build` type-checks
 * the whole program, so it proves both that the rewritten folder/trio
 * compiles and that the consumer's rewritten import resolves — the thing unit
 * and black-box specs can't fully guarantee.
 */
const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']);

    const uiDir = path.join(fixtureApp, 'src/components/ui');
    const folder = path.join(uiDir, 'button');
    const flat = path.join(uiDir, 'button.component.ts');
    const appTs = path.join(fixtureApp, 'src/app/app.ts');

    // A consumer (the bootstrap component, always in the compile graph) imports
    // the button via the LEGACY path and references the symbol as a value, so
    // `ng build` type-checks the import. migrate must rewrite it to the barrel.
    fs.writeFileSync(appTs,
        `import { Component, signal } from '@angular/core';\n` +
        `import { RouterOutlet } from '@angular/router';\n` +
        `import { ButtonComponent } from '@/components/ui/button.component';\n\n` +
        `@Component({\n` +
        `  selector: 'app-root',\n` +
        `  imports: [RouterOutlet],\n` +
        `  templateUrl: './app.html',\n` +
        `  styleUrl: './app.scss'\n` +
        `})\n` +
        `export class App {\n` +
        `  protected readonly title = signal('shadcn-angular-e2e-fixture');\n` +
        `  protected readonly buttonRef: unknown = ButtonComponent;\n` +
        `}\n`,
    );

    // Fabricate a legacy flat install of button.
    fs.writeFileSync(flat, '// legacy single-file button\nexport class ButtonComponent {}\n');
    fs.rmSync(folder, { recursive: true, force: true });

    // Migrate (dirty tree → needs --force; no manifest edits → no --yes needed,
    // but pass it to be safe).
    const run = await captureCli(['migrate', '--force', '--yes']);
    if (run.code !== 0) {
        throw new Error(`migrate --force --yes failed\n${run.stdout}`);
    }

    // Sanity: the consumer import was rewritten to the folder barrel.
    const rewritten = fs.readFileSync(appTs, 'utf-8');
    assertContains(rewritten, `'@/components/ui/button'`, 'app import should point at the folder barrel');
    if (rewritten.includes('button.component')) {
        throw new Error(`no legacy ".component" specifier should remain in app.ts:\n${rewritten}`);
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
