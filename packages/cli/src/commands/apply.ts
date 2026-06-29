import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { getConfig, type Config } from '../utils/config.js';
import { aliasToProjectPath, resolveProjectPath } from '../utils/paths.js';
import { performInstall } from '../core/install.js';
import {
    findTemplateInstances,
    insertSelectorAtInstances,
    wireDirectiveImport,
    decideInstances,
    type ApplyOptions,
    type TemplateInstance,
} from '../core/apply-wire.js';
import {
    ApplyError,
    resolveAddonInfo,
    collectComponentFiles,
    toTarget,
    readTemplate,
    componentsUsingTag,
    missingBaseFilesFor,
    type AddonInfo,
    type Target,
} from '../core/apply-core.js';

export type { ApplyOptions };

function onCancel(): never {
    console.log(chalk.dim('Cancelled.'));
    process.exit(0);
}

function fail(message: string): never {
    console.log(chalk.red(message));
    process.exit(1);
}

/** Resolve an addon for the CLI, turning an {@link ApplyError} into an exit. */
function resolveAddon(addonName: string, uiAlias: string): AddonInfo {
    try {
        return resolveAddonInfo(addonName, uiAlias);
    } catch (e) {
        if (e instanceof ApplyError) fail(e.message);
        throw e;
    }
}

/** File selection by explicit component class name(s). */
async function matchByClassName(files: string[], components: string[]): Promise<Target[]> {
    const wanted = new Set(components);
    const matched: Target[] = [];
    for (const file of files) {
        const t = await toTarget(file);
        if (t && wanted.has(t.className)) matched.push(t);
    }
    const missing = [...wanted].filter(c => !matched.some(t => t.className === c));
    if (missing.length > 0) console.log(chalk.yellow(`No component class found for: ${missing.join(', ')}`));
    return matched;
}

/** File selection by scanning the app for usages (interactive unless --yes). */
async function selectByScan(addon: AddonInfo, files: string[], options: ApplyOptions, root: string): Promise<Target[]> {
    const usages = await componentsUsingTag(files, addon.tag);
    if (usages.length === 0) {
        console.log(chalk.dim(`No <${addon.tag}> usages found in your app code.`));
        return [];
    }
    if (usages.length === 1 && !options.scan) return [usages[0].target];
    if (options.yes) return usages.map(u => u.target);

    const { picked } = await prompts({
        type: 'multiselect',
        name: 'picked',
        message: `Wire ${addon.name} into which component(s)?`,
        choices: usages.map(u => {
            const meta = `(${u.count} <${addon.tag}>, ${path.relative(root, u.target.tsPath)})`;
            return { title: `${u.target.className} ${chalk.dim(meta)}`, value: u.target };
        }),
        hint: '- Space to select, Enter to confirm',
    }, { onCancel });
    return (picked as Target[] | undefined) ?? [];
}

/** Resolve which component files to wire (named args, single-dir, or scan). */
async function selectTargets(
    addon: AddonInfo, components: string[], options: ApplyOptions, root: string, managed: string[],
): Promise<Target[]> {
    const files = await collectComponentFiles(root, managed);
    if (components.length > 0 && options.scan) {
        console.log(chalk.yellow(`--scan ignores the named component(s): ${components.join(', ')}`));
    }
    if (components.length > 0 && !options.scan) return matchByClassName(files, components);
    return selectByScan(addon, files, options, root);
}

function printSnippet(addon: AddonInfo): void {
    console.log(chalk.yellow('\nCould not auto-wire — add this manually:'));
    console.log(chalk.dim(`  import { ${addon.symbol} } from '${addon.module}';`));
    console.log(chalk.dim(`  // @Component imports: [ … ${addon.symbol} ]`));
    console.log(chalk.dim(`  // on the <${addon.tag}> tag: ${addon.selector}`));
}

