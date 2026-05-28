#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { init } from './commands/init.js';
import { add } from './commands/add.js';
import { diff } from './commands/diff.js';
import { list } from './commands/list.js';
import { why } from './commands/why.js';
import { help } from './commands/help.js';
import { search } from './commands/search.js';
import { doctor } from './commands/doctor.js';
import { update } from './commands/update.js';
import { startMcpServer } from './mcp/server.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as { version: string };

const program = new Command();

program
    .name('shadcn-angular')
    .description('CLI for adding shadcn-angular components to your Angular project')
    .version(pkg.version);

program
    .command('init')
    .description('Initialize shadcn-angular in your project')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-d, --defaults', 'Use default configuration')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch components from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL (e.g., https://gitlab.com/org/repo/-/raw/main/packages/components)')
    .option('--prefix <prefix>', 'Component selector prefix to use (default: "ui")')
    .action(init);

program
    .command('add')
    .description('Add a component to your project')
    .argument('[components...]', 'The components to add')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-o, --overwrite', 'Overwrite existing files')
    .option('-a, --all', 'Add all available components')
    .option('-p, --path <path>', 'The path to add the component to')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('--dry-run', 'Show what would be installed without making changes')
    .option('-b, --branch <branch>', 'GitHub branch to fetch components from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL (overrides components.json)')
    .action(add);

program
    .command('diff')
    .description('Show differences between local and remote component versions')
    .argument('[components...]', 'Components to diff (all installed if omitted)')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(diff);

program
    .command('list')
    .description('List all components and their install status')
    .action(list);

program
    .command('why')
    .description('Print a component\'s registry record (files, deps, reverse-dependents)')
    .argument('<components...>', 'One or more component names')
    .action(why);

program
    .command('help')
    .description('Show detailed usage information')
    .action(help);

program
    .command('update')
    .description('Update installed components to the latest registry version')
    .argument('[components...]', 'Components to update (all installed if omitted)')
    .option('--dry-run', 'Show what would update without writing')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(update);

program
    .command('doctor')
    .description('Check installed components for drift, missing files, and missing deps')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(doctor);

program
    .command('search')
    .description('Search components by name, tag, or description')
    .argument('[query...]', 'Search terms')
    .option('--json', 'Output raw JSON')
    .action((query: string[], options: { json?: boolean }) => search(query, options));

program
    .command('mcp')
    .description('Start the MCP server (stdio) for AI agents')
    .action(async () => {
        await startMcpServer(process.cwd());
    });

program.parse();
