/**
 * Silent, non-exiting engine behind the `apply` command. Everything here is
 * safe to call from a non-TTY context (the MCP `apply_addon` tool): it performs
 * no prompts, writes nothing to stdout, and signals failure by throwing
 * {@link ApplyError} instead of `process.exit`. The interactive CLI layer
 * (`commands/apply.ts`) reuses these helpers and adds prompts/printing on top.
 */
import path from 'node:path';
import fs from 'fs-extra';
import { registry, type ComponentName } from '../registry/index.js';
import type { Config } from '../utils/config.js';
import { aliasToProjectPath, resolveProjectPath } from '../utils/paths.js';
import { performInstall } from './install.js';
import type { ApplyOptions } from './apply-wire.js';
import {
    parseAttachSymbol,
    addonImportModule,
    missingBaseFiles,
    findTemplateInstances,
    insertSelectorAtInstances,
    wireDirectiveImport,
    resolveTemplateLocation,
    decideInstances,
} from './apply-wire.js';

/** Hard failure in the apply pipeline (bad addon, incompatible base). */
export class ApplyError extends Error {}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular', 'coverage', '.vscode']);

export interface AddonInfo {
    readonly name: ComponentName;
    readonly parent: string;
    readonly tag: string;
    readonly selector: string;
    readonly symbol: string;
    readonly module: string;
    readonly requiresBaseFiles: readonly string[];
}

/** A component file targeted for wiring + its resolved template source. */
export interface Target {
    readonly className: string;
    readonly tsPath: string;
    readonly templatePath: string; // === tsPath for inline templates
    readonly inline: boolean;
}

/** Per-component wiring outcome. `snippet` means it fell back to manual wiring. */
export interface WiredTarget {
    readonly className: string;
    readonly wired: number;
    readonly snippet: boolean;
}

export interface WireResult {
    readonly targets: WiredTarget[];
    readonly totalWired: number;
}

