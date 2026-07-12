import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
import { createProgram } from '../program.js';

/**
 * CLI <-> MCP parity.
 *
 * The commander CLI (`src/program.ts` + `src/commands/*`) and the MCP server
 * (`src/mcp/tools/*`) are two hand-written surfaces over the same `src/core/*`
 * logic, declared with two different schema systems. Nothing in the compiler
 * connects them, so they drift silently — that is exactly how every MCP tool
 * ended up hardcoding `branch: 'master'` while every CLI command accepted
 * `--branch`, and how `migrate` / `why` / `refresh_lib` ended up existing on
 * one surface only.
 *
 * This spec introspects BOTH surfaces at runtime (the real commander program,
 * the real registered tools via an in-memory MCP client) and checks them
 * against {@link PARITY_MAP}. A new command or tool that is not in the map
 * fails the suite with an actionable message; so does a registry-backed tool
 * whose CLI counterpart takes `--branch/--registry/--remote` while the tool
 * forgot to spread `sourceInputSchema`.
 */

/** The registry-source flags/fields both surfaces must agree on. */
const SOURCE_KEYS = ['branch', 'registry', 'remote'] as const;

interface ParityEntry {
    /** Commander command name, or null when the capability is MCP-only. */
    readonly command: string | null;
    /** MCP tool name, or null when the capability is CLI-only. */
    readonly tool: string | null;
    /** Required for deliberate non-pairs: why this surface has no counterpart. */
    readonly reason?: string;
}

/**
 * The single source of truth for which CLI command corresponds to which MCP
 * tool. Deliberate asymmetry is allowed but must be recorded here with a
 * `reason`, so that unintentional asymmetry is the only thing that fails.
 */
const PARITY_MAP: readonly ParityEntry[] = [
    { command: 'init', tool: 'init_project' },
    { command: 'add', tool: 'add_component' },
    { command: 'update', tool: 'update_component' },
    { command: 'diff', tool: 'diff_component' },
    { command: 'apply', tool: 'apply_addon' },
    { command: 'doctor', tool: 'doctor_fix' },
    { command: 'refresh-lib', tool: 'refresh_lib' },
    { command: 'migrate', tool: 'migrate' },
    { command: 'why', tool: 'why' },
    { command: 'list', tool: 'list_components' },
    { command: 'search', tool: 'search_components' },
    { command: 'status', tool: 'get_project_status' },
    { command: 'set-density', tool: 'set_density' },
    { command: 'set-radius', tool: 'set_radius' },
    { command: 'set-motion', tool: 'set_motion' },
    { command: 'set-locale', tool: 'set_locale' },
    { command: 'change-theme', tool: 'change_theme' },

    // CLI-only, by design.
    {
        command: 'help', tool: null,
        reason: 'Human-facing usage text. An agent reads the tool descriptions instead.',
    },
    {
        command: 'mcp', tool: null,
        reason: 'Starts the MCP server itself — it cannot be a tool of the server it boots.',
    },

    // MCP-only, by design.
    {
        command: null, tool: 'get_component',
        reason: 'Returns the registry record as JSON for an agent; humans use `why` / `list`.',
    },
    {
        command: null, tool: 'get_component_source',
        reason: 'Streams file contents into an agent\'s context; a human just opens the file.',
    },
    {
        command: null, tool: 'get_component_examples',
        reason: 'Feeds usage snippets into an agent\'s context; humans read the docs site.',
    },
    {
        command: null, tool: 'get_install_plan',
        reason: 'Read-only preview for an agent; the CLI equivalent is `add --dry-run`.',
    },
];

const MAPPED_COMMANDS = new Set(PARITY_MAP.map(e => e.command).filter((c): c is string => c !== null));
const MAPPED_TOOLS = new Set(PARITY_MAP.map(e => e.tool).filter((t): t is string => t !== null));

/** Long flags (`--branch`) registered on a commander command, without the dashes. */
function commandFlags(program: ReturnType<typeof createProgram>, name: string): Set<string> {
    const command = program.commands.find(c => c.name() === name);
    if (!command) return new Set();
    return new Set(
        command.options
            .map(o => o.long)
            .filter((long): long is string => typeof long === 'string')
            .map(long => long.replace(/^--/, '')),
    );
}

interface ToolShape {
    readonly name: string;
    readonly properties: readonly string[];
}

/** `a, b` -> `` `a`, `b` `` — kept out of the message template (no nested literals). */
function quoted(names: readonly string[]): string {
    return names.map(n => '`' + n + '`').join(', ');
}

function hasAllSourceKeys(keys: Iterable<string>): boolean {
    const set = new Set(keys);
    return SOURCE_KEYS.every(k => set.has(k));
}

function hasAnySourceKey(keys: Iterable<string>): boolean {
    const set = new Set(keys);
    return SOURCE_KEYS.some(k => set.has(k));
}

