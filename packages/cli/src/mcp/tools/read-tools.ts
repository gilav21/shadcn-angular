import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'fs-extra';
import path from 'node:path';
import { registry, getComponentNames, isComponentName, type ComponentName } from '../../registry/index.js';
import { resolveDependencies } from '../../core/resolve.js';
import { fetchAndTransform } from '../../core/fetch.js';
import { planInstall } from '../../core/install.js';
import { searchComponents } from '../../core/search.js';
import { statusCore } from '../../commands/status.js';
import { getConfig, getDefaultConfig, getPrefix } from '../../utils/config.js';
import { getLocalComponentsDir } from '../../utils/paths.js';
import { json, err } from './result.js';

function registerSearchTools(server: McpServer): void {
    server.registerTool('list_components', {
        title: 'List components',
        description: 'List every available shadcn-angular component with its category, description and tags.',
        inputSchema: {},
        annotations: { readOnlyHint: true },
    }, async () => json(
        getComponentNames().map(name => {
            const d = registry[name];
            return { name, type: d.type ?? 'component', category: d.category, description: d.description, tags: d.tags };
        }),
    ));

    server.registerTool('search_components', {
        title: 'Search components',
        description: 'Fuzzy-search components by name, tags, or description. Returns ranked matches.',
        inputSchema: { query: z.string().describe('Search term, e.g. "date" or "dropdown".') },
        annotations: { readOnlyHint: true },
    }, async ({ query }) => json(searchComponents(query)));

    server.registerTool('get_component', {
        title: 'Get component',
        description: "Get a component's registry record with resolved transitive dependencies and npm deps.",
        inputSchema: { name: z.string().describe('Component name, e.g. "data-table".') },
        annotations: { readOnlyHint: true },
    }, async ({ name }) => {
        if (!isComponentName(name)) return err(`Unknown component: ${name}`);
        const def = registry[name];
        const resolved = [...resolveDependencies([name])];
        const npm = new Set<string>();
        for (const c of resolved) for (const d of registry[c].npmDependencies ?? []) npm.add(d);
        return json({
            name,
            type: def.type ?? 'component',
            category: def.category,
            description: def.description,
            tags: def.tags,
            files: def.files,
            libFiles: def.libFiles ?? [],
            directDependencies: def.dependencies ?? [],
            resolvedDependencies: resolved,
            npmDependencies: [...npm],
        });
    });
}

function registerDetailTools(server: McpServer, cwd: string): void {
    server.registerTool('get_component_source', {
        title: 'Get component source',
        description: 'Fetch the source of every file in a component, with import/prefix transforms applied to the local project config.',
        inputSchema: { name: z.string() },
        annotations: { readOnlyHint: true },
    }, async ({ name }) => {
        if (!isComponentName(name)) return err(`Unknown component: ${name}`);
        const config = (await getConfig(cwd)) ?? getDefaultConfig();
        const prefix = getPrefix(config);
        const files: Record<string, string> = {};
        for (const file of registry[name].files) {
            files[file] = await fetchAndTransform(file, { branch: 'master' }, config.aliases.utils, prefix);
        }
        return json({ name, files });
    });

    server.registerTool('get_component_examples', {
        title: 'Get component examples',
        description: "Return the component's Storybook stories source, which demonstrates every variant and input.",
        inputSchema: { name: z.string() },
        annotations: { readOnlyHint: true },
    }, async ({ name }) => {
        if (!isComponentName(name)) return err(`Unknown component: ${name}`);
        const storyFile = findStoryFile(name);
        const localDir = getLocalComponentsDir();
        if (localDir) {
            const p = path.join(localDir, storyFile);
            if (await fs.pathExists(p)) {
                return json({ name, file: storyFile, source: await fs.readFile(p, 'utf-8') });
            }
        }
        const config = (await getConfig(cwd)) ?? getDefaultConfig();
        try {
            const src = await fetchAndTransform(storyFile, { branch: 'master' }, config.aliases.utils, getPrefix(config));
            return json({ name, file: storyFile, source: src });
        } catch {
            return err(`No examples found for ${name}.`);
        }
    });
}

function registerStatusTools(server: McpServer, cwd: string): void {
    server.registerTool('get_project_status', {
        title: 'Get project status',
        description: 'Read-only project dashboard: design tokens (density/radius/motion/theme), per-component health, and config.',
        inputSchema: {},
        annotations: { readOnlyHint: true },
    }, async () => {
        try {
            return json(await statusCore(cwd, { branch: 'master' }));
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });

    server.registerTool('get_install_plan', {
        title: 'Get install plan',
        description: 'Dry-run an install: which files would be written/skipped/conflict, plus npm deps. Call before add_component.',
        inputSchema: { names: z.array(z.string()).min(1).describe('Component names to plan.') },
        annotations: { readOnlyHint: true },
    }, async ({ names }) => {
        const invalid = names.filter(n => !isComponentName(n));
        if (invalid.length) return err(`Unknown component(s): ${invalid.join(', ')}`);
        const config = await getConfig(cwd);
        if (!config) return err('Project not initialized — run init_project first.');
        const plan = await planInstall({ components: names as ComponentName[], cwd, config, options: { branch: 'master' } });
        return json(plan);
    });
}

export function registerReadTools(server: McpServer, cwd: string): void {
    registerSearchTools(server);
    registerDetailTools(server, cwd);
    registerStatusTools(server, cwd);
}

/** Locate a component's stories file: prefer one declared in `files`, else infer. */
function findStoryFile(name: ComponentName): string {
    const declared = registry[name].files.find(f => f.endsWith('.stories.ts'));
    return declared ?? `${name}/${name}.stories.ts`;
}
