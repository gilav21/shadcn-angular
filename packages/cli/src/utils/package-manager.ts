import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'node:path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/** Every lockfile name and the manager that writes it. The order is the tie-break precedence: pnpm, yarn, bun, npm. */
const LOCKFILES: readonly (readonly [file: string, manager: PackageManager])[] = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
    ['npm-shrinkwrap.json', 'npm'],
];

interface FoundLockfile {
    readonly file: string;
    readonly manager: PackageManager;
}

function isPackageManager(name: string): name is PackageManager {
    return name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun';
}

/** The tool that launched the CLI. `npx` always reports npm, so this only breaks ties and fills gaps. */
function managerFromUserAgent(): PackageManager | undefined {
    const userAgent = process.env['npm_config_user_agent'];
    if (!userAgent) return undefined;
    const launcher = /^[a-z]+/.exec(userAgent)?.[0] ?? '';
    return isPackageManager(launcher) ? launcher : 'npm';
}

/** The corepack `packageManager` field (`"pnpm@9.1.0+sha512.…"`) of the `package.json` in `dir`. */
async function declaredManager(dir: string): Promise<PackageManager | undefined> {
    try {
        const pkg: unknown = await fs.readJson(path.join(dir, 'package.json'));
        if (typeof pkg !== 'object' || pkg === null || !('packageManager' in pkg)) return undefined;
        const field = pkg.packageManager;
        const name = typeof field === 'string' ? /^([a-z]+)@/.exec(field)?.[1] : undefined;
        return name !== undefined && isPackageManager(name) ? name : undefined;
    } catch {
        // No package.json, or one that is not JSON: it declares nothing, and a
        // lockfile beside it must still be able to decide.
        return undefined;
    }
}

async function lockfilesIn(dir: string): Promise<FoundLockfile[]> {
    const found: FoundLockfile[] = [];
    for (const [file, manager] of LOCKFILES) {
        if (await fs.pathExists(path.join(dir, file))) found.push({ file, manager });
    }
    return found;
}

/** One lockfile owner wins outright; several are broken by the user agent, else by precedence with a warning. */
function chooseAmong(found: readonly FoundLockfile[]): PackageManager {
    const owners = new Set(found.map((lockfile) => lockfile.manager));
    if (owners.size === 1) return found[0].manager;

    const launcher = managerFromUserAgent();
    if (launcher && owners.has(launcher)) return launcher;

    const winner = found[0].manager;
    console.warn(
        `Found several lockfiles (${found.map((lockfile) => lockfile.file).join(', ')}); using ${winner}. ` +
        `Delete the ones you don't use, or set "packageManager" in package.json.`,
    );
    return winner;
}

/** What `dir` itself says about its package manager: the declared field, else its lockfiles. */
async function ownerOf(dir: string): Promise<PackageManager | undefined> {
    const declared = await declaredManager(dir);
    if (declared) return declared;
    const found = await lockfilesIn(dir);
    return found.length > 0 ? chooseAmong(found) : undefined;
}

/**
 * Walk from `cwd` up to the repository root (the directory holding `.git`, else
 * the filesystem root); the first directory that declares a manager or holds a
 * lockfile owns the project — the way pnpm, yarn and corepack find it.
 */
async function findOwner(cwd: string): Promise<PackageManager | undefined> {
    let dir = path.resolve(cwd);
    for (;;) {
        const owner = await ownerOf(dir);
        if (owner) return owner;
        const parent = path.dirname(dir);
        if (parent === dir || await fs.pathExists(path.join(dir, '.git'))) return undefined;
        dir = parent;
    }
}

/**
 * The manager that owns the project at `cwd`: declared `packageManager`, else
 * the nearest lockfile up to the repository root. Only a project that declares
 * none follows the tool that launched the CLI, then npm.
 */
export async function getPackageManager(cwd: string): Promise<PackageManager> {
    return (await findOwner(cwd)) ?? managerFromUserAgent() ?? 'npm';
}

export async function installPackages(
    packages: string[],
    options: { cwd: string; dev?: boolean }
): Promise<void> {
    const packageManager = await getPackageManager(options.cwd);

    const args: string[] = [];

    if (packageManager === 'npm') {
        args.push('install');
        if (options.dev) args.push('-D');
    } else if (packageManager === 'yarn' || packageManager === 'pnpm') {
        args.push('add');
        if (options.dev) args.push('-D');
    } else if (packageManager === 'bun') {
        args.push('add');
        if (options.dev) args.push('-d');
    }

    // `--` ends option parsing, so no package spec is ever read as a flag
    // (`--registry=…`). Verified 2026-10-03 on npm 11, pnpm 9, yarn 1 and 4, bun 1.2.
    args.push('--', ...packages);

    await execa(packageManager, args, { cwd: options.cwd });
}
