import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { CliSpec } from './_types.js';

/**
 * Big-bang smoke: `add --all` installs every component in the registry,
 * then `npm install` + `ng build --configuration production`. Catches:
 *  - Components that fail to template-compile against the latest Angular
 *  - Registry entries that point at deleted files
 *  - Conflicting selectors / class names between components
 *  - Components whose `npmDependencies` list is incomplete
 *  - Components whose `libFiles` reference is broken
 *
 * Slow (~3-5 min on a warm cache, ~8-10 min cold) — the cost of being
 * the most thorough spec in the suite. Run it when you suspect broad
 * breakage; CI runs it as part of `npm run e2e`.
 */
const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', '--all', '--yes']);

    await runAndWait('npm', ['install', '--no-audit', '--no-fund'], fixtureApp);
    await runAndWait('npx', ['ng', 'build', '--configuration', 'production'], fixtureApp);

    const distDir = path.join(fixtureApp, 'dist');
    if (!fs.existsSync(distDir)) {
        throw new Error('ng build succeeded but dist/ is missing — production build is broken');
    }
};

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