/** Choose the instances to wire in one component (flag / single / interactive / snippet). */
async function chooseInstances(
    addon: AddonInfo, all: TemplateInstance[], options: ApplyOptions,
): Promise<TemplateInstance[] | 'snippet'> {
    const decision = decideInstances(addon.selector, all, options);
    if (decision.kind === 'snippet') return 'snippet';
    if (decision.kind === 'instances') return decision.instances;
    const { picked } = await prompts({
        type: 'multiselect',
        name: 'picked',
        message: `Which <${addon.tag}> instance(s)?`,
        choices: all.map((inst, i) => ({
            title: `#${i + 1}${inst.ids.length ? ' ' + chalk.dim(inst.ids.join(',')) : ''}${inst.classToken ? chalk.dim(' .' + inst.classToken) : ''}`,
            value: inst,
        })),
        hint: '- Space to select, Enter to confirm',
    }, { onCancel });
    return (picked as TemplateInstance[] | undefined) ?? [];
}

async function wireTarget(addon: AddonInfo, target: Target, options: ApplyOptions): Promise<number> {
    const tsSource = await fs.readFile(target.tsPath, 'utf-8');
    const template = await readTemplate(target, tsSource);
    const instances = findTemplateInstances(template, addon.tag);

    const chosen = await chooseInstances(addon, instances, options);
    if (chosen === 'snippet') { printSnippet(addon); return 0; }
    if (chosen.length === 0) return 0;

    const edited = insertSelectorAtInstances(template, chosen, addon.selector);

    // Wire the directive import into the component .ts (always).
    const tsForImport = target.inline ? edited.content : tsSource;
    const wiredTs = wireDirectiveImport(tsForImport, addon.symbol, addon.module);
    if (!wiredTs) { printSnippet(addon); return 0; }

    if (options.dryRun) {
        console.log(chalk.dim(`  [dry-run] ${target.className}: would wire ${edited.wired} instance(s)`));
        return edited.wired;
    }

    if (target.inline) {
        await fs.writeFile(target.tsPath, wiredTs.content);
    } else {
        await fs.writeFile(target.templatePath, edited.content);
        await fs.writeFile(target.tsPath, wiredTs.content);
    }
    console.log(chalk.green(`  ✓ ${target.className}: wired ${edited.wired} instance(s)`));
    return edited.wired;
}

/** Install the addon (+ base) if missing and verify the contract is present. */
async function installAndCheckCompat(addon: AddonInfo, cwd: string, uiAlias: string, options: ApplyOptions, config: Config): Promise<void> {
    const spinner = ora(`Installing ${addon.name} if missing...`).start();
    try {
        await performInstall({ components: [addon.name], cwd, config, options });
        spinner.succeed(`${addon.name} installed.`);
    } catch (error) {
        spinner.fail('Install failed');
        console.error(error);
        process.exit(1);
    }

    const uiDir = resolveProjectPath(cwd, aliasToProjectPath(uiAlias));
    const missing = missingBaseFilesFor(addon, uiDir);
    if (missing.length > 0) {
        fail(
            `Your ${addon.parent} predates the ${addon.name} addon — it is missing the contract file(s): ${missing.join(', ')}.\n` +
            `Run \`npx @gilav21/shadcn-angular update ${addon.parent}\` (you own the source — review the changes), then re-run apply.`,
        );
    }
}

export async function apply(addonName: string, components: string[], options: ApplyOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) fail('components.json not found. Run `npx @gilav21/shadcn-angular init` first.');
    if (!options.registry && config.registry) options.registry = config.registry;

    const uiAlias = config.aliases.ui || 'src/components/ui';
    const addon = resolveAddon(addonName, uiAlias);

    if (!options.dryRun) await installAndCheckCompat(addon, cwd, uiAlias, options, config);

    const managed = [config.aliases.ui, config.aliases.blocks]
        .filter((a): a is string => Boolean(a))
        .map(a => resolveProjectPath(cwd, aliasToProjectPath(a)));
    const targets = await selectTargets(addon, components, options, cwd, managed);
    if (targets.length === 0) { console.log(chalk.dim('Nothing to wire.')); return; }

    let total = 0;
    for (const target of targets) total += await wireTarget(addon, target, options);
    if (total === 0) console.log(chalk.dim('No instances wired (already wired or none selected).'));
}
