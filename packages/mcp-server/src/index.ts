#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v4';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRegistry,
  resolveTransitiveDependencies,
  type RegistryItem,
} from './registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getComponentsUiDir(): string {
  // From dist/index.js -> ../../components/ui
  const fromDist = path.resolve(__dirname, '../../components/ui');
  if (fs.existsSync(fromDist)) return fromDist;
  // From src/index.ts -> ../../components/ui
  const fromSrc = path.resolve(__dirname, '../../components/ui');
  if (fs.existsSync(fromSrc)) return fromSrc;
  throw new Error('Could not locate packages/components/ui directory');
}

function getComponentsLibDir(): string {
  const fromDist = path.resolve(__dirname, '../../components/lib');
  if (fs.existsSync(fromDist)) return fromDist;
  throw new Error('Could not locate packages/components/lib directory');
}

// ---------------------------------------------------------------------------
// Load the registry dynamically from the CLI package
// ---------------------------------------------------------------------------
async function loadRawRegistry(): Promise<Record<string, any>> {
  // Try to import the compiled registry from the CLI package
  const cliRegistryPath = path.resolve(__dirname, '../../cli/dist/registry/index.js');
  if (fs.existsSync(cliRegistryPath)) {
    const mod = await import(cliRegistryPath);
    return mod.registry;
  }
  // Fallback: read registry source and extract via eval-free approach
  // We'll parse the registry source file directly
  const registrySrcPath = path.resolve(__dirname, '../../cli/src/registry/index.ts');
  if (fs.existsSync(registrySrcPath)) {
    return parseRegistryFromSource(registrySrcPath);
  }
  throw new Error('Could not locate component registry');
}

