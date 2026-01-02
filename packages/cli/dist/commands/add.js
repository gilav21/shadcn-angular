import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../utils/config.js';
import { registry } from '../registry/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Components source directory (relative to CLI dist folder)
// When built, this resolves to packages/components/ui
function getComponentsDir() {
    // From dist/commands/add.js -> packages/components/ui
    const fromDist = path.resolve(__dirname, '../../../components/ui');
    if (fs.existsSync(fromDist)) {
        return fromDist;
    }
    // Fallback: from src/commands/add.ts -> packages/components/ui
    const fromSrc = path.resolve(__dirname, '../../../components/ui');
    return fromSrc;
}
export async function add(components, options) {
    const cwd = process.cwd();
    // Load config
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx shadcn-angular init` first.'));
        process.exit(1);
    }
    // Get components to add
    let componentsToAdd = [];
    if (options.all) {
        componentsToAdd = Object.keys(registry);
    }
    else if (components.length === 0) {
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
    }
    else {
        componentsToAdd = components;
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
    const allComponents = new Set();
    const resolveDeps = (name) => {
        allComponents.add(name);
        const component = registry[name];
        if (component.dependencies) {
            component.dependencies.forEach(dep => resolveDeps(dep));
        }
    };
    componentsToAdd.forEach(c => resolveDeps(c));
    const targetDir = options.path
        ? path.join(cwd, options.path)
        : path.join(cwd, 'src/components/ui');
    const componentsSourceDir = getComponentsDir();
    // Verify source directory exists
    if (!await fs.pathExists(componentsSourceDir)) {
        console.log(chalk.red('Error: Components source directory not found.'));
        console.log(chalk.dim(`Expected at: ${componentsSourceDir}`));
        process.exit(1);
    }
    // Check for existing files
    const existing = [];
    for (const name of allComponents) {
        const component = registry[name];
        for (const file of component.files) {
            const targetPath = path.join(targetDir, file);
            if (await fs.pathExists(targetPath)) {
                existing.push(file);
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
                const sourcePath = path.join(componentsSourceDir, file);
                const targetPath = path.join(targetDir, file);
                // Read source file content
                if (!await fs.pathExists(sourcePath)) {
                    spinner.warn(`Source file not found: ${file}`);
                    continue;
                }
                const content = await fs.readFile(sourcePath, 'utf-8');
                await fs.ensureDir(path.dirname(targetPath));
                await fs.writeFile(targetPath, content);
                spinner.text = `Added ${file}`;
            }
        }
        spinner.succeed(chalk.green(`Added ${allComponents.size} component(s)`));
        console.log('\n' + chalk.dim('Components added:'));
        allComponents.forEach(name => {
            console.log(chalk.dim('  - ') + chalk.cyan(name));
        });
        console.log('');
    }
    catch (error) {
        spinner.fail('Failed to add components');
        console.error(error);
        process.exit(1);
    }
}
