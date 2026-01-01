#!/usr/bin/env node
import { Command } from 'commander';
import { init } from './commands/init.js';
import { add } from './commands/add.js';

const program = new Command();

program
    .name('shadcn-angular')
    .description('CLI for adding shadcn-angular components to your Angular project')
    .version('0.0.1');

program
    .command('init')
    .description('Initialize shadcn-angular in your project')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-d, --defaults', 'Use default configuration')
    .action(init);

program
    .command('add')
    .description('Add a component to your project')
    .argument('[components...]', 'The components to add')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-o, --overwrite', 'Overwrite existing files')
    .option('-a, --all', 'Add all available components')
    .option('-p, --path <path>', 'The path to add the component to')
    .action(add);

program.parse();
