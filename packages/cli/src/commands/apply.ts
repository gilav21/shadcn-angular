import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { registry, type ComponentName } from '../registry/index.js';
import { getConfig } from '../utils/config.js';
import { aliasToProjectPath, resolveProjectPath } from '../utils/paths.js';
import { performInstall } from '../core/install.js';
import type { AddOptions } from '../core/plan.js';
import {
    parseAttachSymbol,
    addonImportModule,
    missingBaseFiles,
    findTemplateInstances,
    insertSelectorAtInstances,
    wireDirectiveImport,
    resolveTemplateLocation,
    decideInstances,
    type TemplateInstance,
} from '../core/apply-wire.js';

export interface ApplyOptions extends AddOptions {
    /** Instance selection. */
    all?: boolean;
    class?: string;
    id?: string;
    /** Force the project-wide scan even when a component could be inferred. */
    scan?: boolean;
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular', 'coverage', '.vscode']);

interface AddonInfo {
    readonly name: ComponentName;
    readonly parent: string;
    readonly tag: string;
    readonly selector: string;
    readonly symbol: string;
    readonly module: string;
    readonly requiresBaseFiles: readonly string[];
}

/** A component file targeted for wiring + its resolved template source. */
interface Target {
    readonly className: string;
    readonly tsPath: string;
    readonly templatePath: string; // === tsPath for inline templates
    readonly inline: boolean;
}

function onCancel(): never {
    console.log(chalk.dim('Cancelled.'));
    process.exit(0);
}

function fail(message: string): never {
    console.log(chalk.red(message));
    process.exit(1);
}

function resolveAddon(addonName: string, uiAlias: string): AddonInfo {
    const entry = registry[addonName as ComponentName];
    if (!entry || entry.type !== 'addon' || !entry.attach || !entry.parent) {
        const available = Object.values(registry).filter(c => c.type === 'addon').map(c => c.name);
        fail(`"${addonName}" is not an addon. Available addons: ${available.join(', ') || '(none)'}`);
    }
    return {
        name: addonName as ComponentName,
        parent: entry.parent,
        tag: `ui-${entry.parent}`,
        selector: entry.attach.selector,
        symbol: parseAttachSymbol(entry.attach.import),
        module: addonImportModule(uiAlias, entry.parent, addonName),
        requiresBaseFiles: entry.requiresBaseFiles ?? [],
    };
}

async function collectComponentFiles(root: string, managed: string[]): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
        let entries: fs.Dirent[];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            return; // unreadable dir — skip
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name) || managed.some(m => full === m)) continue;
                await walk(full);
            } else if (entry.name.endsWith('.component.ts')) {
                out.push(full);
            }
        }
    };
    await walk(root);
    return out;
}

function classNameOf(source: string): string | null {
    return /export\s+class\s+([A-Za-z_$][\w$]*)/.exec(source)?.[1] ?? null;
}

async function templatePathFor(tsPath: string, source: string): Promise<{ templatePath: string; inline: boolean } | null> {
    const loc = resolveTemplateLocation(source);
    if (!loc) return null;
    if (loc.inline) return { templatePath: tsPath, inline: true };
    return { templatePath: path.resolve(path.dirname(tsPath), loc.templateUrl), inline: false };
}

async function readTemplate(target: Target, tsSource: string): Promise<string> {
    return target.inline ? tsSource : fs.readFile(target.templatePath, 'utf-8');
}

/** Build a Target from a component .ts path, or null if it has no template. */
async function toTarget(tsPath: string): Promise<Target | null> {
    const source = await fs.readFile(tsPath, 'utf-8');
    const className = classNameOf(source);
    const tpl = await templatePathFor(tsPath, source);
    if (!className || !tpl) return null;
    return { className, tsPath, templatePath: tpl.templatePath, inline: tpl.inline };
}

async function componentsUsingTag(files: string[], tag: string): Promise<{ target: Target; count: number }[]> {
    const result: { target: Target; count: number }[] = [];
    for (const file of files) {
        const target = await toTarget(file);
        if (!target) continue;
        const source = await fs.readFile(target.tsPath, 'utf-8');
        const template = await readTemplate(target, source);
        const count = findTemplateInstances(template, tag).length;
        if (count > 0) result.push({ target, count });
    }
    return result;
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

export async function apply(addonName: string, components: string[], options: ApplyOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) fail('components.json not found. Run `npx @gilav21/shadcn-angular init` first.');
    if (!options.registry && config.registry) options.registry = config.registry;

    const uiAlias = config.aliases.ui || 'src/components/ui';
    const addon = resolveAddon(addonName, uiAlias);

    // 1. Install the addon (and its base) if not already present.
    if (!options.dryRun) {
        const spinner = ora(`Installing ${addon.name} if missing...`).start();
        try {
            await performInstall({ components: [addon.name], cwd, config, options });
            spinner.succeed(`${addon.name} installed.`);
        } catch (error) {
            spinner.fail('Install failed');
            console.error(error);
            process.exit(1);
        }

        // Compat guard: the installed base must provide the addon's contract.
        // Robust to edits — only the contract file's presence matters, not version.
        const uiDir = resolveProjectPath(cwd, aliasToProjectPath(uiAlias));
        const missing = missingBaseFiles(addon.requiresBaseFiles, f => fs.existsSync(path.join(uiDir, f)));
        if (missing.length > 0) {
            fail(
                `Your ${addon.parent} predates the ${addon.name} addon — it is missing the contract file(s): ${missing.join(', ')}.\n` +
                `Run \`npx @gilav21/shadcn-angular update ${addon.parent}\` (you own the source — review the changes), then re-run apply.`,
            );
        }
    }

    // 2. Resolve target files — app code only (skip the managed ui/blocks dirs).
    const managed = [config.aliases.ui, config.aliases.blocks]
        .filter((a): a is string => Boolean(a))
        .map(a => resolveProjectPath(cwd, aliasToProjectPath(a)));
    const targets = await selectTargets(addon, components, options, cwd, managed);
    if (targets.length === 0) { console.log(chalk.dim('Nothing to wire.')); return; }

    // 3. Wire each.
    let total = 0;
    for (const target of targets) total += await wireTarget(addon, target, options);
    if (total === 0) console.log(chalk.dim('No instances wired (already wired or none selected).'));
}
