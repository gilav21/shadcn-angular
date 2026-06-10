import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'fs-extra';
import path from 'node:path';
import { isComponentName, type ComponentName } from '../../registry/index.js';
import { performInstall } from '../../core/install.js';
import { initProject } from '../../core/init-core.js';
import { diffComponentFiles, type ComponentDiff } from '../../core/diff-core.js';
import { getConfig, getDefaultConfig, getPrefix, type Config } from '../../utils/config.js';
import { aliasToProjectPath, resolveProjectPath } from '../../utils/paths.js';
import { isValidPrefix, DEFAULT_PREFIX } from '../../utils/prefix.js';
import { json, err } from './result.js';
import { setDensityCore, COMPONENT_DENSITY_VARS } from '../../commands/set-density.js';
import { setRadiusCore, RADIUS_NAMED } from '../../commands/set-radius.js';
import { setMotionCore } from '../../commands/set-motion.js';
import { changeThemeCore, VALID_THEMES } from '../../commands/change-theme.js';
import { setLocaleCore } from '../../commands/set-locale.js';
import { applyInitDefaults, type InitDefaults } from '../../commands/init.js';
import { isValidHex } from '../../utils/color.js';
import { collectDoctorReport, buildFixPlan, doctorFixCore } from '../../commands/doctor.js';
import type { ThemeColor } from '../../templates/styles.js';

function validateNames(names: string[]): string[] {
    return names.filter(n => !isComponentName(n));
}

