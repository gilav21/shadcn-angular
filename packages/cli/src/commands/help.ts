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
    groups[cat] ??= [];
    groups[cat].push(name);
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
    groups[cat] ??= [];
    groups[cat].push(name);
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

function buildInstallCommands(branchDefault: string): string[] {
  return [
    '  ' + chalk.cyan('init') + '   Initialize shadcn-angular in your project',
    '    ' + chalk.gray('-y, --yes') + '            Skip confirmation prompt',
    '    ' + chalk.gray('-d, --defaults') + '       Use default configuration',
    '    ' + chalk.gray('--remote') + '             Force remote fetch from GitHub registry',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
    '  ' + chalk.cyan('add') + '    Add component(s) to your project',
    '    ' + chalk.gray('[components...]') + '       One or more component names',
    '    ' + chalk.gray('-y, --yes') + '            Skip prompts and overwrite conflicts',
    '    ' + chalk.gray('-o, --overwrite') + '      Overwrite existing files whole-file (no 3-way merge)',
    '    ' + chalk.gray('-a, --all') + '            Add all available components',
    '    ' + chalk.gray('--with') + ' <addons>      Include addon(s): parent/addon, comma-separated, or "all"',
    '    ' + chalk.gray('--preset') + ' <name>      Pre-select a named addon bundle (see `why <component>`)',
    '    ' + chalk.gray('--no-addons') + '          Skip optional addons without prompting',
    '    ' + chalk.gray('-p, --path') + ' <path>     Custom install path',
    '    ' + chalk.gray('--remote') + '             Force remote fetch from GitHub registry',
    '    ' + chalk.gray('--dry-run') + '            Show what would be installed without changes',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
    '  ' + chalk.cyan('apply') + '  Install an addon (if missing) and wire it into your component(s)',
    '    ' + chalk.gray('<addon>') + '              Addon key, e.g. data-table/context-menu',
    '    ' + chalk.gray('[components...]') + '       Component class name(s) to wire (else scans current dir)',
    '    ' + chalk.gray('-y, --yes') + '            Wire all found; snippet fallback when ambiguous',
    '    ' + chalk.gray('-o, --overwrite') + '      Overwrite a locally-edited base/addon whole-file (no 3-way merge)',
    '    ' + chalk.gray('--scan') + '               Scan the whole app for usages and choose interactively',
    '    ' + chalk.gray('--all') + '                Wire every matching instance in the selected files',
    '    ' + chalk.gray('--dry-run') + '            Show what would be wired without writing',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
    '  ' + chalk.cyan('update') + ' Update installed components to the latest registry version',
    '    ' + chalk.gray('[components...]') + '       Components to update (all installed if omitted)',
    '    ' + chalk.gray('-y, --yes') + '            Install newly-required dependencies without prompting',
    '    ' + chalk.gray('-o, --overwrite') + '      Take upstream whole-file instead of 3-way merging your edits',
    '    ' + chalk.gray('--dry-run') + '            Preview what would update without writing',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
  ];
}

function buildInspectCommands(branchDefault: string): string[] {
  return [
    '  ' + chalk.cyan('diff') + '   Show differences between local and remote versions',
    '    ' + chalk.gray('[components...]') + '       Components to diff (all installed if omitted)',
    '    ' + chalk.gray('--remote') + '             Force remote fetch from GitHub registry',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
    '  ' + chalk.cyan('list') + '   List all components and their install status',
    '',
    '  ' + chalk.cyan('doctor') + ' Check installed components for drift, missing files, and missing deps',
    '    ' + chalk.gray('--fix') + '                Repair missing files/deps (never touches your edits)',
    '    ' + chalk.gray('--dry-run') + '            Show what --fix would do without changes',
    '',
    '  ' + chalk.cyan('why') + ' <components...>   Print files, install size, deps, and reverse-dependents',
    '',
    '  ' + chalk.cyan('status') + ' Show project status: design tokens, component health, and config',
    '',
    '  ' + chalk.cyan('search') + ' [query...]    Search components by name, tag, or description',
    '',
    '  ' + chalk.cyan('migrate') + ' Migrate legacy single-file components to the folder/trio layout',
    '    ' + chalk.gray('-y, --yes') + '            Overwrite locally-customized components without prompting',
    '    ' + chalk.gray('--dry-run') + '            Show the migration plan without writing',
    '    ' + chalk.gray('--force') + '              Proceed even if the git working tree is dirty',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
    '  ' + chalk.cyan('refresh-lib') + ' Reconcile the shared lib/ files (utils.ts, i18n, parsers, …) with the registry',
    '    ' + chalk.gray('--files') + ' <files>      Comma-separated lib file paths (default: stale + missing)',
    '    ' + chalk.gray('--force') + '              Also overwrite lib files you customized (protected by default)',
    '    ' + chalk.gray('-y, --yes') + '            Skip the --force confirmation prompt',
    '    ' + chalk.gray('--dry-run') + '            Show what would be refreshed without writing',
    '    ' + chalk.gray('-b, --branch') + ' <branch> GitHub branch to fetch from ' + branchDefault,
    '',
    '  ' + chalk.cyan('help') + '   Show this reference',
    '',
  ];
}

function buildCommandsSection(): string[] {
  const branchDefault = chalk.gray('(default: master)');
  return [
    chalk.bold('Commands'),
    '',
    ...buildInstallCommands(branchDefault),
    ...buildInspectCommands(branchDefault),
  ];
}

function buildAddonsSection(): string[] {
  return [
    chalk.bold('Addons'),
    '',
    '  Some components ship a lean base plus opt-in addons that resolving the',
    '  base does NOT pull in. After ' + chalk.cyan('add') + ' the available addons are listed.',
    '  ' + chalk.cyan('apply <parent/addon>') + ' installs the addon (if missing) and wires it into',
    '  your component usage, e.g. ' + chalk.cyan('apply data-table/context-menu') + '.',
    '  Install without wiring via ' + chalk.cyan('add --with <parent/addon>') + '; opt out with ' + chalk.cyan('--no-addons') + '.',
    '  Bases that declare presets can be installed as a named addon bundle with',
    '  ' + chalk.cyan('add <base> --preset <name>') + ' — ' + chalk.cyan('why <base>') + ' lists them; ' + chalk.cyan('--preset core') + ' means no addons.',
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
    ...buildAddonsSection(),
    ...buildComponentsSection(),
    ...buildBlocksSection(),
  ];

  console.log(output.join('\n'));
}
