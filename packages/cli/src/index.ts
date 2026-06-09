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
import { status } from './commands/status.js';
import { update } from './commands/update.js';
import { migrate } from './commands/migrate.js';
import { setDensity } from './commands/set-density.js';
import { setRadius } from './commands/set-radius.js';
import { setMotion } from './commands/set-motion.js';
import { changeTheme } from './commands/change-theme.js';
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
    .option('-y, --yes', 'Install newly-required dependencies without prompting')
    .option('--dry-run', 'Show what would update without writing')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(update);

program
    .command('doctor')
    .description('Check installed components for drift, missing files, and missing deps')
    .option('--fix', 'Repair missing files, stale components, and missing npm deps (never touches your edits)')
    .option('--dry-run', 'Show what --fix would do without making changes')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(doctor);

program
    .command('status')
    .description('Show project status: design tokens, component health, and config')
    .option('--json', 'Output the raw status report as JSON')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(status);

program
    .command('migrate')
    .description('Migrate legacy single-file components to the folder/trio layout')
    .option('-y, --yes', 'Overwrite locally-customized components without prompting')
    .option('--dry-run', 'Show the migration plan without writing')
    .option('--force', 'Proceed even if the git working tree is dirty / not a repo')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(migrate);

program
    .command('search')
    .description('Search components by name, tag, or description')
    .argument('[query...]', 'Search terms')
    .option('--json', 'Output raw JSON')
    .action((query: string[], options: { json?: boolean }) => search(query, options));

program
    .command('set-density')
    .description('Set the global density level (1=compact to 5=spacious)')
    .argument('<level>', 'Density level 1-5')
    .option('-c, --component <components>', 'Comma-separated component names to set individually (e.g. card,button)')
    .action((level: string, options: { component?: string }) => setDensity(level, options));

program
    .command('set-radius')
    .description('Set the global border radius (none, sm, md, lg, xl, full, or a raw value like 0.5rem)')
    .argument('<value>', 'Radius name or raw CSS value')
    .action((value: string) => setRadius(value));

program
    .command('set-motion')
    .description('Set the global motion level (0=none, 1=default, 2=expressive)')
    .argument('<level>', 'Motion level 0-2')
    .action((level: string) => setMotion(level));

program
    .command('change-theme')
    .description('Change the color theme (zinc, slate, stone, gray, neutral, red, rose, orange, green, blue, yellow, violet, amber) or generate one from a brand color')
    .argument('[name]', 'Theme name')
    .option('--from <hex>', 'Generate the theme from a brand hex color (e.g. "#3b82f6")')
    .action((name: string | undefined, options: { from?: string }) => changeTheme(name, options));

program
    .command('mcp')
    .description('Start the MCP server (stdio) for AI agents')
    .action(async () => {
        await startMcpServer(process.cwd());
    });

program.parse();
