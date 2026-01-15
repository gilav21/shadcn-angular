import fs from 'fs-extra';
import path from 'path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import { getDefaultConfig } from '../utils/config.js';
import { getStylesTemplate } from '../templates/styles.js';
import { getUtilsTemplate } from '../templates/utils.js';
export async function init(options) {
    console.log(chalk.bold('\n🎨 Welcome to shadcn-angular!\n'));
    const cwd = process.cwd();
    // Check if this is an Angular project
    const angularJsonPath = path.join(cwd, 'angular.json');
    if (!await fs.pathExists(angularJsonPath)) {
        console.log(chalk.red('Error: This does not appear to be an Angular project.'));
        console.log(chalk.dim('Please run this command in the root of your Angular project.'));
        process.exit(1);
    }
    // Check if already initialized
    const componentsJsonPath = path.join(cwd, 'components.json');
    if (await fs.pathExists(componentsJsonPath)) {
        const { overwrite } = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: 'components.json already exists. Overwrite?',
            initial: false,
        });
        if (!overwrite) {
            console.log(chalk.dim('Initialization cancelled.'));
            return;
        }
    }
    let config;
    if (options.defaults || options.yes) {
        config = getDefaultConfig();
    }
    else {
        const responses = await prompts([
            {
                type: 'select',
                name: 'style',
                message: 'Which style would you like to use?',
                choices: [
                    { title: 'Default', value: 'default' },
                    { title: 'New York', value: 'new-york' },
                ],
                initial: 0,
            },
            {
                type: 'select',
                name: 'baseColor',
                message: 'Which color would you like to use as base color?',
                choices: [
                    { title: 'Neutral', value: 'neutral' },
                    { title: 'Slate', value: 'slate' },
                    { title: 'Stone', value: 'stone' },
                    { title: 'Gray', value: 'gray' },
                    { title: 'Zinc', value: 'zinc' },
                ],
                initial: 0,
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
        ]);
        config = {
            $schema: 'https://shadcn-angular.dev/schema.json',
            style: responses.style,
            tailwind: {
                css: responses.globalCss,
                baseColor: responses.baseColor,
                cssVariables: true,
            },
            aliases: {
                components: responses.componentsPath.replace('src/', '@/'), // Basic heuristic
                utils: responses.utilsPath.replace('src/', '@/').replace('.ts', ''),
                ui: responses.componentsPath.replace('src/', '@/'),
            },
            iconLibrary: 'lucide-angular',
        };
    }
    const spinner = ora('Initializing project...').start();
    try {
        // Write components.json
        await fs.writeJson(componentsJsonPath, config, { spaces: 2 });
        spinner.text = 'Created components.json';
        // Create utils directory and file
        // Resolve path from the config alias, assuming @/ maps to src/ logic for file creation if not provided directly
        // But we have the 'responses' object from CLI prompt only in the else block above!
        // So we should rely on config to reconstruct the path, or better yet, if we are in 'defaults' mode, check what config is.
        // If config came from defaults, aliases are set.
        // We can reverse-map alias to path: @/ -> src/
        const utilsPathResolved = config.aliases.utils.replace('@/', 'src/');
        const utilsDir = path.dirname(path.join(cwd, utilsPathResolved + '.ts')); // utils usually ends in path/to/utils
        await fs.ensureDir(utilsDir);
        await fs.writeFile(path.join(cwd, utilsPathResolved + '.ts'), getUtilsTemplate());
        spinner.text = 'Created utils.ts';
        // Create tailwind.css file in the same directory as the global styles
        const stylesDir = path.dirname(path.join(cwd, config.tailwind.css));
        const tailwindCssPath = path.join(stylesDir, 'tailwind.css');
        // Write the tailwind.css file with all Tailwind directives
        await fs.writeFile(tailwindCssPath, getStylesTemplate(config.tailwind.baseColor));
        spinner.text = 'Created tailwind.css';
        // Add import to the user's global styles file if not already present
        const userStylesPath = path.join(cwd, config.tailwind.css);
        let userStyles = await fs.pathExists(userStylesPath)
            ? await fs.readFile(userStylesPath, 'utf-8')
            : '';
        const tailwindImport = '@import "./tailwind.css";';
        if (!userStyles.includes('tailwind.css')) {
            // Add import at the top of the file
            userStyles = tailwindImport + '\n\n' + userStyles;
            await fs.writeFile(userStylesPath, userStyles);
            spinner.text = 'Added tailwind.css import to styles';
        }
        // Create components/ui directory
        const uiPathResolved = config.aliases.ui.replace('@/', 'src/');
        const uiDir = path.join(cwd, uiPathResolved);
        await fs.ensureDir(uiDir);
        spinner.text = 'Created components directory';
        // Install dependencies
        spinner.text = 'Installing dependencies...';
        const dependencies = [
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
            'lucide-angular',
            'tailwindcss',
            'postcss',
            '@tailwindcss/postcss'
        ];
        await execa('npm', ['install', ...dependencies], { cwd });
        // Setup PostCSS - create .postcssrc.json which is the preferred format for Angular
        spinner.text = 'Configuring PostCSS...';
        const postcssrcPath = path.join(cwd, '.postcssrc.json');
        if (!await fs.pathExists(postcssrcPath)) {
            const configContent = {
                plugins: {
                    '@tailwindcss/postcss': {}
                }
            };
            await fs.writeJson(postcssrcPath, configContent, { spaces: 4 });
        }
        spinner.succeed(chalk.green('Project initialized successfully!'));
        console.log('\n' + chalk.bold('Next steps:'));
        console.log(chalk.dim('  1. Add components: ') + chalk.cyan('npx @gilav21/shadcn-angular add button'));
        console.log(chalk.dim('  2. Import and use in your templates'));
        console.log(chalk.dim('  3. Update your ') + chalk.bold('tsconfig.json') + chalk.dim(' paths:'));
        console.log(chalk.dim('    "compilerOptions": {'));
        console.log(chalk.dim('      "baseUrl": ".",'));
        console.log(chalk.dim('      "paths": {'));
        console.log(chalk.dim('        "@/*": ["./src/*"]'));
        console.log(chalk.dim('      }'));
        console.log(chalk.dim('    }'));
        console.log('');
    }
    catch (error) {
        spinner.fail('Failed to initialize project');
        console.error(error);
        process.exit(1);
    }
}
