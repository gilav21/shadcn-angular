import fs from 'fs-extra';
import path from 'node:path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { getDefaultConfig, type Config } from '../utils/config.js';
import { DEFAULT_PREFIX, isValidPrefix } from '../utils/prefix.js';
import { initProject, toAlias } from '../core/init-core.js';

const onCancel = () => {
    console.log(chalk.dim('\nCancelled.'));
    process.exit(0);
};

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
        const { created, warnings } = await initProject({
            cwd, config, createShortcutRegistry,
            fetchOptions: { branch: options.branch, remote: options.remote, registry: options.registry },
        });

        spinner.succeed(chalk.green('Project initialized successfully!'));
        for (const c of created) console.log(chalk.dim('  + ') + chalk.cyan(c));
        for (const w of warnings) console.log(chalk.yellow('  ' + w));

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