function parseRegistryFromSource(filePath: string): Record<string, any> {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract the registry object literal from source using a simple approach:
  // Find "export const registry" and parse the object
  const match = content.match(/export\s+const\s+registry[^=]*=\s*(\{[\s\S]*\});?\s*$/m);
  if (!match) {
    throw new Error('Could not parse registry from source file');
  }

  // Use Function constructor to evaluate the object literal safely
  // This is safe because we control the source file
  const fn = new Function(`return ${match[1]}`);
  return fn();
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------
const server = new McpServer(
  {
    name: 'shadcn-angular',
    version: '0.0.1',
  },
  {
    instructions: [
      'This MCP server provides access to the shadcn-angular component library.',
      'It exposes tools to list, search, and read the source code of all UI components,',
      'directives, and services. It also provides CLI actions for initializing projects',
      'and adding components.',
      '',
      'Recommended workflow:',
      '1. Use list_items to discover available components and their dependencies',
      '2. Use get_item_source to read the full source code of any component',
      '3. Use get_dependency_tree to understand transitive dependencies before adding',
      '4. Use cli_add to add components to an Angular project',
    ].join('\n'),
  },
);

let registryMap: Map<string, RegistryItem>;
let uiDir: string;
let libDir: string;

async function ensureInitialized(): Promise<void> {
  if (registryMap) return;
  const raw = await loadRawRegistry();
  registryMap = buildRegistry(raw);
  uiDir = getComponentsUiDir();
  libDir = getComponentsLibDir();
}

// ---------------------------------------------------------------------------
// Tool: list_items
// ---------------------------------------------------------------------------
server.registerTool(
  'list_items',
  {
    title: 'List Components',
    description: [
      'Lists all available shadcn-angular registry items (components, directives, services).',
      'Returns each item\'s name, type, category, files, direct dependencies, and npm dependencies.',
      'Use the optional filters to narrow results by type or category.',
      'The dependency information tells you which other items you should investigate with get_item_source.',
    ].join(' '),
    inputSchema: {
      type: z
        .enum(['component', 'directive', 'service', 'pipe', 'types', 'utility'])
        .optional()
        .describe('Filter by item type'),
      category: z
        .string()
        .optional()
        .describe(
          'Filter by category. Available: forms, layout, overlay, feedback, data-display, actions, ai, editors, charts, data-table, page-builder, directives, general',
        ),
      name_contains: z
        .string()
        .optional()
        .describe('Filter items whose name contains this substring (case-insensitive)'),
    },
  },
  async (args) => {
    await ensureInitialized();

    let items = Array.from(registryMap.values());

    if (args.type) {
      items = items.filter((i) => i.type === args.type);
    }
    if (args.category) {
      items = items.filter((i) => i.category === args.category);
    }
    if (args.name_contains) {
      const search = args.name_contains.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(search));
    }

    const result = items.map((item) => ({
      name: item.name,
      type: item.type,
      category: item.category,
      files: item.files,
      dependencies: item.dependencies ?? [],
      npmDependencies: item.npmDependencies ?? [],
    }));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_item_source
// ---------------------------------------------------------------------------
server.registerTool(
  'get_item_source',
  {
    title: 'Get Item Source Code',
    description: [
      'Returns the full source code of a shadcn-angular registry item.',
      'Provide the item name (e.g. "button", "data-table", "confetti").',
      'All files belonging to the item are returned with their paths and content.',
      'Also returns the item\'s direct dependencies so you know what else to fetch.',
    ].join(' '),
    inputSchema: {
      name: z.string().describe('The registry item name (e.g. "button", "dialog", "input-mask")'),
    },
  },
  async ({ name }) => {
    await ensureInitialized();

    const item = registryMap.get(name);
    if (!item) {
      const available = Array.from(registryMap.keys()).join(', ');
      return {
        content: [
          {
            type: 'text' as const,
            text: `Item "${name}" not found. Available items: ${available}`,
          },
        ],
        isError: true,
      };
    }

    const files: { path: string; content: string }[] = [];
    for (const file of item.files) {
      const filePath = path.join(uiDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        files.push({ path: file, content });
      } catch {
        files.push({ path: file, content: `[ERROR: Could not read file at ${filePath}]` });
      }
    }

    const header = [
      `# ${item.name}`,
      `Type: ${item.type}`,
      `Category: ${item.category}`,
      `Files: ${item.files.join(', ')}`,
    ];
    if (item.dependencies?.length) {
      header.push(`Dependencies: ${item.dependencies.join(', ')}`);
    }
    if (item.npmDependencies?.length) {
      header.push(`NPM Dependencies: ${item.npmDependencies.join(', ')}`);
    }

    const sections = files.map(
      (f) => `\n--- ${f.path} ---\n${f.content}`,
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: header.join('\n') + '\n' + sections.join('\n'),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_dependency_tree
// ---------------------------------------------------------------------------
server.registerTool(
  'get_dependency_tree',
  {
    title: 'Get Dependency Tree',
    description: [
      'Returns the full transitive dependency tree for a registry item.',
      'Shows direct and indirect dependencies with their types, categories, and files.',
      'Use this before adding a component to understand everything that will be installed.',
    ].join(' '),
    inputSchema: {
      name: z.string().describe('The registry item name'),
    },
  },
  async ({ name }) => {
    await ensureInitialized();

    const item = registryMap.get(name);
    if (!item) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Item "${name}" not found.`,
          },
        ],
        isError: true,
      };
    }

    const transitiveDeps = resolveTransitiveDependencies(name, registryMap);

    const directDeps = item.dependencies ?? [];

    const tree = {
      name: item.name,
      type: item.type,
      category: item.category,
      files: item.files,
      directDependencies: directDeps.map((dep) => {
        const depItem = registryMap.get(dep);
        return {
          name: dep,
          type: depItem?.type ?? 'unknown',
          category: depItem?.category ?? 'unknown',
          files: depItem?.files ?? [],
        };
      }),
      allTransitiveDependencies: transitiveDeps.map((dep) => {
        const depItem = registryMap.get(dep);
        return {
          name: dep,
          type: depItem?.type ?? 'unknown',
          category: depItem?.category ?? 'unknown',
          files: depItem?.files ?? [],
          dependencies: depItem?.dependencies ?? [],
        };
      }),
      totalItemCount: 1 + transitiveDeps.length,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(tree, null, 2),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_lib_source
// ---------------------------------------------------------------------------
server.registerTool(
  'get_lib_source',
  {
    title: 'Get Library Utility Source',
    description: [
      'Returns the source code of shared library files (utils.ts, shortcut-binding.service.ts).',
      'These are the foundational utilities used by all components.',
    ].join(' '),
    inputSchema: {
      file: z
        .enum(['utils.ts', 'shortcut-binding.service.ts'])
        .describe('The library file to read'),
    },
  },
  async ({ file }) => {
    await ensureInitialized();

    const filePath = path.join(libDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        content: [
          {
            type: 'text' as const,
            text: `--- ${file} ---\n${content}`,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Could not read ${file}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: search_components
// ---------------------------------------------------------------------------
server.registerTool(
  'search_components',
  {
    title: 'Search Components',
    description: [
      'Search across all component source files for a keyword or pattern.',
      'Returns matching file paths and line snippets.',
      'Useful for finding how a specific pattern, class, or API is used across components.',
    ].join(' '),
    inputSchema: {
      query: z.string().describe('Text to search for in component source files'),
      case_sensitive: z.boolean().optional().describe('Whether the search is case-sensitive (default: false)'),
    },
  },
  async ({ query, case_sensitive }) => {
    await ensureInitialized();

    const results: { file: string; matches: string[] }[] = [];
    const flags = case_sensitive ? '' : 'i';
    let regex: RegExp;
    try {
      regex = new RegExp(query, flags);
    } catch {
      regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    }

    for (const [, item] of registryMap) {
      for (const file of item.files) {
        const filePath = path.join(uiDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          const matchingLines: string[] = [];

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              matchingLines.push(`L${i + 1}: ${lines[i].trim()}`);
            }
          }

          if (matchingLines.length > 0) {
            results.push({
              file,
              matches: matchingLines.slice(0, 10), // limit per file
            });
          }
        } catch {
          // skip unreadable files
        }
      }
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `No matches found for "${query}" across ${registryMap.size} registry items.`,
          },
        ],
      };
    }

    const output = results.map((r) => {
      const matchStr = r.matches.join('\n  ');
      return `${r.file}:\n  ${matchStr}`;
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found matches in ${results.length} file(s):\n\n${output.join('\n\n')}`,
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: cli_init
// ---------------------------------------------------------------------------
server.registerTool(
  'cli_init',
  {
    title: 'Initialize Project',
    description: [
      'Returns the CLI command to initialize shadcn-angular in an Angular project.',
      'The init command sets up Tailwind CSS, creates components.json config,',
      'installs base dependencies, and creates the component directory structure.',
      'Optionally returns a non-interactive command with defaults.',
    ].join(' '),
    inputSchema: {
      project_dir: z
        .string()
        .optional()
        .describe('The Angular project directory (defaults to current directory)'),
      use_defaults: z
        .boolean()
        .optional()
        .describe('Use default configuration without prompts'),
    },
  },
  async ({ project_dir, use_defaults }) => {
    const flags = use_defaults ? ' --defaults' : ' --yes';
    const cdPrefix = project_dir ? `cd ${project_dir} && ` : '';
    const command = `${cdPrefix}npx @gilav21/shadcn-angular init${flags}`;

    const explanation = [
      '## shadcn-angular init',
      '',
      'Initializes shadcn-angular in an Angular project.',
      '',
      '### What it does:',
      '1. Validates this is an Angular project (checks angular.json)',
      '2. Creates `components.json` configuration file',
      '3. Creates `utils.ts` with the `cn()` class-merging utility',
      '4. Creates `shortcut-binding.service.ts` for keyboard shortcuts',
      '5. Sets up Tailwind CSS with theme colors and CSS variables',
      '6. Installs npm dependencies: clsx, tailwind-merge, class-variance-authority, tailwindcss, postcss, @tailwindcss/postcss',
      '7. Creates `.postcssrc.json` for PostCSS configuration',
      '',
      '### Default configuration:',
      '- Base color: neutral',
      '- Theme: zinc',
      '- Components path: src/components/ui',
      '- Utils path: src/components/lib/utils',
      '- Global CSS: src/styles.scss',
      '',
      '### Run this command:',
      '```bash',
      command,
      '```',
      '',
      '### After initialization, update tsconfig.json paths:',
      '```json',
      '{',
      '  "compilerOptions": {',
      '    "baseUrl": ".",',
      '    "paths": {',
      '      "@/*": ["./src/*"]',
      '    }',
      '  }',
      '}',
      '```',
    ];

    return {
      content: [
        {
          type: 'text' as const,
          text: explanation.join('\n'),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: cli_add
// ---------------------------------------------------------------------------
server.registerTool(
  'cli_add',
  {
    title: 'Add Components',
    description: [
      'Returns the CLI command to add one or more shadcn-angular components to an Angular project.',
      'Automatically resolves and includes all transitive dependencies.',
      'Shows what will be installed and the exact command to run.',
    ].join(' '),
    inputSchema: {
      components: z
        .array(z.string())
        .describe('Component names to add (e.g. ["button", "dialog", "data-table"])'),
      project_dir: z.string().optional().describe('The Angular project directory'),
      overwrite: z.boolean().optional().describe('Overwrite existing component files'),
      target_path: z.string().optional().describe('Custom path for component installation'),
    },
  },
  async ({ components, project_dir, overwrite, target_path }) => {
    await ensureInitialized();

    // Validate component names
    const invalid = components.filter((c) => !registryMap.has(c));
    if (invalid.length > 0) {
      const available = Array.from(registryMap.keys()).join(', ');
      return {
        content: [
          {
            type: 'text' as const,
            text: `Invalid component(s): ${invalid.join(', ')}\n\nAvailable: ${available}`,
          },
        ],
        isError: true,
      };
    }

    // Resolve all transitive dependencies
    const allDeps = new Set<string>();
    for (const comp of components) {
      allDeps.add(comp);
      for (const dep of resolveTransitiveDependencies(comp, registryMap)) {
        allDeps.add(dep);
      }
    }

    const flags: string[] = [];
    if (overwrite) flags.push('--overwrite');
    if (target_path) flags.push(`--path ${target_path}`);
    flags.push('--yes');

    const cdPrefix = project_dir ? `cd ${project_dir} && ` : '';
    const command = `${cdPrefix}npx @gilav21/shadcn-angular add ${components.join(' ')}${flags.length > 0 ? ' ' + flags.join(' ') : ''}`;

    const depsOnly = Array.from(allDeps).filter((d) => !components.includes(d));

    const summary = [
      '## shadcn-angular add',
      '',
      `### Components requested: ${components.join(', ')}`,
    ];

    if (depsOnly.length > 0) {
      summary.push(`### Auto-resolved dependencies: ${depsOnly.join(', ')}`);
    }

    summary.push(
      `### Total items to install: ${allDeps.size}`,
      '',
      '### Items breakdown:',
    );

    for (const dep of allDeps) {
      const item = registryMap.get(dep)!;
      const marker = components.includes(dep) ? '(requested)' : '(dependency)';
      summary.push(
        `- **${dep}** ${marker} — ${item.type}, ${item.files.length} file(s)`,
      );
    }

    // Collect npm dependencies
    const npmDeps = new Set<string>();
    for (const dep of allDeps) {
      const item = registryMap.get(dep);
      if (item?.npmDependencies) {
        for (const nd of item.npmDependencies) {
          npmDeps.add(nd);
        }
      }
    }

    if (npmDeps.size > 0) {
      summary.push('', `### NPM dependencies that will be installed: ${Array.from(npmDeps).join(', ')}`);
    }

    summary.push(
      '',
      '### Run this command:',
      '```bash',
      command,
      '```',
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: summary.join('\n'),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_categories
// ---------------------------------------------------------------------------
server.registerTool(
  'get_categories',
  {
    title: 'Get Component Categories',
    description:
      'Returns all component categories with counts and the items in each. Useful for getting an overview of the library.',
    inputSchema: {},
  },
  async () => {
    await ensureInitialized();

    const categories = new Map<string, { items: string[]; types: Map<string, number> }>();

    for (const [, item] of registryMap) {
      if (!categories.has(item.category)) {
        categories.set(item.category, { items: [], types: new Map() });
      }
      const cat = categories.get(item.category)!;
      cat.items.push(item.name);
      cat.types.set(item.type, (cat.types.get(item.type) ?? 0) + 1);
    }

    const result: Record<string, { count: number; types: Record<string, number>; items: string[] }> = {};
    for (const [catName, catData] of categories) {
      result[catName] = {
        count: catData.items.length,
        types: Object.fromEntries(catData.types),
        items: catData.items.sort(),
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_component_guidelines
// ---------------------------------------------------------------------------
server.registerTool(
  'get_component_guidelines',
  {
    title: 'Get Component Guidelines',
    description: [
      'Returns the shadcn-angular component design guidelines from CLAUDE.md.',
      'Covers the dual-mode pattern (simple inputs + content projection),',
      'naming conventions, quality standards, and anti-patterns.',
      'Read this before creating or modifying any component.',
    ].join(' '),
    inputSchema: {},
  },
  async () => {
    const claudeMdPath = path.resolve(__dirname, '../../../.claude/CLAUDE.md');
    try {
      const content = fs.readFileSync(claudeMdPath, 'utf-8');
      return {
        content: [
          {
            type: 'text' as const,
            text: content,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Could not read component guidelines file.',
          },
        ],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('shadcn-angular MCP server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
