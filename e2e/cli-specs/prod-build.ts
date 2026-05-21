import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { assertContains, type CliSpec } from './_types.js';

/**
 * Production-build smoke: install a representative set of components,
 * then `ng build` (NOT ng serve). Catches AOT-only failures that dev
 * mode hides — bad `inject()` calls outside injection contexts, dead
 * imports, type-narrowing assumptions that only optimizer enforces,
 * etc. Many real consumer issues live here.
 */
const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    // A non-trivial install: foundation + overlay + form components.
    await runCli([
        'add',
        'button', 'input', 'label', 'dialog', 'select',
        'checkbox', 'switch', 'card',
        '--yes',
    ]);

    // npm install picks up clsx, cva, tailwind-merge, postcss, etc.
    await runNpm(['install', '--no-audit', '--no-fund'], fixtureApp);

    // Production build. The fixture's app shell is just <router-outlet />
    // with no route loaded, so the components themselves only get
    // bundled if any user code references them. The CLI's
    // `shortcut-registry.index.ts` (created by init) wires the entire
    // ui/ folder into the import graph — that's why an unused install
    // still has to template-compile cleanly.
    await runNpx(['ng', 'build', '--configuration', 'production'], fixtureApp);

    // Production output must exist.
    const distDir = path.join(fixtureApp, 'dist');
    if (!fs.existsSync(distDir)) {
        throw new Error('ng build succeeded with exit 0 but produced no dist/ directory');
    }

    // Find any browser-bundle directory and confirm main bundle exists.
    const browserDir = findBrowserBundleDir(distDir);
    if (!browserDir) {
        throw new Error(`No browser bundle directory found under ${distDir}`);
    }
    const indexPath = path.join(browserDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        throw new Error(`Expected ${indexPath} after production build`);
    }
    assertContains(
        fs.readFileSync(indexPath, 'utf-8'),
        '<app-root>',
        'index.html should render the app-root selector',
    );
};

function findBrowserBundleDir(distRoot: string): string | null {
    // Angular 17+ writes to dist/<project>/browser/. Find the first
    // subdir that contains index.html.
    const entries = fs.readdirSync(distRoot, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const browserDir = path.join(distRoot, entry.name, 'browser');
        if (fs.existsSync(path.join(browserDir, 'index.html'))) return browserDir;
        // Fallback: project dir itself contains index.html.
        const projectDir = path.join(distRoot, entry.name);
        if (fs.existsSync(path.join(projectDir, 'index.html'))) return projectDir;
    }
    return null;
}

function runNpm(args: string[], cwd: string): Promise<void> {
    return runAndWait('npm', args, cwd);
}

function runNpx(args: string[], cwd: string): Promise<void> {
    return runAndWait('npx', args, cwd);
}

function runAndWait(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            shell: process.platform === 'win32',
        });
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) resolve();
            else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

export default spec;
