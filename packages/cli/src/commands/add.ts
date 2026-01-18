import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../utils/config.js';
import { registry, type ComponentName } from '../registry/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base URL for the component registry (GitHub raw content)
const REGISTRY_BASE_URL = 'https://raw.githubusercontent.com/gilav21/shadcn-angular/master/packages/components/ui';

// Components source directory (relative to CLI dist folder) for local dev
function getLocalComponentsDir(): string | null {
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

interface AddOptions {
    yes?: boolean;
    overwrite?: boolean;
    all?: boolean;
    path?: string;
    remote?: boolean; // Force remote fetch
}

async function fetchComponentContent(file: string, options: AddOptions): Promise<string> {
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
    } catch (error) {
        if (localDir) {
            throw new Error(`Component file not found locally or remotely: ${file}`);
        }
        throw error;
    }
}

export async function add(components: string[], options: AddOptions) {
    const cwd = process.cwd();

    // Load config
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
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
    const allComponents = new Set<ComponentName>();
    const resolveDeps = (name: ComponentName) => {
        if (allComponents.has(name)) return;
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

    // Check for existing files and diff
    const componentsToInstall: ComponentName[] = [];
    const componentsToSkip: string[] = [];
    const conflictingComponents: ComponentName[] = [];
    const contentCache = new Map<string, string>();

    const checkSpinner = ora('Checking for conflicts...').start();

    for (const name of allComponents) {
        const component = registry[name];
        let hasChanges = false;
        let isFullyPresent = true;

        for (const file of component.files) {
            const targetPath = path.join(targetDir, file);
            if (await fs.pathExists(targetPath)) {
                const localContent = await fs.readFile(targetPath, 'utf-8');

                try {
                    let remoteContent = await fetchComponentContent(file, options);
                    // Transform imports for comparison
                    const utilsAlias = config.aliases.utils;
                    remoteContent = remoteContent.replace(/(\.\.\/)+lib\/utils/g, utilsAlias);

                    const normalize = (str: string) => str.replace(/\s+/g, '').trim();
                    if (normalize(localContent) !== normalize(remoteContent)) {
                        hasChanges = true;
                    }
                    contentCache.set(file, remoteContent); // Cache for installation
                } catch (error) {
                    // unexpected error fetching remote
                    console.warn(`Could not fetch remote content for comparison: ${file}`);
                    hasChanges = true; // Assume changed/unknown
                }
            } else {
                isFullyPresent = false;
            }
        }

        if (isFullyPresent && !hasChanges) {
            componentsToSkip.push(name);
        } else if (hasChanges) {
            conflictingComponents.push(name);
        } else {
            componentsToInstall.push(name);
        }
    }

    checkSpinner.stop();

    let componentsToOverwrite: ComponentName[] = [];

    if (conflictingComponents.length > 0) {
        if (options.overwrite) {
            componentsToOverwrite = conflictingComponents;
        } else if (options.yes) {
            componentsToOverwrite = []; // Skip conflicts in non-interactive mode unless --overwrite
        } else {
            console.log(chalk.yellow(`\n${conflictingComponents.length} component(s) have local changes or are different from remote.`));
            const { selected } = await prompts({
                type: 'multiselect',
                name: 'selected',
                message: 'Select components to OVERWRITE (Unselected will be skipped):',
                choices: conflictingComponents.map(name => ({
                    title: name,
                    value: name,
                })),
                hint: '- Space to select, Enter to confirm',
            });
            componentsToOverwrite = selected || [];
        }
    }

    // Final list of components to process
    // We process:
    // 1. componentsToInstall (Brand new or partial)
    // 2. componentsToOverwrite (User selected)
    // We SKIP:
    // 1. componentsToSkip (Identical)
    // 2. conflictingComponents NOT in componentsToOverwrite

    const finalComponents = [...componentsToInstall, ...componentsToOverwrite];

    if (finalComponents.length === 0 && componentsToSkip.length > 0) {
        console.log(chalk.green(`\nAll components are up to date! (${componentsToSkip.length} skipped)`));
        return;
    }

    if (finalComponents.length === 0) {
        console.log(chalk.dim('\nNo components to install.'));
        return;
    }

    const spinner = ora('Installing components...').start();
    let successCount = 0;

    try {
        await fs.ensureDir(targetDir);

        for (const name of finalComponents) {
            const component = registry[name];
            let componentSuccess = true;

            for (const file of component.files) {
                const targetPath = path.join(targetDir, file);

                try {
                    let content = contentCache.get(file);
                    if (!content) {
                        content = await fetchComponentContent(file, options);
                        // Transform imports if not already transformed (cached is transformed)
                        const utilsAlias = config.aliases.utils;
                        content = content.replace(/(\.\.\/)+lib\/utils/g, utilsAlias);
                    }

                    await fs.ensureDir(path.dirname(targetPath));
                    await fs.writeFile(targetPath, content);
                    // spinner.text = `Added ${file}`; // Too verbose?
                } catch (err: any) {
                    spinner.warn(`Could not add ${file}: ${err.message}`);
                    componentSuccess = false;
                }
            }
            if (componentSuccess) {
                successCount++;
                spinner.text = `Added ${name}`;
            }
        }

        if (successCount > 0) {
            spinner.succeed(chalk.green(`Success! Added ${successCount} component(s)`));

            console.log('\n' + chalk.dim('Components added:'));
            finalComponents.forEach(name => {
                console.log(chalk.dim('  - ') + chalk.cyan(name));
            });
        } else {
            spinner.info('No new components installed.');
        }

        if (componentsToSkip.length > 0) {
            console.log('\n' + chalk.dim('Components skipped (up to date):'));
            componentsToSkip.forEach(name => {
                console.log(chalk.dim('  - ') + chalk.gray(name));
            });
        }

        console.log('');

    } catch (error) {
        spinner.fail('Failed to add components');
        console.error(error);
        process.exit(1);
    }
}
