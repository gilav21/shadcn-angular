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
// Base URL for the component registry (GitHub raw content)
const REGISTRY_BASE_URL = 'https://raw.githubusercontent.com/gilav21/shadcn-angular/master/packages/components/ui';
// Components source directory (relative to CLI dist folder) for local dev
function getLocalComponentsDir() {
    // From dist/commands/add.js -> packages/components/ui
    const fromDist = path.resolve(__dirname, '../../../components/ui');
    if (fs.existsSync(fromDist)) {
        return fromDist;
    }
    // Fallback: from src/commands/add.ts -> packages/components/ui
    const fromSrc = path.resolve(__dirname, '../../../components/ui');
    if (fs.existsSync(fromSrc)) {
        return fromSrc;
    }
    return null;
}
async function fetchComponentContent(file, options) {
    const localDir = getLocalComponentsDir();
    // 1. Prefer local if available and not forced remote
    if (localDir && !options.remote) {
        const localPath = path.join(localDir, file);
        if (await fs.pathExists(localPath)) {
            return fs.readFile(localPath, 'utf-8');
        }
    }
    // 2. Fetch from remote registry
    const url = `${REGISTRY_BASE_URL}/${file}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch component from ${url}: ${response.statusText}`);
        }
        return await response.text();
    }
    catch (error) {
        if (localDir) {
            throw new Error(`Component file not found locally or remotely: ${file}`);
        }
        throw error;
    }
}
export async function add(components, options) {
    const cwd = process.cwd();
    // Load config
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
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
    if (!componentsToAdd || componentsToAdd.length === 0) {
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
        if (allComponents.has(name))
            return;
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
    let successCount = 0;
    try {
        await fs.ensureDir(targetDir);
        for (const name of allComponents) {
            const component = registry[name];
            let componentSuccess = true;
            for (const file of component.files) {
                const targetPath = path.join(targetDir, file);
                try {
                    let content = await fetchComponentContent(file, options);
                    // Transform imports
                    // Replace ../lib/utils (or similar relative paths) with the configured alias
                    const utilsAlias = config.aliases.utils;
                    content = content.replace(/(\.\.\/)+lib\/utils/g, utilsAlias);
                    await fs.ensureDir(path.dirname(targetPath));
                    await fs.writeFile(targetPath, content);
                    spinner.text = `Added ${file}`;
                }
                catch (err) {
                    spinner.warn(`Could not add ${file}: ${err.message}`);
                    componentSuccess = false;
                }
            }
            if (componentSuccess)
                successCount++;
        }
        if (successCount > 0) {
            spinner.succeed(chalk.green(`Added ${successCount} component(s)`));
            console.log('\n' + chalk.dim('Components added:'));
            allComponents.forEach(name => {
                console.log(chalk.dim('  - ') + chalk.cyan(name));
            });
            console.log('');
        }
        else {
            spinner.fail(chalk.red('Failed to add any components.'));
        }
    }
    catch (error) {
        spinner.fail('Failed to add components');
        console.error(error);
        process.exit(1);
    }
}
