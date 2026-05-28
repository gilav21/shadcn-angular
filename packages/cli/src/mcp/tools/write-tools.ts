import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'fs-extra';
import path from 'node:path';
import { isComponentName, type ComponentName } from '../../registry/index.js';
import { performInstall } from '../../core/install.js';
import { initProject } from '../../core/init-core.js';
import { diffComponentFiles, type ComponentDiff } from '../../core/diff-core.js';
import { getConfig, getDefaultConfig, type Config } from '../../utils/config.js';
import { aliasToProjectPath, resolveProjectPath } from '../../utils/paths.js';
import { isValidPrefix, DEFAULT_PREFIX } from '../../utils/prefix.js';
import { json, err } from './result.js';

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
        },
        annotations: { destructiveHint: true },
    }, async (args) => {
        if (await fs.pathExists(path.join(cwd, 'components.json'))) {
            return err('Already initialized — components.json exists. Use add_component to add components.');
        }
        if (args.prefix !== undefined && !isValidPrefix(args.prefix)) {
            return err(`Invalid prefix "${args.prefix}" — must be lowercase kebab-case starting with a letter.`);
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
        return json(result);
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
            out.push(await diffComponentFiles(name, targetDir, { branch: 'master' }, config.aliases.utils));
        }
        return json(out);
    });
}
