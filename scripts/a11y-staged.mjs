// Pre-commit a11y gate — runs the axe (a11y) Storybook pass over ONLY the
// components the staged files touch.
//
// Why scoped: the full axe pass (`npm run test-storybook:a11y`) is ~93s of
// browser time on top of the Storybook boot. Paying that on every commit is the
// fastest known route to `git commit --no-verify` becoming muscle memory, at
// which point the hook protects nothing. So the commit-time gate audits the
// components you actually touched; the FULL axe pass still runs at push time
// (`npm run hook:pre-push`), so nothing reaches the remote unaudited.
//
// Three outcomes, decided from `git diff --cached`:
//
//   1. nothing a11y-relevant staged (docs, CLI, e2e, scripts …)
//      → skipped entirely, ~0s.
//   2. only component folders staged (packages/components/ui/<name>/**)
//      → axe over those components' stories only.
//   3. a GLOBAL file staged (see GLOBAL_MATCHERS) — shared lib, global CSS,
//      the Storybook config, or a flat shared directive/pipe under ui/
//      → full axe run. A shared file can break the a11y of any component, so
//        scoping to nothing (or to a subset) there would be a false green.
//
// The axe assertion itself is never weakened — this only selects WHICH stories
// are audited. See .storybook/test-runner.ts.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const UI_PREFIX = 'packages/components/ui/';
const RUNNER = 'scripts/test-storybook.mjs';

/** Paths whose blast radius is every component — a change here forces the full axe run. */
const GLOBAL_MATCHERS = [
  /^\.storybook\//,
  /^packages\/components\/lib\//,
  /\.css$/,
  // Flat files directly under ui/ are the shared directives/pipes (ripple, etc.).
  /^packages\/components\/ui\/[^/]+$/,
];

/** @returns {string[]} staged paths, forward-slashed, relative to the repo root. */
function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  });
  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** @returns {string[]} `*.stories.ts` files anywhere under `dir`. */
function storyFilesIn(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...storyFilesIn(full));
    } else if (entry.endsWith('.stories.ts')) {
      found.push(entry);
    }
  }
  return found;
}

function escapeRegex(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Classify the staged paths.
 * @returns {{ global: boolean, components: string[] }}
 */
function classify(files) {
  const components = new Set();
  let global = false;

  for (const file of files) {
    if (GLOBAL_MATCHERS.some((matcher) => matcher.test(file))) {
      global = true;
      continue;
    }
    if (file.startsWith(UI_PREFIX)) {
      components.add(file.slice(UI_PREFIX.length).split('/')[0]);
    }
  }

  return { global, components: [...components].sort((a, b) => a.localeCompare(b)) };
}

/**
 * Jest `testPathPattern` regexes selecting exactly the stories of `components` —
 * ONE pattern per story file, because jest ORs its positional patterns together.
 *
 * Deliberately not a single `(a|b|c)` alternation: `@storybook/test-runner`
 * re-invokes jest through a shell, so on Windows cmd.exe reads the `|` as a PIPE
 * and the run dies with "The system cannot find the path specified" / "'b.stories.ts)$'
 * is not recognized as an internal or external command". Quoting cannot save it
 * (the arg is re-expanded a second time), so the patterns are kept free of cmd
 * metacharacters instead. Both path separators are accepted so one pattern works
 * on every platform.
 *
 * @returns {string[] | null} null when a component has no story file (→ caller falls back to the full run).
 */
function storyPatterns(components) {
  const patterns = [];
  for (const component of components) {
    const dir = join('packages', 'components', 'ui', component);
    const stories = existsSync(dir) ? storyFilesIn(dir) : [];
    if (stories.length === 0) return null;
    patterns.push(...stories.map((story) => `[/\\\\]${escapeRegex(story)}$`));
  }
  return patterns.length === 0 ? null : patterns;
}

function runAxe(runnerArgs, label) {
  console.log(`[a11y-staged] ${label}`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [RUNNER, ...runnerArgs], {
    stdio: 'inherit',
    env: { ...process.env, STORYBOOK_A11Y: '1' },
  });
  console.log(`[a11y-staged] axe finished in ${Math.round((Date.now() - started) / 1000)}s.`);
  return result.status ?? 1;
}

const { global, components } = classify(stagedFiles());

if (!global && components.length === 0) {
  console.log('[a11y-staged] no component or shared UI files staged — axe skipped.');
  process.exit(0);
}

const patterns = global ? null : storyPatterns(components);

if (global) {
  process.exit(runAxe([], 'shared/global file staged — running the FULL axe pass.'));
}

if (patterns === null) {
  process.exit(
    runAxe([], `no story file found for ${components.join(', ')} — running the FULL axe pass.`),
  );
}

process.exit(runAxe(patterns, `axe for: ${components.join(', ')}`));