/** Resolve an addon key to its attach metadata, throwing on a non-addon. */
export function resolveAddonInfo(addonName: string, uiAlias: string): AddonInfo {
    const entry = registry[addonName as ComponentName];
    if (entry?.type !== 'addon' || !entry.attach || !entry.parent) {
        const available = Object.values(registry).filter(c => c.type === 'addon').map(c => c.name);
        throw new ApplyError(`"${addonName}" is not an addon. Available addons: ${available.join(', ') || '(none)'}`);
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

/**
 * The addon's required contract files that the installed base is missing.
 * Compatibility is a capability check (file presence), not a version/hash — an
 * edited base is still compatible while it ships the contract.
 */
export function missingBaseFilesFor(addon: AddonInfo, uiDir: string): string[] {
    return missingBaseFiles(addon.requiresBaseFiles, f => fs.existsSync(path.join(uiDir, f)));
}

export async function collectComponentFiles(root: string, managed: string[]): Promise<string[]> {
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
                if (SKIP_DIRS.has(entry.name) || managed.includes(full)) continue;
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

function templatePathFor(tsPath: string, source: string): { templatePath: string; inline: boolean } | null {
    const loc = resolveTemplateLocation(source);
    if (!loc) return null;
    if (loc.inline) return { templatePath: tsPath, inline: true };
    return { templatePath: path.resolve(path.dirname(tsPath), loc.templateUrl), inline: false };
}

/** Build a Target from a component .ts path, or null if it has no template. */
export async function toTarget(tsPath: string): Promise<Target | null> {
    const source = await fs.readFile(tsPath, 'utf-8');
    const className = classNameOf(source);
    const tpl = templatePathFor(tsPath, source);
    if (!className || !tpl) return null;
    return { className, tsPath, templatePath: tpl.templatePath, inline: tpl.inline };
}

export async function readTemplate(target: Target, tsSource: string): Promise<string> {
    return target.inline ? tsSource : fs.readFile(target.templatePath, 'utf-8');
}

export async function componentsUsingTag(files: string[], tag: string): Promise<{ target: Target; count: number }[]> {
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

/** Silent file selection by explicit component class name(s). */
async function matchByClassName(files: string[], components: string[]): Promise<Target[]> {
    const wanted = new Set(components);
    const matched: Target[] = [];
    for (const file of files) {
        const t = await toTarget(file);
        if (t && wanted.has(t.className)) matched.push(t);
    }
    return matched;
}

/**
 * Select target files non-interactively: explicit class names if given, else
 * every app-code component that uses the base tag (the `--yes`/scan-all path).
 */
async function selectTargetsSilent(addon: AddonInfo, components: string[], root: string, managed: string[]): Promise<Target[]> {
    const files = await collectComponentFiles(root, managed);
    if (components.length > 0) return matchByClassName(files, components);
    return (await componentsUsingTag(files, addon.tag)).map(u => u.target);
}

/** Wire one target silently; returns its outcome (0 wired + snippet on ambiguity). */
async function wireOneTarget(addon: AddonInfo, target: Target, options: ApplyOptions): Promise<WiredTarget> {
    const tsSource = await fs.readFile(target.tsPath, 'utf-8');
    const template = await readTemplate(target, tsSource);
    const instances = findTemplateInstances(template, addon.tag);

    // Non-interactive: an explicit flag filters; a single unwired instance
    // auto-wires; genuine ambiguity falls back to a snippet (never a prompt).
    const decision = decideInstances(addon.selector, instances, { ...options, yes: true });
    if (decision.kind !== 'instances') return { className: target.className, wired: 0, snippet: true };

    const edited = insertSelectorAtInstances(template, decision.instances, addon.selector);
    const tsForImport = target.inline ? edited.content : tsSource;
    const wiredTs = wireDirectiveImport(tsForImport, addon.symbol, addon.module);
    if (!wiredTs) return { className: target.className, wired: 0, snippet: true };

    if (!options.dryRun && edited.wired > 0) {
        if (target.inline) {
            await fs.writeFile(target.tsPath, wiredTs.content);
        } else {
            await fs.writeFile(target.templatePath, edited.content);
            await fs.writeFile(target.tsPath, wiredTs.content);
        }
    }
    return { className: target.className, wired: edited.wired, snippet: false };
}

/** Select and wire targets silently (no prompts, no stdout). */
export async function wireAddonCore(
    addon: AddonInfo, components: string[], options: ApplyOptions, root: string, managed: string[],
): Promise<WireResult> {
    const targets = await selectTargetsSilent(addon, components, root, managed);
    const wired: WiredTarget[] = [];
    let totalWired = 0;
    for (const target of targets) {
        const outcome = await wireOneTarget(addon, target, options);
        wired.push(outcome);
        totalWired += outcome.wired;
    }
    return { targets: wired, totalWired };
}

export interface ApplyCoreResult {
    readonly addon: string;
    readonly installed: boolean;
    readonly targets: WiredTarget[];
    readonly totalWired: number;
    /** The paste snippet — always available so callers can show manual wiring. */
    readonly snippet: { import: string; selector: string; tag: string };
}

/**
 * Full non-interactive apply: install the addon (and base) if missing, verify
 * the base provides the addon's contract, then wire it into the chosen targets.
 * Throws {@link ApplyError} for hard failures; never prompts or exits.
 */
export async function applyCore(
    addonName: string, components: string[], options: ApplyOptions, cwd: string, config: Config,
): Promise<ApplyCoreResult> {
    const uiAlias = config.aliases.ui || 'src/components/ui';
    const addon = resolveAddonInfo(addonName, uiAlias);

    let installed = false;
    if (!options.dryRun) {
        await performInstall({ components: [addon.name], cwd, config, options });
        installed = true;

        const uiDir = resolveProjectPath(cwd, aliasToProjectPath(uiAlias));
        const missing = missingBaseFilesFor(addon, uiDir);
        if (missing.length > 0) {
            throw new ApplyError(
                `Your ${addon.parent} predates the ${addon.name} addon — it is missing the contract file(s): ${missing.join(', ')}. ` +
                `Run \`update ${addon.parent}\` (you own the source — review the changes), then re-apply.`,
            );
        }
    }

    const managed = [config.aliases.ui, config.aliases.blocks]
        .filter((a): a is string => Boolean(a))
        .map(a => resolveProjectPath(cwd, aliasToProjectPath(a)));
    const result = await wireAddonCore(addon, components, options, cwd, managed);

    return {
        addon: addon.name,
        installed,
        targets: result.targets,
        totalWired: result.totalWired,
        snippet: {
            import: `import { ${addon.symbol} } from '${addon.module}';`,
            selector: addon.selector,
            tag: addon.tag,
        },
    };
}