export function registerWriteTools(server: McpServer, cwd: string): void {
    server.registerTool('init_project', {
        title: 'Initialize project',
        description: 'Set up shadcn-angular in this Angular project (components.json, Tailwind, PostCSS). Uses sensible defaults; all overridable.',
        inputSchema: {
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
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        if (await fs.pathExists(path.join(cwd, 'components.json'))) {
            return err('Already initialized — components.json exists. Use add_component to add components.');
        }
        if (args.prefix !== undefined && !isValidPrefix(args.prefix)) {
            return err(`Invalid prefix "${args.prefix}" — must be lowercase kebab-case starting with a letter.`);
        }
        if (args.theme && args.themeFrom) {
            return err('Pass either theme or themeFrom, not both.');
        }
        if (args.themeFrom !== undefined && !isValidHex(args.themeFrom)) {
            return err(`Invalid themeFrom "${args.themeFrom}" — use a hex color like "#3b82f6".`);
        }
        const config: Config = getDefaultConfig();
        config.prefix = args.prefix ?? DEFAULT_PREFIX;
        if (args.baseColor) config.tailwind.baseColor = args.baseColor;
        if (args.theme) config.tailwind.theme = args.theme;
        if (args.cssPath) config.tailwind.css = args.cssPath;
        const result = await initProject({
            cwd, config,
            createShortcutRegistry: args.createShortcutRegistry ?? true,
            fetchOptions: { branch: 'master' },
        });
        const defaults: InitDefaults = {
            density: args.density, radius: args.radius, motion: args.motion,
            themeFrom: args.themeFrom, locale: args.locale,
        };
        try {
            const applied = await applyInitDefaults(cwd, defaults, { branch: 'master' });
            return json({ ...result, defaultsApplied: applied });
        } catch (error) {
            return json({
                ...result,
                defaultsApplied: [],
                defaultsError: error instanceof Error ? error.message : String(error),
            });
        }
    });

    server.registerTool('add_component', {
        title: 'Add components',
        description: 'Install one or more components (writes files, resolves deps, installs npm packages). Conflicts are NOT overwritten unless listed in `overwrite`. Run get_install_plan first.',
        inputSchema: {
            names: z.array(z.string()).min(1),
            overwrite: z.array(z.string()).optional().describe('Component names whose conflicting local files may be overwritten.'),
            optionalDeps: z.array(z.string()).optional(),
            path: z.string().optional(),
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        const invalid = validateNames(args.names);
        if (invalid.length) return err(`Unknown component(s): ${invalid.join(', ')}`);
        const config = await getConfig(cwd);
        if (!config) return err('Project not initialized — run init_project first.');
        const result = await performInstall({
            components: args.names as ComponentName[],
            optionalDeps: (args.optionalDeps ?? []) as ComponentName[],
            overwrite: (args.overwrite ?? []) as ComponentName[],
            cwd, config, options: { branch: 'master' }, path: args.path,
        });
        return json(result);
    });

    server.registerTool('update_component', {
        title: 'Update components',
        description: 'Re-install components from the registry, overwriting local copies. Equivalent to add_component with overwrite for the given names.',
        inputSchema: { names: z.array(z.string()).min(1) },
        annotations: { destructiveHint: true },
    }, async ({ names }) => {
        const invalid = validateNames(names);
        if (invalid.length) return err(`Unknown component(s): ${invalid.join(', ')}`);
        const config = await getConfig(cwd);
        if (!config) return err('Project not initialized — run init_project first.');
        const result = await performInstall({
            components: names as ComponentName[],
            overwrite: names as ComponentName[],
            cwd, config, options: { branch: 'master', overwrite: true },
        });
        return json(result);
    });

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

    server.registerTool('set_radius', {
        title: 'Set border radius',
        description: `Set the global border radius (--radius). Named values: ${Object.keys(RADIUS_NAMED).join(', ')}. Also accepts raw values like "0.5rem" or "8px".`,
        inputSchema: {
            value: z.string().describe('Radius name (none, sm, md, lg, xl, full) or raw CSS value (e.g. "0.5rem", "8px")'),
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        try {
            const message = await setRadiusCore(args.value, cwd);
            return json({ success: true, message });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });

    server.registerTool('set_motion', {
        title: 'Set motion level',
        description: 'Set the global animation/motion multiplier (--motion). 0=no motion, 1=default, 2=expressive.',
        inputSchema: {
            level: z.number().int().min(0).max(2).describe('Motion level: 0=no motion, 1=default, 2=expressive'),
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        try {
            const message = await setMotionCore(args.level, cwd);
            return json({ success: true, message });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });

    server.registerTool('set_locale', {
        title: 'Set default UI locale',
        description: 'Set the default UI locale baked into the project\'s installed i18n files (rewrites the UI_LOCALE_ID default in i18n/i18n.token.ts). Installs the i18n lib files first if missing.',
        inputSchema: {
            code: z.string().describe('BCP-47 locale code (e.g. "en", "he", "pt-BR")'),
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        try {
            const message = await setLocaleCore(args.code, cwd, { branch: 'master' });
            return json({ success: true, message });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });

    server.registerTool('change_theme', {
        title: 'Change color theme',
        description: `Change the color theme (replaces color CSS vars in :root and .dark). Available themes: ${VALID_THEMES.join(', ')}. Alternatively pass "from" with a brand hex color to generate a custom theme.`,
        inputSchema: {
            name: z.enum(VALID_THEMES as [ThemeColor, ...ThemeColor[]]).optional().describe('Preset theme name'),
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

    server.registerTool('doctor_fix', {
        title: 'Doctor fix',
        description: 'Diagnose component health and repair what is safe to repair: re-install components with missing files or stale registry versions, and install missing npm dependencies. User-edited components are never touched; legacy layouts require the migrate command.',
        inputSchema: {
            dryRun: z.boolean().optional().describe('Return the repair plan without making changes'),
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        try {
            const config = await getConfig(cwd);
            if (!config) return err('Project not initialized — run init_project first.');
            const options = { branch: 'master', registry: config.registry };
            const report = await collectDoctorReport(cwd, config, options);
            const plan = buildFixPlan(report);
            if (args.dryRun || report.ok) {
                return json({ ok: report.ok, plan, actions: [] });
            }
            const actions = await doctorFixCore(cwd, config, options, plan);
            const after = await collectDoctorReport(cwd, config, options);
            return json({ ok: after.ok, plan, actions, remaining: after });
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });

    server.registerTool('diff_component', {
        title: 'Diff components',
        description: 'Show how locally installed components differ from the registry version.',
        inputSchema: { names: z.array(z.string()).min(1) },
        annotations: { readOnlyHint: true },
    }, async ({ names }) => {
        const invalid = validateNames(names);
        if (invalid.length) return err(`Unknown component(s): ${invalid.join(', ')}`);
        const config = await getConfig(cwd);
        if (!config) return err('Project not initialized — run init_project first.');
        const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
        const out: ComponentDiff[] = [];
        for (const name of names as ComponentName[]) {
            out.push(await diffComponentFiles(name, targetDir, { branch: 'master' }, config.aliases.utils, getPrefix(config)));
        }
        return json(out);
    });
}
