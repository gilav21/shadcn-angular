import { z } from 'zod';
import type { ToolHost } from '../serialize.js';
import fs from 'fs-extra';
import path from 'node:path';
import { isComponentName, type ComponentName } from '../../registry/index.js';
import { performInstall } from '../../core/install.js';
import { collectBreakingChanges } from '../../core/plan.js';
import { resolvePreset, PresetError } from '../../core/presets.js';
import { hasUnresolvedConflicts } from '../../core/merge.js';
import { scanStaleSelectors } from '../../core/codemod.js';
import { initProject } from '../../core/init-core.js';
import { applyCore, resolveAddonInfo, ApplyError } from '../../core/apply-core.js';
import { diffComponentFiles, type ComponentDiff } from '../../core/diff-core.js';
import { getConfig, getDefaultConfig, getPrefix, type Config } from '../../utils/config.js';
import { resolveTestInstall } from '../../utils/test-runner.js';
import { aliasToProjectPath, resolveProjectPath } from '../../utils/paths.js';
import { isValidPrefix, DEFAULT_PREFIX } from '../../utils/prefix.js';
import { json, err } from './result.js';
import { sourceInputSchema, resolveSource } from './options.js';
import { migrateCore } from '../../core/migrate-core.js';
import { setDensityCore, COMPONENT_DENSITY_VARS } from '../../commands/set-density.js';
import { setRadiusCore, RADIUS_NAMED } from '../../commands/set-radius.js';
import { setMotionCore } from '../../commands/set-motion.js';
import { changeThemeCore, VALID_THEMES } from '../../commands/change-theme.js';
import { setLocaleCore } from '../../commands/set-locale.js';
import { setTestRunnerCore } from '../../commands/set-test-runner.js';
import { applyInitDefaults, type InitDefaults } from '../../commands/init.js';
import { isValidHex } from '../../utils/color.js';
import { collectDoctorReport, buildFixPlan, doctorFixCore, refreshLibCore } from '../../commands/doctor.js';

function validateNames(names: string[]): string[] {
    return names.filter(n => !isComponentName(n));
}

const initInputSchema = {
    prefix: z.string().optional().describe('Component selector prefix (default "ui").'),
    baseColor: z.enum(['neutral', 'slate', 'stone', 'gray', 'zinc']).optional(),
    theme: z.enum([
        'zinc', 'slate', 'stone', 'gray', 'neutral', 'red', 'rose',
        'orange', 'green', 'blue', 'yellow', 'violet', 'amber',
    ]).optional(),
    cssPath: z.string().optional().describe('Global styles file (default src/styles.scss).'),
    createShortcutRegistry: z.boolean().optional(),
    density: z.number().int().min(1).max(5).optional().describe('Initial density level (default 3).'),
    radius: z.string().optional().describe('Initial border radius: none, sm, md, lg, xl, full, or a raw value like "0.5rem".'),
    motion: z.number().int().min(0).max(2).optional().describe('Initial motion level (default 1).'),
    themeFrom: z.string().optional().describe('Generate the initial theme from a brand hex color (e.g. "#3b82f6") — mutually exclusive with theme.'),
    locale: z.string().optional().describe('Default UI locale baked into the installed i18n files (e.g. "he").'),
    ...sourceInputSchema,
};

type InitArgs = z.infer<z.ZodObject<typeof initInputSchema>>;

/** The invalid-argument message for `init_project`, or null when the args are usable. */
function validateInitArgs(args: InitArgs): string | null {
    if (args.prefix !== undefined && !isValidPrefix(args.prefix)) {
        return `Invalid prefix "${args.prefix}" — must be lowercase kebab-case starting with a letter.`;
    }
    if (args.theme && args.themeFrom) {
        return 'Pass either theme or themeFrom, not both.';
    }
    if (args.themeFrom !== undefined && !isValidHex(args.themeFrom)) {
        return `Invalid themeFrom "${args.themeFrom}" — use a hex color like "#3b82f6".`;
    }
    return null;
}

