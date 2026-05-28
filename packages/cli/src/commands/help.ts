import chalk from 'chalk';
import { registry, getComponentNames, CATEGORIES, type Category } from '../registry/index.js';

const CATEGORY_LABELS: Record<Category, string> = {
  form: 'Form',
  navigation: 'Navigation',
  layout: 'Layout',
  overlay: 'Overlay',
  'data-display': 'Data Display',
  feedback: 'Feedback',
  charts: 'Charts',
  animation: 'Animation',
  media: 'Media',
  editor: 'Editor',
  utility: 'Utility',
  auth: 'Auth',
  dashboard: 'Dashboard',
  settings: 'Settings',
  marketing: 'Marketing',
};

const BLOCK_CATEGORIES: readonly Category[] = ['auth', 'dashboard', 'settings', 'marketing'];

/**
 * Group every non-block component under its declared `category` (slug-keyed).
 * Components without a category fall back to `'utility'`. Blocks are excluded
 * (see {@link groupBlocks}).
 */
export function groupByCategory(): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const name of getComponentNames()) {
    if (registry[name].type === 'block') continue;
    const cat = registry[name].category ?? 'utility';
    (groups[cat] ??= []).push(name);
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => a.localeCompare(b));
  }
  return groups;
}

/** Group block entries (`type:'block'`) under their block-family category. */
export function groupBlocks(): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const name of getComponentNames()) {
    if (registry[name].type !== 'block') continue;
    const cat = registry[name].category ?? 'utility';
    (groups[cat] ??= []).push(name);
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => a.localeCompare(b));
  }
  return groups;
}

function formatComponentList(names: readonly string[], columns = 4): string {
  const colWidth = 26;
  const lines: string[] = [];

  for (let i = 0; i < names.length; i += columns) {
    const row = names.slice(i, i + columns);
    lines.push('  ' + row.map(n => n.padEnd(colWidth)).join(''));
  }

  return lines.join('\n');
}

function buildCommandsSection(): string[] {
  const branchDefault = chalk.gray('(default: master)');

  return [
    chalk.bold('Commands'),
    '',
    '  ' + chalk.cyan('init') + '   Initialize shadcn-angular in your project',
    '    ' + chalk.gray('-y, --yes') + '            Skip confirmation prompt',
    '    ' + chalk.gray('-d, --defaults') + '       Use default configuration',
    '    ' + chalk.gray('--remote') + '             Force remote fetch from GitHub registry',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
    '  ' + chalk.cyan('add') + '    Add component(s) to your project',
    '    ' + chalk.gray('[components...]') + '       One or more component names',
    '    ' + chalk.gray('-y, --yes') + '            Skip prompts and overwrite conflicts',
    '    ' + chalk.gray('-o, --overwrite') + '      Overwrite existing files',
    '    ' + chalk.gray('-a, --all') + '            Add all available components',
    '    ' + chalk.gray('-p, --path') + ' <path>     Custom install path',
    '    ' + chalk.gray('--remote') + '             Force remote fetch from GitHub registry',
    '    ' + chalk.gray('--dry-run') + '            Show what would be installed without changes',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
    '  ' + chalk.cyan('diff') + '   Show differences between local and remote versions',
    '    ' + chalk.gray('[components...]') + '       Components to diff (all installed if omitted)',
    '    ' + chalk.gray('--remote') + '             Force remote fetch from GitHub registry',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
    '  ' + chalk.cyan('list') + '   List all components and their install status',
    '',
    '  ' + chalk.cyan('help') + '   Show this reference',
    '',
  ];
}

function buildOptionalDepsSection(): string[] {
  return [
    chalk.bold('Optional Dependencies'),
    '',
    '  Some components offer companion packages during installation.',
    '  With ' + chalk.cyan('--yes') + ' they are skipped; with ' + chalk.cyan('--all') + ' they are included automatically.',
    '',
  ];
}

function buildComponentsSection(): string[] {
  const groups = groupByCategory();
  const lines: string[] = [
    chalk.bold('Available Components'),
    '',
  ];

  for (const category of CATEGORIES) {
    const names = groups[category];
    if (!names || names.length === 0) continue;
    const countLabel = chalk.gray('(' + String(names.length) + ')');
    lines.push(
      '  ' + chalk.yellow(CATEGORY_LABELS[category]) + ' ' + countLabel,
      formatComponentList(names),
      '',
    );
  }

  return lines;
}

function buildBlocksSection(): string[] {
  const groups = groupBlocks();
  if (Object.keys(groups).length === 0) return [];

  const lines: string[] = [chalk.bold('Available Blocks'), ''];
  for (const category of BLOCK_CATEGORIES) {
    const names = groups[category];
    if (!names || names.length === 0) continue;
    const countLabel = chalk.gray('(' + String(names.length) + ')');
    lines.push(
      '  ' + chalk.yellow(CATEGORY_LABELS[category]) + ' ' + countLabel,
      formatComponentList(names),
      '',
    );
  }
  return lines;
}

export function help(): void {
  const output = [
    '',
    chalk.bold.underline('shadcn-angular CLI'),
    '',
    ...buildCommandsSection(),
    ...buildOptionalDepsSection(),
    ...buildComponentsSection(),
    ...buildBlocksSection(),
  ];

  console.log(output.join('\n'));
}
