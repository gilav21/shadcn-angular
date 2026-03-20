import chalk from 'chalk';
import { registry, getComponentNames } from '../registry/index.js';

type Category = 'UI' | 'Charts' | 'Layout / Page Building' | 'Animation' | 'Kanban';

const CATEGORY_ORDER: readonly Category[] = ['UI', 'Charts', 'Layout / Page Building', 'Animation', 'Kanban'];

const ANIMATION_COMPONENTS = new Set([
  'gradient-text', 'flip-text', 'meteors', 'shine-border', 'scroll-progress',
  'blur-fade', 'ripple', 'marquee', 'word-rotate', 'morphing-text',
  'typing-animation', 'wobble-card', 'magnetic', 'orbit', 'stagger-children',
  'particles', 'confetti', 'number-ticker', 'text-reveal', 'streaming-text', 'sparkles',
]);

const KANBAN_COMPONENTS = new Set(['kanban']);

const LAYOUT_COMPONENTS = new Set(['bento-grid', 'page-builder']);

function categorize(name: string): Category {
  if (!(name in registry)) return 'UI';
  const def = registry[name as keyof typeof registry];

  const hasChartFile = def.files.some(f => f.startsWith('charts/'));
  if (hasChartFile) return 'Charts';

  if (LAYOUT_COMPONENTS.has(name)) return 'Layout / Page Building';
  if (ANIMATION_COMPONENTS.has(name)) return 'Animation';
  if (KANBAN_COMPONENTS.has(name)) return 'Kanban';

  return 'UI';
}

function buildComponentsByCategory(): Map<Category, readonly string[]> {
  const groups = new Map<Category, string[]>();

  for (const cat of CATEGORY_ORDER) {
    groups.set(cat, []);
  }

  for (const name of getComponentNames()) {
    const cat = categorize(name);
    const list = groups.get(cat);
    if (list) list.push(name);
  }

  for (const list of groups.values()) {
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
  const groups = buildComponentsByCategory();
  const lines: string[] = [
    chalk.bold('Available Components'),
    '',
  ];

  for (const [category, names] of groups) {
    if (names.length === 0) continue;
    const countLabel = chalk.gray('(' + String(names.length) + ')');
    lines.push(
      '  ' + chalk.yellow(category) + ' ' + countLabel,
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
  ];

  console.log(output.join('\n'));
}