describe('CLI <-> MCP parity', () => {
    const program = createProgram();
    const commandNames = program.commands.map(c => c.name());
    let client: Client;
    let tools: ToolShape[];

    beforeAll(async () => {
        const server = createMcpServer(process.cwd());
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        client = new Client({ name: 'parity-test', version: '0' });
        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
        const listed = await client.listTools();
        tools = listed.tools.map(t => ({
            name: t.name,
            properties: Object.keys(t.inputSchema.properties ?? {}),
        }));
    });

    afterAll(async () => {
        await client.close();
    });

    it('introspects both surfaces (guards against an empty, vacuously-passing suite)', () => {
        expect(commandNames.length).toBeGreaterThan(10);
        expect(tools.length).toBeGreaterThan(10);
    });

    it('every CLI command is in PARITY_MAP', () => {
        const unmapped = commandNames.filter(name => !MAPPED_COMMANDS.has(name));
        expect(
            unmapped,
            `CLI command(s) ${quoted(unmapped)} have no entry in PARITY_MAP `
            + '(packages/cli/src/mcp/parity.spec.ts). Add the matching MCP tool in '
            + 'src/mcp/tools/*-tools.ts and map it, or add a `{ command, tool: null, reason }` '
            + 'entry explaining why the command is deliberately CLI-only.',
        ).toEqual([]);
    });

    it('every MCP tool is in PARITY_MAP', () => {
        const unmapped = tools.map(t => t.name).filter(name => !MAPPED_TOOLS.has(name));
        expect(
            unmapped,
            `MCP tool(s) ${quoted(unmapped)} have no CLI counterpart `
            + 'in PARITY_MAP (packages/cli/src/mcp/parity.spec.ts). Add the matching command in '
            + 'src/program.ts and map it, or add a `{ command: null, tool, reason }` entry '
            + 'explaining why the tool is deliberately MCP-only.',
        ).toEqual([]);
    });

    it('PARITY_MAP has no stale entries (renamed / removed commands and tools)', () => {
        const toolNames = new Set(tools.map(t => t.name));
        const staleCommands = [...MAPPED_COMMANDS].filter(c => !commandNames.includes(c));
        const staleTools = [...MAPPED_TOOLS].filter(t => !toolNames.has(t));
        expect(
            staleCommands,
            `PARITY_MAP maps command(s) ${staleCommands.join(', ')} that the commander program no `
            + 'longer registers. Were they renamed or removed? Update PARITY_MAP.',
        ).toEqual([]);
        expect(
            staleTools,
            `PARITY_MAP maps MCP tool(s) ${staleTools.join(', ')} that the server no longer `
            + 'registers. Were they renamed or removed? Update PARITY_MAP.',
        ).toEqual([]);
    });

    it('deliberate non-pairs document a reason', () => {
        for (const entry of PARITY_MAP) {
            if (entry.command !== null && entry.tool !== null) continue;
            const surface = entry.command ?? entry.tool;
            expect(
                entry.reason,
                `PARITY_MAP entry \`${surface}\` has no counterpart on the other surface and no `
                + '`reason`. Intentional asymmetry must be justified in the map.',
            ).toBeTruthy();
        }
    });

    it('every registry-backed MCP tool accepts the source options its CLI command accepts', () => {
        const missing: string[] = [];
        for (const { command, tool } of PARITY_MAP) {
            if (command === null || tool === null) continue;
            if (!hasAllSourceKeys(commandFlags(program, command))) continue;
            const properties = tools.find(t => t.name === tool)?.properties ?? [];
            if (!hasAllSourceKeys(properties)) missing.push(`${tool} (CLI: ${command})`);
        }
        expect(
            missing,
            `MCP tool(s) ${missing.join(', ')} are registry-backed on the CLI side (the command takes `
            + '--branch/--registry/--remote) but their inputSchema does not accept branch/registry/remote. '
            + 'Spread `...sourceInputSchema` from src/mcp/tools/options.ts into the tool\'s inputSchema and '
            + 'resolve it with `resolveSource(args, config)` — otherwise the tool silently pins to the '
            + 'default branch while the CLI does not.',
        ).toEqual([]);
    });

    it('no MCP tool takes source options its CLI command lacks', () => {
        const missing: string[] = [];
        for (const { command, tool } of PARITY_MAP) {
            if (command === null || tool === null) continue;
            const properties = tools.find(t => t.name === tool)?.properties ?? [];
            if (!hasAnySourceKey(properties)) continue;
            if (!hasAllSourceKeys(commandFlags(program, command))) missing.push(`${command} (MCP: ${tool})`);
        }
        expect(
            missing,
            `CLI command(s) ${missing.join(', ')} lack --branch/--registry/--remote even though their MCP `
            + 'tool accepts branch/registry/remote. Add the three options in src/program.ts (the preAction '
            + 'hook already forwards them to loadRegistry), or drop `sourceInputSchema` from the tool.',
        ).toEqual([]);
    });

    it('source options are all-or-nothing on each surface', () => {
        for (const name of commandNames) {
            const flags = commandFlags(program, name);
            if (!hasAnySourceKey(flags)) continue;
            expect(
                hasAllSourceKeys(flags),
                `CLI command \`${name}\` takes some but not all of --branch/--registry/--remote.`,
            ).toBe(true);
        }
        for (const tool of tools) {
            if (!hasAnySourceKey(tool.properties)) continue;
            expect(
                hasAllSourceKeys(tool.properties),
                `MCP tool \`${tool.name}\` takes some but not all of branch/registry/remote — `
                + 'spread the whole `sourceInputSchema` instead of individual fields.',
            ).toBe(true);
        }
    });
});
