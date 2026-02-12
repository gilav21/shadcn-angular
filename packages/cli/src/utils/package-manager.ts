import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export async function getPackageManager(cwd: string): Promise<PackageManager> {
    const userAgent = process.env['npm_config_user_agent'];

    if (userAgent) {
        if (userAgent.startsWith('yarn')) return 'yarn';
        if (userAgent.startsWith('pnpm')) return 'pnpm';
        if (userAgent.startsWith('bun')) return 'bun';
        return 'npm';
    }

    // Check for lock files
    if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) return 'yarn';
    if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
    if (await fs.pathExists(path.join(cwd, 'bun.lockb'))) return 'bun';

    return 'npm';
}

export async function installPackages(
    packages: string[],
    options: { cwd: string; dev?: boolean }
) {
    const packageManager = await getPackageManager(options.cwd);

    const args: string[] = [];

    if (packageManager === 'npm') {
        args.push('install');
        if (options.dev) args.push('-D');
    } else if (packageManager === 'yarn') {
        args.push('add');
        if (options.dev) args.push('-D');
    } else if (packageManager === 'pnpm') {
        args.push('add');
        if (options.dev) args.push('-D');
    } else if (packageManager === 'bun') {
        args.push('add');
        if (options.dev) args.push('-d');
    }

    args.push(...packages);

    await execa(packageManager, args, { cwd: options.cwd });
}
