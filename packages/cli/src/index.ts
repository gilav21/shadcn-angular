#!/usr/bin/env node
import { Command } from 'commander';
import { init } from './commands/init.js';
import { add } from './commands/add.js';
import { help } from './commands/help.js';

const program = new Command();

program
    .name('shadcn-angular')
    .description('CLI for adding shadcn-angular components to your Angular project')
    .version('0.0.10');

program
    .command('init')
    .description('Initialize shadcn-angular in your project')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-d, --defaults', 'Use default configuration')
    .option('-b, --branch <branch>', 'GitHub branch to fetch components from', 'master')
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
    .option('-b, --branch <branch>', 'GitHub branch to fetch components from', 'master')
    .action(add);

program
    .command('help')
    .description('Show detailed usage information')
    .action(help);

program.parse();