/** The components.json the project is initialized with (mirrors the CLI `init` flags). */
function buildInitConfig(args: InitArgs): Config {
    const config: Config = getDefaultConfig();
    config.prefix = args.prefix ?? DEFAULT_PREFIX;
    if (args.baseColor) config.tailwind.baseColor = args.baseColor;
    if (args.theme) config.tailwind.theme = args.theme;
    if (args.cssPath) config.tailwind.css = args.cssPath;
    if (args.registry) config.registry = args.registry;
    return config;
}

async function handleInit(cwd: string, args: InitArgs): Promise<ReturnType<typeof json>> {
    if (await fs.pathExists(path.join(cwd, 'components.json'))) {
        return err('Already initialized — components.json exists. Use add_component to add components.');
    }
    const invalid = validateInitArgs(args);
    if (invalid) return err(invalid);

    const config = buildInitConfig(args);
    // No components.json exists yet, so the only registry source is the args.
    const fetchOptions = await resolveSource(args);
    const result = await initProject({
        cwd, config,
        createShortcutRegistry: args.createShortcutRegistry ?? true,
        fetchOptions,
    });
    const defaults: InitDefaults = {
        density: args.density, radius: args.radius, motion: args.motion,
        themeFrom: args.themeFrom, locale: args.locale,
    };
    try {
        const applied = await applyInitDefaults(cwd, defaults, fetchOptions);
        return json({ ...result, defaultsApplied: applied });
    } catch (error) {
        return json({
            ...result,
            defaultsApplied: [],
            defaultsError: error instanceof Error ? error.message : String(error),
        });
    }
}

function registerInitTool(server: ToolHost, cwd: string): void {
    server.registerTool('init_project', {
        title: 'Initialize project',
        description: 'Set up shadcn-angular in this Angular project (components.json, Tailwind, PostCSS). Uses sensible defaults; all overridable.',
        inputSchema: initInputSchema,
        annotations: { destructiveHint: true },
    }, (args) => handleInit(cwd, args));
}

