import fs from 'fs-extra';
import path from 'node:path';
import { type Config } from '../utils/config.js';
import { getStylesTemplate } from '../templates/styles.js';
import { getUtilsTemplate } from '../templates/utils.js';
import { installPackages } from '../utils/package-manager.js';
import { writeShortcutRegistryIndex } from '../utils/shortcut-registry.js';
import { fetchLibContent, type FetchOptions } from './fetch.js';
import { readManifest, writeManifest, recordFile, type Manifest } from './manifest.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';

export function resolveAliasOrPath(cwd: string, aliasOrPath: string): string {
    return resolveProjectPath(cwd, aliasToProjectPath(aliasOrPath));
}

export function toAlias(inputPath: string): string {
    return inputPath.startsWith('src/') ? '@/' + inputPath.slice(4) : inputPath;
}

async function installMissingDeps(cwd: string): Promise<void> {
    const allDependencies = [
        'clsx', 'tailwind-merge', 'class-variance-authority',
        'tailwindcss', 'postcss', '@tailwindcss/postcss',
    ];
    const packageJsonPath = path.join(cwd, 'package.json');
    let missingDeps = allDependencies;
    if (await fs.pathExists(packageJsonPath)) {
        const pkg = await fs.readJson(packageJsonPath) as {
            dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
        };
        const installed = { ...pkg.dependencies, ...pkg.devDependencies };
        missingDeps = allDependencies.filter(dep => !installed[dep]);
    }
    if (missingDeps.length > 0) await installPackages(missingDeps, { cwd });
}

async function setupPostcss(cwd: string, warnings: string[]): Promise<void> {
    const files = [
        '.postcssrc.json', '.postcssrc.js', '.postcssrc.yaml',
        'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs',
    ];
    const existing = (await Promise.all(
        files.map(async f => await fs.pathExists(path.join(cwd, f)) ? f : null),
    )).filter(Boolean);
    if (existing.length === 0) {
        await fs.writeJson(path.join(cwd, '.postcssrc.json'), { plugins: { '@tailwindcss/postcss': {} } }, { spaces: 4 });
        return;
    }
    if (!existing.includes('.postcssrc.json')) {
        warnings.push(`Existing PostCSS config found (${existing[0]}). Ensure @tailwindcss/postcss is configured.`);
    }
}

async function autoConfigureTsconfig(cwd: string, warnings: string[]): Promise<void> {
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    if (!await fs.pathExists(tsconfigPath)) return;
    try {
        const raw = await fs.readFile(tsconfigPath, 'utf-8');
        // Strip block comments before line comments so URLs inside /* ... */
        // don't leave a dangling token that breaks JSON.parse.
        const stripped = raw.replaceAll(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '').replaceAll(/\/\/[^\n\r]*/g, '');
        const tsconfig = JSON.parse(stripped) as {
            compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
        };
        const compilerOptions = tsconfig.compilerOptions ??= {};
        const paths = compilerOptions.paths ??= {};
        if (paths['@/*']) return;
        compilerOptions.baseUrl ??= '.';
        paths['@/*'] = ['./src/*'];
        await fs.writeJson(tsconfigPath, tsconfig, { spaces: 2 });
    } catch {
        warnings.push('Could not auto-configure tsconfig.json — add "@/*": ["./src/*"] to paths manually.');
    }
}

export interface InitProjectInput {
    cwd: string;
    config: Config;
    createShortcutRegistry: boolean;
    fetchOptions: FetchOptions;
}

export interface InitProjectResult {
    created: string[];
    warnings: string[];
}

/**
 * Write the shared lib files init ships and fingerprint the ones `doctor`
 * tracks. `utils.ts` and (when requested) `shortcut-binding.service.ts` are
 * registry lib files: recording their baselines in the manifest is what lets a
 * later `doctor` classify them as pristine (safe to refresh) rather than
 * untracked — which, before this, made a fresh install fail `doctor` (H4).
 */
async function writeLibFiles(
    input: InitProjectInput, libDir: string, manifest: Manifest, created: string[],
): Promise<void> {
    const { createShortcutRegistry, fetchOptions, cwd, config } = input;
    await fs.ensureDir(libDir);

    const utilsContent = getUtilsTemplate();
    await fs.writeFile(path.join(libDir, 'utils.ts'), utilsContent);
    recordFile(manifest, 'utils.ts', utilsContent, '(lib)');
    created.push('utils.ts');

    if (createShortcutRegistry) {
        const content = await fetchLibContent('shortcut-binding.service.ts', fetchOptions);
        await fs.writeFile(path.join(libDir, 'shortcut-binding.service.ts'), content);
        recordFile(manifest, 'shortcut-binding.service.ts', content, '(lib)');
        await writeShortcutRegistryIndex(cwd, config, []);
        created.push('shortcut-binding.service.ts', 'shortcut-registry.index.ts');
    }
}

/** Non-interactive project initialization. Caller has already resolved config. */
export async function initProject(input: InitProjectInput): Promise<InitProjectResult> {
    const { cwd, config } = input;
    const created: string[] = [];
    const warnings: string[] = [];

    await fs.writeJson(path.join(cwd, 'components.json'), config, { spaces: 2 });
    created.push('components.json');

    const manifest = await readManifest(cwd);

    const libDir = resolveAliasOrPath(cwd, config.aliases.utils);
    await writeLibFiles(input, libDir, manifest, created);

    const userStylesPath = resolveProjectPath(cwd, config.tailwind.css);
    const stylesDir = path.dirname(userStylesPath);
    await fs.ensureDir(stylesDir);
    await fs.writeFile(path.join(stylesDir, 'tailwind.css'), getStylesTemplate(config.tailwind.baseColor, config.tailwind.theme));
    created.push('tailwind.css');

    let userStyles = await fs.pathExists(userStylesPath) ? await fs.readFile(userStylesPath, 'utf-8') : '';
    if (!userStyles.includes('tailwind.css')) {
        userStyles = '@import "./tailwind.css";\n\n' + userStyles;
        await fs.writeFile(userStylesPath, userStyles);
    }

    await fs.ensureDir(resolveAliasOrPath(cwd, config.aliases.ui));
    await installMissingDeps(cwd);
    await setupPostcss(cwd, warnings);
    await autoConfigureTsconfig(cwd, warnings);

    await writeManifest(cwd, manifest);
    created.push('components.lock.json');

    return { created, warnings };
}
