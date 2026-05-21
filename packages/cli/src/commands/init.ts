import fs from 'fs-extra';
import path from 'node:path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { getDefaultConfig, type Config } from '../utils/config.js';
import { DEFAULT_PREFIX, isValidPrefix } from '../utils/prefix.js';
import { getStylesTemplate } from '../templates/styles.js';
import { getUtilsTemplate } from '../templates/utils.js';
import { installPackages } from '../utils/package-manager.js';
import { writeShortcutRegistryIndex } from '../utils/shortcut-registry.js';
import {
    getLibRegistryBaseUrl,
    getLocalLibDir,
    resolveProjectPath,
    aliasToProjectPath,
} from '../utils/paths.js';

const onCancel = () => {
    console.log(chalk.dim('\nCancelled.'));
    process.exit(0);
};

async function fetchLibFileContent(file: string, branch: string, remote?: boolean, registry?: string): Promise<string> {
    const localLibDir = getLocalLibDir();
    if (localLibDir && !remote) {
        const localPath = path.join(localLibDir, file);
        if (await fs.pathExists(localPath)) {
            return fs.readFile(localPath, 'utf-8');
        }
    }

    const url = `${getLibRegistryBaseUrl(branch, registry)}/${file}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch library file from ${url}: ${response.statusText}`);
    }
    return response.text();
}

interface InitOptions {
    yes?: boolean;
    defaults?: boolean;
    remote?: boolean;
    branch: string;
    registry?: string;
    prefix?: string;
}

interface InitConfig {
    readonly config: Config;
    readonly createShortcutRegistry: boolean;
}

function resolveAliasOrPath(cwd: string, aliasOrPath: string): string {
    return resolveProjectPath(cwd, aliasToProjectPath(aliasOrPath));
}

function toAlias(inputPath: string): string {
    return inputPath.startsWith('src/')
        ? '@/' + inputPath.slice(4)
        : inputPath;
}

async function promptForConfig(initialPrefix: string): Promise<InitConfig> {
    const THEME_COLORS: Record<string, string> = {
        zinc: '#71717a', slate: '#64748b', stone: '#78716c',
        gray: '#6b7280', neutral: '#737373', red: '#ef4444',
        rose: '#f43f5e', orange: '#f97316', green: '#22c55e',
        blue: '#3b82f6', yellow: '#eab308', violet: '#8b5cf6',
        amber: '#d97706',
    };

    const colorSwatch = (value: string, label: string) =>
        `${chalk.hex(THEME_COLORS[value])('██')} ${label}`;

    const themeChoices = [
        'Zinc', 'Slate', 'Stone', 'Gray', 'Neutral',
        'Red', 'Rose', 'Orange', 'Green', 'Blue',
        'Yellow', 'Violet', 'Amber',
    ].map(label => {
        const value = label.toLowerCase();
        return { title: colorSwatch(value, label), value };
    });

    const baseColorChoices = ['Neutral', 'Slate', 'Stone', 'Gray', 'Zinc'].map(label => {
        const value = label.toLowerCase();
        return { title: colorSwatch(value, label), value };
    });

    const responses = await prompts([
        {
            type: 'select',
            name: 'baseColor',
            message: 'Which color would you like to use as base color?',
            choices: baseColorChoices,
            initial: 0,
        },
        {
            type: 'select',
            name: 'theme',
            message: 'Which color would you like to use for the main theme?',
            choices: themeChoices,
            initial: (prev: string) => {
                const index = themeChoices.findIndex(c => c.value === prev);
                return index === -1 ? 0 : index;
            },
        },
        {
            type: 'text',
            name: 'componentsPath',
            message: 'Where would you like to install components?',
            initial: 'src/components/ui',
        },
        {
            type: 'text',
            name: 'utilsPath',
            message: 'Where would you like to install utils?',
            initial: 'src/components/lib',
        },
        {
            type: 'text',
            name: 'globalCss',
            message: 'Where is your global styles file?',
            initial: 'src/styles.scss',
        },
        {
            type: 'text',
            name: 'prefix',
            message: 'Component selector prefix (e.g. "ui", "acme", "acme-ui"):',
            initial: initialPrefix,
            validate: (value: string) =>
                isValidPrefix(value)
                    ? true
                    : 'Prefix must be lowercase kebab-case starting with a letter (e.g. "ui", "myapp", "acme-ui").',
        },
        {
            type: 'confirm',
            name: 'createShortcutRegistry',
            message: 'Would you like to create a shortcut registry scaffold?',
            initial: true,
        },
    ], { onCancel });

    const componentsAlias = toAlias(responses.componentsPath);
    const uiAlias = componentsAlias.endsWith('/ui')
        ? componentsAlias
        : componentsAlias + '/ui';

    return {
        config: {
            style: 'default',
            prefix: responses.prefix,
            tailwind: {
                css: responses.globalCss,
                baseColor: responses.baseColor,
                theme: responses.theme,
                cssVariables: true,
            },
            aliases: {
                components: componentsAlias.replace(/\/ui$/, ''),
                utils: toAlias(responses.utilsPath),
                ui: uiAlias,
            },
        },
        createShortcutRegistry: responses.createShortcutRegistry ?? true,
    };
}

