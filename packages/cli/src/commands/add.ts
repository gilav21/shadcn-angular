import fs from 'fs-extra';
import path from 'path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../utils/config.js';
import { registry, type ComponentName } from '../registry/index.js';

interface AddOptions {
    yes?: boolean;
    overwrite?: boolean;
    all?: boolean;
    path?: string;
}

export async function add(components: string[], options: AddOptions) {
    const cwd = process.cwd();

    // Load config
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx shadcn-angular init` first.'));
        process.exit(1);
    }

    // Get components to add
    let componentsToAdd: ComponentName[] = [];

    if (options.all) {
        componentsToAdd = Object.keys(registry) as ComponentName[];
    } else if (components.length === 0) {
        const { selected } = await prompts({
            type: 'multiselect',
            name: 'selected',
            message: 'Which components would you like to add?',
            choices: Object.keys(registry).map(name => ({
                title: name,
                value: name,
            })),
            hint: '- Space to select, Enter to confirm',
        });
        componentsToAdd = selected;
    } else {
        componentsToAdd = components as ComponentName[];
    }

    if (componentsToAdd.length === 0) {
        console.log(chalk.dim('No components selected.'));
        return;
    }

    // Validate components exist
    const invalidComponents = componentsToAdd.filter(c => !registry[c]);
    if (invalidComponents.length > 0) {
        console.log(chalk.red(`Invalid component(s): ${invalidComponents.join(', ')}`));
        console.log(chalk.dim('Available components: ' + Object.keys(registry).join(', ')));
        process.exit(1);
    }

    // Resolve dependencies
    const allComponents = new Set<ComponentName>();
    const resolveDeps = (name: ComponentName) => {
        allComponents.add(name);
        const component = registry[name];
        if (component.dependencies) {
            component.dependencies.forEach(dep => resolveDeps(dep as ComponentName));
        }
    };
    componentsToAdd.forEach(c => resolveDeps(c));

    const targetDir = options.path
        ? path.join(cwd, options.path)
        : path.join(cwd, 'src/components/ui');

    // Check for existing files
    const existing: string[] = [];
    for (const name of allComponents) {
        const component = registry[name];
        for (const file of component.files) {
            const filePath = path.join(targetDir, file.name);
            if (await fs.pathExists(filePath)) {
                existing.push(file.name);
            }
        }
    }

    if (existing.length > 0 && !options.overwrite && !options.yes) {
        const { overwrite } = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: `The following files already exist: ${existing.join(', ')}. Overwrite?`,
            initial: false,
        });
        if (!overwrite) {
            console.log(chalk.dim('Installation cancelled.'));
            return;
        }
    }

    const spinner = ora('Installing components...').start();

    try {
        await fs.ensureDir(targetDir);

        for (const name of allComponents) {
            const component = registry[name];

            for (const file of component.files) {
                const filePath = path.join(targetDir, file.name);
                await fs.ensureDir(path.dirname(filePath));
                await fs.writeFile(filePath, file.content);
                spinner.text = `Added ${file.name}`;
            }
        }

        spinner.succeed(chalk.green(`Added ${allComponents.size} component(s)`));

        console.log('\n' + chalk.dim('Components added:'));
        allComponents.forEach(name => {
            console.log(chalk.dim('  - ') + chalk.cyan(name));
        });
        console.log('');

    } catch (error) {
        spinner.fail('Failed to add components');
        console.error(error);
        process.exit(1);
    }
}
