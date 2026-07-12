import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'fs-extra';
import path from 'node:path';
import { registry, getComponentNames, isComponentName, suggestComponentName, type ComponentName } from '../../registry/index.js';
import { fetchAndTransform } from '../../core/fetch.js';
import { planInstall } from '../../core/install.js';
import { searchComponents } from '../../core/search.js';
import { buildComponentRecord } from '../../core/why-core.js';
import { statusCore } from '../../commands/status.js';
import { getConfig, getDefaultConfig, getPrefix } from '../../utils/config.js';
import { getLocalComponentsDir } from '../../utils/paths.js';
import { json, err } from './result.js';
import { sourceInputSchema, resolveSource } from './options.js';

function registerSearchTools(server: McpServer): void {
    server.registerTool('list_components', {
        title: 'List components',
        description: 'List every available shadcn-angular component with its category, description and tags.',
        inputSchema: { ...sourceInputSchema },
        annotations: { readOnlyHint: true },
    }, async (source) => {
        await resolveSource(source);
        return json(
            getComponentNames().map(name => {
                const d = registry[name];
                return { name, type: d.type ?? 'component', category: d.category, description: d.description, tags: d.tags };
            }),
        );
    });

    server.registerTool('search_components', {
        title: 'Search components',
        description: 'Fuzzy-search components by name, tags, or description. Returns ranked matches.',
        inputSchema: { query: z.string().describe('Search term, e.g. "date" or "dropdown".'), ...sourceInputSchema },
        annotations: { readOnlyHint: true },
    }, async ({ query, ...source }) => {
        await resolveSource(source);
        return json(searchComponents(query));
    });

    server.registerTool('get_component', {
        title: 'Get component',
        description: "Get a component's registry record: files, direct + resolved transitive dependencies, npm deps, addons, and the components that depend on it (reverseDependents).",
        inputSchema: { name: z.string().describe('Component name, e.g. "data-table".'), ...sourceInputSchema },
        annotations: { readOnlyHint: true },
    }, async ({ name, ...source }) => {
        await resolveSource(source);
        if (!isComponentName(name)) return err(`Unknown component: ${name}`);
        return json(buildComponentRecord(name));
    });

}

function registerWhyTool(server: McpServer): void {
    server.registerTool('why', {
        title: 'Why (registry introspection)',
        description: "Explain what component(s) are made of and what depends on them: files, libFiles, peerFiles, direct dependencies, and the transitive reverse-dependents — the blast radius of changing or removing it. Mirrors the `why` CLI command.",
        inputSchema: {
            names: z.array(z.string()).min(1).describe('One or more component names, e.g. ["button"].'),
            ...sourceInputSchema,
        },
        annotations: { readOnlyHint: true },
    }, async ({ names, ...source }) => {
        await resolveSource(source);
        const invalid = names.filter(n => !isComponentName(n));
        if (invalid.length) {
            const hints = invalid.map(n => {
                const suggestion = suggestComponentName(n);
                return suggestion ? `${n} (did you mean ${suggestion}?)` : n;
            });
            return err(`Unknown component(s): ${hints.join(', ')}`);
        }
        return json((names as ComponentName[]).map(buildComponentRecord));
    });
}

function registerDetailTools(server: McpServer, cwd: string): void {
    server.registerTool('get_component_source', {
        title: 'Get component source',
        description: 'Fetch the source of every file in a component, with import/prefix transforms applied to the local project config.',
        inputSchema: { name: z.string(), ...sourceInputSchema },
        annotations: { readOnlyHint: true },
    }, async ({ name, ...source }) => {
        const config = (await getConfig(cwd)) ?? getDefaultConfig();
        const options = await resolveSource(source, config);
        if (!isComponentName(name)) return err(`Unknown component: ${name}`);
        const prefix = getPrefix(config);
        const files: Record<string, string> = {};
        for (const file of registry[name].files) {
            files[file] = await fetchAndTransform(file, options, config.aliases.utils, prefix);
        }
        return json({ name, files });
    });

    server.registerTool('get_component_examples', {
        title: 'Get component examples',
        description: "Return the component's Storybook stories source, which demonstrates every variant and input.",
        inputSchema: { name: z.string(), ...sourceInputSchema },
        annotations: { readOnlyHint: true },
    }, async ({ name, ...source }) => {
        const config = (await getConfig(cwd)) ?? getDefaultConfig();
        const options = await resolveSource(source, config);
        if (!isComponentName(name)) return err(`Unknown component: ${name}`);
        const storyFile = findStoryFile(name);
        const localDir = getLocalComponentsDir();
        if (localDir && !source.remote) {
            const p = path.join(localDir, storyFile);
            if (await fs.pathExists(p)) {
                return json({ name, file: storyFile, source: await fs.readFile(p, 'utf-8') });
            }
        }
        try {
            const src = await fetchAndTransform(
                storyFile, options, config.aliases.utils, getPrefix(config),
            );
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
        inputSchema: { ...sourceInputSchema },
        annotations: { readOnlyHint: true },
    }, async (source) => {
        try {
            const config = await getConfig(cwd);
            return json(await statusCore(cwd, await resolveSource(source, config ?? undefined)));
        } catch (error) {
            return err(error instanceof Error ? error.message : String(error));
        }
    });

    server.registerTool('get_install_plan', {
        title: 'Get install plan',
        description: 'Dry-run an install: which files would be written/skipped/conflict, plus npm deps. Call before add_component.',
        inputSchema: {
            names: z.array(z.string()).min(1).describe('Component names to plan.'),
            ...sourceInputSchema,
        },
        annotations: { readOnlyHint: true },
    }, async ({ names, ...source }) => {
        const config = await getConfig(cwd);
        if (!config) return err('Project not initialized — run init_project first.');
        const options = await resolveSource(source, config);
        const invalid = names.filter(n => !isComponentName(n));
        if (invalid.length) return err(`Unknown component(s): ${invalid.join(', ')}`);
        const plan = await planInstall({
            components: names as ComponentName[], cwd, config, options,
        });
        return json(plan);
    });
}

export function registerReadTools(server: McpServer, cwd: string): void {
    registerSearchTools(server);
    registerWhyTool(server);
    registerDetailTools(server, cwd);
    registerStatusTools(server, cwd);
}

/** Locate a component's stories file: prefer one declared in `files`, else infer. */
function findStoryFile(name: ComponentName): string {
    const declared = registry[name].files.find(f => f.endsWith('.stories.ts'));
    return declared ?? `${name}/${name}.stories.ts`;
}