async function installMissingDeps(cwd: string): Promise<void> {
    const allDependencies = [
        'clsx', 'tailwind-merge', 'class-variance-authority',
        'tailwindcss', 'postcss', '@tailwindcss/postcss',
    ];

    const packageJsonPath = path.join(cwd, 'package.json');
    let missingDeps = allDependencies;
    if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        const installed = { ...packageJson.dependencies, ...packageJson.devDependencies };
        missingDeps = allDependencies.filter(dep => !installed[dep]);
    }

    if (missingDeps.length > 0) {
        await installPackages(missingDeps, { cwd });
    }
}

async function setupPostcss(cwd: string): Promise<void> {
    const postcssConfigFiles = [
        '.postcssrc.json', '.postcssrc.js', '.postcssrc.yaml',
        'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs',
    ];
    const existing = (await Promise.all(
        postcssConfigFiles.map(async f => await fs.pathExists(path.join(cwd, f)) ? f : null)
    )).filter(Boolean);

    if (existing.length === 0) {
        await fs.writeJson(path.join(cwd, '.postcssrc.json'), {
            plugins: { '@tailwindcss/postcss': {} },
        }, { spaces: 4 });
        return;
    }

    if (!existing.includes('.postcssrc.json')) {
        console.log(chalk.yellow(`  Existing PostCSS config found (${existing[0]}). Skipping .postcssrc.json creation.`));
        console.log(chalk.dim('  Make sure @tailwindcss/postcss is configured in your PostCSS config.'));
    }
}