function registerAddTool(server: ToolHost, cwd: string): void {
    server.registerTool('add_component', {
        title: 'Add components',
        description: 'Install one or more components (writes files, resolves deps, installs npm packages). Conflicts are NOT overwritten unless listed in `overwrite`. Run get_install_plan first.',
        inputSchema: {
            names: z.array(z.string()).min(1),
            overwrite: z.array(z.string()).optional().describe('Component names whose conflicting local files may be overwritten.'),
            optionalDeps: z.array(z.string()).optional(),
            preset: z.string().optional().describe('A named addon bundle declared by one of `names` (see `why` → presets); its addons are installed alongside any optionalDeps.'),
            path: z.string().optional(),
            includeTests: z.boolean().optional().describe('Also install each component\'s unit tests (persists tests.include in components.json).'),
            testRunner: z.enum(['vitest', 'jest']).optional().describe('Runner the installed tests target; auto-detected when omitted.'),
            ...sourceInputSchema,
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        const config = await getConfig(cwd);
        if (!config) return err('Project not initialized — run init_project first.');
        const options = await resolveSource(args, config);
        const invalid = validateNames(args.names);
        if (invalid.length) return err(`Unknown component(s): ${invalid.join(', ')}`);
        let presetAddons: ComponentName[] = [];
        if (args.preset !== undefined) {
            try {
                presetAddons = resolvePreset(args.names, args.preset).addons;
            } catch (error) {
                if (!(error instanceof PresetError)) throw error;
                return err(error.message);
            }
        }
        const tests = await resolveTestInstall(config, { includeTests: args.includeTests, runner: args.testRunner, yes: true }, cwd);
        const result = await performInstall({
            components: args.names as ComponentName[],
            optionalDeps: [...(args.optionalDeps ?? []), ...presetAddons] as ComponentName[],
            overwrite: (args.overwrite ?? []) as ComponentName[],
            cwd, config, options, path: args.path,
            includeTests: tests.includeTests, testRunner: tests.runner,
        });
        return json(result);
    });
}

function registerUpdateTool(server: ToolHost, cwd: string): void {
    server.registerTool('update_component', {
        title: 'Update components',
        description: 'Update components from the registry. By default 3-way MERGES upstream changes into your local edits (conflicts are written as <<<<<<< markers and reported in mergeReport.mergedConflicted); pass overwrite:true to replace your edits whole-file instead. Files with local edits but no recorded merge baseline are KEPT unchanged and listed in mergeReport.fellBack — re-run with overwrite:true to take upstream for those. Mirrors the `update` CLI command.',
        inputSchema: {
            names: z.array(z.string()).min(1),
            overwrite: z.boolean().optional().describe('Replace local edits whole-file instead of 3-way merging.'),
            includeTests: z.boolean().optional().describe('Also refresh each component\'s unit tests (persists tests.include in components.json).'),
            testRunner: z.enum(['vitest', 'jest']).optional().describe('Runner the refreshed tests target; auto-detected when omitted.'),
            ...sourceInputSchema,
        },
        annotations: { destructiveHint: true },
    }, async ({ names, overwrite, includeTests, testRunner, ...source }) => {
        const config = await getConfig(cwd);
        if (!config) return err('Project not initialized — run init_project first.');
        const options = { ...await resolveSource(source, config), overwrite };
        const invalid = validateNames(names);
        if (invalid.length) return err(`Unknown component(s): ${invalid.join(', ')}`);
        const tests = await resolveTestInstall(config, { includeTests, runner: testRunner, yes: true }, cwd);
        const result = await performInstall({
            components: names as ComponentName[],
            overwrite: names as ComponentName[],
            cwd, config, options,
            includeTests: tests.includeTests, testRunner: tests.runner,
        });
        // Reconcile shared lib files too: a component update can introduce a new
        // lib export (e.g. utils.ts `stringifyValue`) that the component's own
        // closure won't refresh, since core lib files belong to no component.
        const lib = await refreshLibCore(cwd, config, options, {});
        // Announce breaking API changes and warn (don't rewrite) about consumer
        // templates still using a renamed selector — the silent NG8113 class.
        const breakingChanges = collectBreakingChanges(names as ComponentName[]);
        const staleSelectors = await scanStaleSelectors(cwd, names as ComponentName[]);
        return json({
            ...result,
            hadConflicts: hasUnresolvedConflicts(result.mergeReport),
            libRefreshed: lib.refreshed,
            libWarnings: lib.warnings,
            breakingChanges,
            staleSelectors,
        });
    });
}

/** Default byte budget for a `full` diff before hunks are omitted (keeps under the token cap). */
const DIFF_FULL_MAX_BYTES = 24_000;

/**
 * Cap a `full` diff response at a byte budget, truncating at FILE boundaries (a
 * file's diff is kept whole or replaced by a marker) — never mid-file, so the
 * 190 KB whole-file dumps the old positional diff produced can't blow the token
 * cap. Mutates `out` in place.
 */
function capFullDiffs(out: ComponentDiff[], maxBytes: number): void {
    let used = 0;
    let truncating = false;
    for (const component of out) {
        for (const file of component.files) {
            if (file.diff === null) continue;
            if (truncating) {
                file.diff = `… omitted (response capped at ${maxBytes} bytes — request this file alone for its hunks)`;
                continue;
            }
            used += file.diff.length;
            if (used > maxBytes) {
                truncating = true;
                file.diff = `… omitted (response capped at ${maxBytes} bytes — request this file alone for its hunks)`;
            }
        }
    }
}

function registerDiffTool(server: ToolHost, cwd: string): void {
    server.registerTool('diff_component', {
        title: 'Diff components',
        description: 'Show how locally installed components differ from the registry version. Defaults to a compact summary of changed public symbols (added/removed inputs, outputs, models, methods); pass mode "full" for unified-diff hunks.',
        inputSchema: {
            names: z.array(z.string()).min(1),
            mode: z.enum(['summary', 'full']).optional().describe('summary (default): changed symbol names only; full: unified-diff hunks.'),
            ...sourceInputSchema,
        },
        annotations: { readOnlyHint: true },
    }, async ({ names, mode, ...source }) => {
        const config = await getConfig(cwd);
        if (!config) return err('Project not initialized — run init_project first.');
        const options = await resolveSource(source, config);
        const invalid = validateNames(names);
        if (invalid.length) return err(`Unknown component(s): ${invalid.join(', ')}`);
        const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
        const resolvedMode = mode ?? 'summary';
        const out: ComponentDiff[] = [];
        for (const name of names as ComponentName[]) {
            out.push(await diffComponentFiles(name, targetDir, options, config.aliases.utils, getPrefix(config), resolvedMode));
        }
        if (resolvedMode === 'full') capFullDiffs(out, DIFF_FULL_MAX_BYTES);
        return json(out);
    });
}

function registerDensityTool(server: ToolHost, cwd: string): void {
    server.registerTool('set_density', {
        title: 'Set density',
        description: 'Set the global density level (1=ultra-compact to 5=spacious). Optionally override specific components.',
        inputSchema: {
            level: z.number().int().min(1).max(5).describe('Density level: 1=ultra-compact, 2=compact, 3=default, 4=comfortable, 5=spacious'),
            components: z.array(z.string()).optional().describe(`Component names to set individually (e.g. ["card", "button"]). Valid: ${Object.keys(COMPONENT_DENSITY_VARS).join(', ')}`),
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        try {
            const message = await setDensityCore(args.level, args.components, cwd);
            return json({ success: true, message });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });
}

function registerRadiusMotionLocaleTool(server: ToolHost, cwd: string): void {
    server.registerTool('set_radius', {
        title: 'Set border radius',
        description: `Set the global border radius (--radius). Named values: ${Object.keys(RADIUS_NAMED).join(', ')}. Also accepts raw values like "0.5rem" or "8px".`,
        inputSchema: { value: z.string().describe('Radius name (none, sm, md, lg, xl, full) or raw CSS value (e.g. "0.5rem", "8px")') },
        annotations: { destructiveHint: true },
    }, async (args) => {
        try {
            return json({ success: true, message: await setRadiusCore(args.value, cwd) });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });

    server.registerTool('set_motion', {
        title: 'Set motion level',
        description: 'Set the global animation/motion multiplier (--motion). 0=no motion, 1=default, 2=expressive.',
        inputSchema: { level: z.number().int().min(0).max(2).describe('Motion level: 0=no motion, 1=default, 2=expressive') },
        annotations: { destructiveHint: true },
    }, async (args) => {
        try {
            return json({ success: true, message: await setMotionCore(args.level, cwd) });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });

    server.registerTool('set_locale', {
        title: 'Set default UI locale',
        description: 'Set the default UI locale baked into the project\'s installed i18n files (rewrites the UI_LOCALE_ID default in i18n/i18n.token.ts). Installs the i18n lib files first if missing.',
        inputSchema: {
            code: z.string().describe('BCP-47 locale code (e.g. "en", "he", "pt-BR")'),
            ...sourceInputSchema,
        },
        annotations: { destructiveHint: true },
    }, async ({ code, ...source }) => {
        try {
            const config = await getConfig(cwd);
            const options = await resolveSource(source, config ?? undefined);
            return json({ success: true, message: await setLocaleCore(code, cwd, options) });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });
}

function registerTestRunnerTool(server: ToolHost, cwd: string): void {
    server.registerTool('set_test_runner', {
        title: 'Switch test runner',
        description: 'Switch the project\'s installed component tests between vitest and jest: rewrites each spec\'s import in place (no re-fetch, local spec edits preserved), installs or removes the vitest-compat shim, and persists tests.runner in components.json. Pass dryRun to preview.',
        inputSchema: {
            runner: z.enum(['vitest', 'jest']).describe('Target test runner.'),
            dryRun: z.boolean().optional().describe('Report what would change without writing.'),
            ...sourceInputSchema,
        },
        annotations: { destructiveHint: true },
    }, async ({ runner, dryRun, ...source }) => {
        try {
            const config = await getConfig(cwd);
            const options = { ...await resolveSource(source, config ?? undefined), dryRun };
            return json(await setTestRunnerCore(runner, cwd, options));
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });
}

function registerThemeTool(server: ToolHost, cwd: string): void {
    server.registerTool('change_theme', {
        title: 'Change color theme',
        description: `Change the color theme (replaces color CSS vars in :root and .dark). Available themes: ${VALID_THEMES.join(', ')}. Alternatively pass "from" with a brand hex color to generate a custom theme.`,
        inputSchema: {
            name: z.enum(VALID_THEMES).optional().describe('Preset theme name'),
            from: z.string().optional().describe('Brand hex color (e.g. "#3b82f6") to generate the theme from — mutually exclusive with name'),
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        try {
            const message = await changeThemeCore(args.name ?? null, cwd, { from: args.from });
            return json({ success: true, message });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });
}

function registerDoctorTool(server: ToolHost, cwd: string): void {
    server.registerTool('doctor_fix', {
        title: 'Doctor fix',
        description: 'Diagnose component health and repair what is safe to repair: re-install components with missing files or stale registry versions, and install missing npm dependencies. User-edited components are never touched; legacy layouts require the migrate command.',
        inputSchema: {
            dryRun: z.boolean().optional().describe('Return the repair plan without making changes'),
            ...sourceInputSchema,
        },
        annotations: { destructiveHint: true },
    }, async ({ dryRun, ...source }) => {
        try {
            const config = await getConfig(cwd);
            if (!config) return err('Project not initialized — run init_project first.');
            const options = await resolveSource(source, config);
            const report = await collectDoctorReport(cwd, config, options);
            const plan = buildFixPlan(report);
            // Announce breaking API changes for the components doctor will reinstall —
            // doctor_fix is the primary upgrade path, so these must surface here, not
            // only via update_component (report B4). Stale-selector usages too.
            const breakingChanges = collectBreakingChanges(plan.reinstall);
            if (dryRun || report.ok) {
                return json({ ok: report.ok, plan, actions: [], breakingChanges });
            }
            const actions = await doctorFixCore(cwd, config, options, plan);
            const after = await collectDoctorReport(cwd, config, options);
            const staleSelectors = await scanStaleSelectors(cwd, plan.reinstall);
            return json({ ok: after.ok, plan, actions, remaining: after, breakingChanges, staleSelectors });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });
}

function registerApplyAddonTool(server: ToolHost, cwd: string): void {
    server.registerTool('apply_addon', {
        title: 'Apply an addon',
        description: 'Install an addon (and its base if missing) and wire it into your app non-interactively: adds the directive import + the attribute on the base component\'s usage. Target by component class name(s), or omit to wire every app-code usage. Returns per-target wiring counts and a paste snippet for anything it could not auto-wire. If the base had local edits it is 3-way merged; check hadConflicts / mergeReport.mergedConflicted for files written with <<<<<<< conflict markers before reporting success.',
        inputSchema: {
            addon: z.string().describe('Addon key, e.g. "data-table/context-menu".'),
            components: z.array(z.string()).optional().describe('Component class name(s) to wire into (e.g. ["UsersTableComponent"]). Omit to scan all app-code usages.'),
            all: z.boolean().optional().describe('Wire every matching tag instance in each target.'),
            class: z.string().optional().describe('Only wire instances carrying this CSS class token.'),
            id: z.string().optional().describe('Only wire the instance with this template ref / id / data-testid.'),
            dryRun: z.boolean().optional().describe('Report what would be wired without writing or installing.'),
            ...sourceInputSchema,
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        const config = await getConfig(cwd);
        // Resolve the addon against the manifest of the branch/fork it comes from.
        const source = await resolveSource(args, config ?? undefined);
        try {
            resolveAddonInfo(args.addon, 'src/components/ui');
        } catch (e) {
            if (e instanceof ApplyError) return err(e.message);
            throw e;
        }
        if (!config) return err('Project not initialized — run init_project first.');
        try {
            const options = {
                ...source, yes: true,
                all: args.all, class: args.class, id: args.id, dryRun: args.dryRun,
            };
            const result = await applyCore(args.addon, args.components ?? [], options, cwd, config);
            return json({ ...result, hadConflicts: hasUnresolvedConflicts(result.mergeReport) });
        } catch (error) {
            if (error instanceof ApplyError) return err(error.message);
            return err(error instanceof Error ? error.message : String(error));
        }
    });
}

function registerRefreshLibTool(server: ToolHost, cwd: string): void {
    server.registerTool('refresh_lib', {
        title: 'Refresh shared lib files',
        description: 'Reconcile shared lib/ files (utils.ts, i18n, parsers, tokens, etc.) with the registry. By default refreshes only files that are pristine-but-stale or missing (e.g. a utils.ts behind a new export an upgraded component imports); lib files you customized are protected unless force is set. Pass dryRun to preview.',
        inputSchema: {
            files: z.array(z.string()).optional().describe('Specific lib file paths to refresh (e.g. ["utils.ts"]). Default: all required by installed components plus the core set.'),
            force: z.boolean().optional().describe('Also overwrite lib files you customized (normally protected).'),
            dryRun: z.boolean().optional().describe('Return the target set without writing.'),
            ...sourceInputSchema,
        },
        annotations: { destructiveHint: true },
    }, async ({ files, force, dryRun, ...source }) => {
        try {
            const config = await getConfig(cwd);
            if (!config) return err('Project not initialized — run init_project first.');
            const options = await resolveSource(source, config);
            const result = await refreshLibCore(cwd, config, options, { files, force, dryRun });
            return json(result);
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });
}

function registerMigrateTool(server: ToolHost, cwd: string): void {
    server.registerTool('migrate', {
        title: 'Migrate legacy components',
        description: 'Migrate legacy single-file components to the folder/trio layout: converts each pristine legacy component, refreshes the dependency closure, deletes the old flat files and re-points project imports. Components you customized are NEVER touched (returned in plan.customized), and pristine ones depending on them are deferred (plan.blocked). Refuses on a dirty/absent git working tree (status "unclean-tree") unless force is set — the git diff is the only rollback. Pass dryRun to preview the plan. Mirrors the `migrate` CLI command.',
        inputSchema: {
            dryRun: z.boolean().optional().describe('Return the migration plan without writing.'),
            force: z.boolean().optional().describe('Proceed even when the git working tree is dirty / not a repo (no rollback safety net).'),
            ...sourceInputSchema,
        },
        annotations: { destructiveHint: true },
    }, async ({ dryRun, force, ...source }) => {
        try {
            const config = await getConfig(cwd);
            if (!config) return err('Project not initialized — run init_project first.');
            const options = { ...await resolveSource(source, config), dryRun, force };
            const outcome = await migrateCore(cwd, config, options);
            return json(outcome);
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });
}

export function registerWriteTools(server: ToolHost, cwd: string): void {
    registerInitTool(server, cwd);
    registerAddTool(server, cwd);
    registerUpdateTool(server, cwd);
    registerDiffTool(server, cwd);
    registerDensityTool(server, cwd);
    registerRadiusMotionLocaleTool(server, cwd);
    registerTestRunnerTool(server, cwd);
    registerThemeTool(server, cwd);
    registerDoctorTool(server, cwd);
    registerRefreshLibTool(server, cwd);
    registerMigrateTool(server, cwd);
    registerApplyAddonTool(server, cwd);
}