async function autoConfigureTsconfig(cwd: string, spinner: ReturnType<typeof ora>): Promise<void> {
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    if (!await fs.pathExists(tsconfigPath)) return;

    try {
        const raw = await fs.readFile(tsconfigPath, 'utf-8');
        // Strip block comments BEFORE line comments so URLs like
        // `https://example.com` inside a `/* ... */` block don't get
        // partially eaten by the line-comment regex and leave a dangling
        // `/*` that breaks JSON.parse.
        const stripped = raw
            .replaceAll(/\/\*[\s\S]*?\*\//g, '')
            .replaceAll(/\/\/.*$/gm, '');
        const tsconfig = JSON.parse(stripped) as {
            compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
        };

        const compilerOptions = tsconfig.compilerOptions ??= {};
        const paths = compilerOptions.paths ??= {};

        if (paths['@/*']) return;

        if (!compilerOptions.baseUrl) {
            compilerOptions.baseUrl = '.';
        }
        paths['@/*'] = ['./src/*'];

        await fs.writeJson(tsconfigPath, tsconfig, { spaces: 2 });
        spinner.text = 'Configured tsconfig.json paths';
    } catch {
        console.log(chalk.dim('  Could not auto-configure tsconfig.json — please add "@/*": ["./src/*"] to paths manually.'));
    }
}

export async function init(options: InitOptions) {
    console.log(chalk.bold('\n🎨 Welcome to shadcn-angular!\n'));

    const cwd = process.cwd();

    const angularJsonPath = path.join(cwd, 'angular.json');
    if (!await fs.pathExists(angularJsonPath)) {
        console.log(chalk.red('Error: This does not appear to be an Angular project.'));
        console.log(chalk.dim('Please run this command in the root of your Angular project.'));
        process.exit(1);
    }

    const componentsJsonPath = path.join(cwd, 'components.json');

    if (await fs.pathExists(componentsJsonPath)) {
        const overwrite = options.yes
            ? true
            : (await prompts({
                type: 'confirm',
                name: 'overwrite',
                message: 'components.json already exists. Overwrite?',
                initial: false,
            }, { onCancel })).overwrite;
        if (!overwrite) {
            console.log(chalk.dim('Initialization cancelled.'));
            return;
        }
    }

    if (options.prefix !== undefined && !isValidPrefix(options.prefix)) {
        console.log(chalk.red(
            `Error: invalid --prefix value "${options.prefix}".`,
        ));
        console.log(chalk.dim(
            'Prefix must be lowercase kebab-case starting with a letter (e.g. "ui", "myapp", "acme-ui").',
        ));
        process.exit(1);
    }

    const initialPrefix = options.prefix ?? DEFAULT_PREFIX;

    const { config, createShortcutRegistry } = options.defaults || options.yes
        ? {
            config: { ...getDefaultConfig(), prefix: initialPrefix },
            createShortcutRegistry: true,
        }
        : await promptForConfig(initialPrefix);

    if (options.prefix !== undefined) {
        config.prefix = options.prefix;
    }

    if (options.registry) {
        config.registry = options.registry;
    }

    const spinner = ora('Initializing project...').start();

    try {
        await fs.writeJson(componentsJsonPath, config, { spaces: 2 });
        spinner.text = 'Created components.json';

        const libDir = resolveAliasOrPath(cwd, config.aliases.utils);
        await fs.ensureDir(libDir);
        await fs.writeFile(path.join(libDir, 'utils.ts'), getUtilsTemplate());
        spinner.text = 'Created utils.ts';

        if (createShortcutRegistry) {
            const content = await fetchLibFileContent('shortcut-binding.service.ts', options.branch, options.remote, options.registry);
            await fs.writeFile(path.join(libDir, 'shortcut-binding.service.ts'), content);
            spinner.text = 'Created shortcut-binding.service.ts';

            await writeShortcutRegistryIndex(cwd, config, []);
            spinner.text = 'Created shortcut-registry.index.ts';
        }

        const userStylesPath = resolveProjectPath(cwd, config.tailwind.css);
        const stylesDir = path.dirname(userStylesPath);

        await fs.ensureDir(stylesDir);
        await fs.writeFile(path.join(stylesDir, 'tailwind.css'), getStylesTemplate(config.tailwind.baseColor, config.tailwind.theme));
        spinner.text = 'Created tailwind.css';

        let userStyles = await fs.pathExists(userStylesPath)
            ? await fs.readFile(userStylesPath, 'utf-8')
            : '';

        if (!userStyles.includes('tailwind.css')) {
            userStyles = '@import "./tailwind.css";\n\n' + userStyles;
            await fs.writeFile(userStylesPath, userStyles);
            spinner.text = 'Added tailwind.css import to styles';
        }

        const uiDir = resolveAliasOrPath(cwd, config.aliases.ui);
        await fs.ensureDir(uiDir);
        spinner.text = 'Created components directory';

        spinner.text = 'Installing dependencies...';
        await installMissingDeps(cwd);

        spinner.text = 'Configuring PostCSS...';
        await setupPostcss(cwd);

        await autoConfigureTsconfig(cwd, spinner);

        spinner.succeed(chalk.green('Project initialized successfully!'));

        console.log('\n' + chalk.bold('Next steps:'));
        console.log(chalk.dim('  1. Add components: ') + chalk.cyan('npx @gilav21/shadcn-angular add button'));
        console.log(chalk.dim('  2. Import and use in your templates'));
        console.log('');

    } catch (error) {
        spinner.fail('Failed to initialize project');
        console.error(error);
        process.exit(1);
    }
}
