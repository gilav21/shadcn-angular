#!/usr/bin/env tsx
/**
 * Completeness gate: every registry component must ship a Storybook story, a
 * ROUTED demo page, and e2e coverage. Report-only — exits 1 on drift, like
 * `sync-registry.ts` (which it borrows its registry parser from).
 *
 * Scope: `type: 'component'` entries only.
 *  - Blocks (`packages/blocks/`) are composed pages, not library components:
 *    they have no `ui/<name>/` folder, no story convention and no scaffolder.
 *  - Addons (`data-table/export`, …) ship inside their parent's folder and are
 *    exercised through the parent's demo/story; their e2e coverage already
 *    rides on multi-component EXPLICIT_SPECS entries.
 *  Both are exempt from all three checks.
 *
 * e2e coverage is resolved from the orchestrator's spec catalogue
 * (`e2e/orchestrator/specs.ts`), never from harness folder names — so scenario
 * harnesses (`rtl`, `dark-mode`, …) are not mistaken for components, and a
 * component covered only by a multi-component spec still counts as covered.
 *
 * Usage:
 *   npx tsx packages/cli/scripts/check-completeness.ts            # gate (honours allowlist)
 *   npx tsx packages/cli/scripts/check-completeness.ts --strict   # ignore allowlist: true backlog
 *   npx tsx packages/cli/scripts/check-completeness.ts --seed     # rewrite allowlist from today's state
 */

import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRegistrySource, type RegistryEntry } from './sync-registry-lib';
import { ALL_COMPONENTS } from '../../../e2e/orchestrator/specs';
import {
    ARTIFACTS,
    allowlistSize,
    componentsCoveredByE2e,
    emptyAllowlist,
    findIssues,
    parseAllowlist,
    partitionIssues,
    seedAllowlist,
    serializeAllowlist,
    staleExemptions,
    type Allowlist,
    type Artifact,
    type ComponentFacts,
    type Issue,
    type StaleExemption,
} from './check-completeness-lib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const REGISTRY_PATH = path.resolve(SCRIPT_DIR, '../src/registry/index.ts');
const UI_ROOT = path.resolve(REPO_ROOT, 'packages/components/ui');
const DEMOS_ROOT = path.resolve(REPO_ROOT, 'demo/src/app/demos');
const DEMO_ROUTES = path.resolve(REPO_ROOT, 'demo/src/app/demo.routes.ts');
const ALLOWLIST_PATH = path.resolve(REPO_ROOT, 'packages/components/completeness-allowlist.json');

const SEED_REASON = 'grandfathered: pre-existing gap when the completeness gate was introduced';

const IMPORT_PATH_REGEX = /import\('([^']+)'\)/g;

// ── Disk facts ──────────────────────────────────────────────────────────

function hasStory(name: string): boolean {
    const folder = path.join(UI_ROOT, name);
    if (existsSync(folder)) {
        return readdirSync(folder).some(f => f.endsWith('.stories.ts'));
    }
    return existsSync(path.join(UI_ROOT, `${name}.stories.ts`));
}

/** Maps `<x>-demo.component` → repo-relative demo file path, recursively. */
function indexDemoFiles(dir: string, out: Map<string, string>): Map<string, string> {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            indexDemoFiles(full, out);
        } else if (entry.name.endsWith('-demo.component.ts')) {
            out.set(entry.name.slice(0, -3), path.relative(REPO_ROOT, full).replaceAll('\\', '/'));
        }
    }
    return out;
}

/** Basenames of every lazily-routed component module in `demo.routes.ts`. */
function routedDemoModules(): Set<string> {
    const source = readFileSync(DEMO_ROUTES, 'utf-8');
    const routed = new Set<string>();
    for (const match of source.matchAll(IMPORT_PATH_REGEX)) {
        routed.add(path.posix.basename(match[1]));
    }
    return routed;
}

function collectFacts(entries: readonly RegistryEntry[]): ComponentFacts[] {
    const demoFiles = indexDemoFiles(DEMOS_ROOT, new Map());
    const routed = routedDemoModules();
    const e2eCovered = componentsCoveredByE2e(ALL_COMPONENTS);

    return entries.map(entry => {
        const moduleName = `${entry.name}-demo.component`;
        const demoFile = demoFiles.get(moduleName) ?? null;
        return {
            name: entry.name,
            hasStory: hasStory(entry.name),
            demoFile,
            demoRouted: demoFile !== null && routed.has(moduleName),
            e2eCovered: e2eCovered.has(entry.name),
        };
    });
}

// ── Allowlist ───────────────────────────────────────────────────────────

function loadAllowlist(): Allowlist {
    if (!existsSync(ALLOWLIST_PATH)) return emptyAllowlist();
    return parseAllowlist(readFileSync(ALLOWLIST_PATH, 'utf-8'));
}

function writeAllowlist(allowlist: Allowlist): void {
    writeFileSync(ALLOWLIST_PATH, serializeAllowlist(allowlist));
    console.log(
        `Seeded ${allowlistSize(allowlist)} exemption(s) into ` +
        `${path.relative(REPO_ROOT, ALLOWLIST_PATH).replaceAll('\\', '/')}.`,
    );
}

// ── Baselines freshness (heuristic) ─────────────────────────────────────

interface BaselineCheck {
    readonly generated: string;
    readonly script: string;
    readonly sources: readonly string[];
}

const BASELINE_CHECKS: readonly BaselineCheck[] = [
    {
        generated: 'packages/cli/src/registry/component-baselines.ts',
        script: 'gen-component-baselines.mjs',
        sources: [
            'packages/components/ui',
            ':(exclude)packages/components/ui/**/*.spec.ts',
            ':(exclude)packages/components/ui/**/*.stories.ts',
        ],
    },
    {
        generated: 'packages/cli/src/registry/lib-baselines.ts',
        script: 'gen-lib-baselines.mjs',
        sources: ['packages/components/lib', ':(exclude)packages/components/lib/**/*.spec.ts'],
    },
    {
        generated: 'packages/cli/src/registry/legacy-baselines.ts',
        script: 'gen-legacy-baselines.mjs',
        sources: ['packages/components/ui/*.component.ts'],
    },
];

function lastCommitTime(pathspecs: readonly string[]): number {
    const out = execFileSync('git', ['-C', REPO_ROOT, 'log', '-1', '--format=%ct', '--', ...pathspecs], {
        encoding: 'utf-8',
    }).trim();
    return out ? Number.parseInt(out, 10) : 0;
}

/**
 * HEURISTIC, not a proof. Regenerating the baselines mines every historical
 * blob of every source file (minutes of `git show`), so the gate does not do
 * it. Instead it compares commit recency: if a baseline's SOURCES were last
 * committed after the GENERATED file was, the baseline is *probably* stale.
 *
 * False positives are possible (a source commit that adds no new canonical
 * hash — e.g. a pure file move). False negatives are not: any content change
 * lands in a commit newer than the generated file's. Treat a hit as "re-run the
 * generator and see if it produces a diff", never as a confirmed drift.
 */
function checkBaselines(): string[] {
    const stale: string[] = [];
    for (const check of BASELINE_CHECKS) {
        const generatedAt = lastCommitTime([check.generated]);
        const sourceAt = lastCommitTime(check.sources);
        if (sourceAt > generatedAt) {
            stale.push(
                `  ${check.generated} — sources committed after it; re-run ` +
                `\`npm run build && node scripts/${check.script}\` from packages/cli and commit any diff`,
            );
        }
    }
    return stale;
}

// ── Reporting ───────────────────────────────────────────────────────────

function countByArtifact(issues: readonly Issue[]): Map<Artifact, number> {
    const counts = new Map<Artifact, number>(ARTIFACTS.map(a => [a, 0]));
    for (const issue of issues) counts.set(issue.artifact, (counts.get(issue.artifact) ?? 0) + 1);
    return counts;
}

function reportIssues(label: string, issues: readonly Issue[]): void {
    if (issues.length === 0) return;
    console.error(`\n${label}`);
    for (const issue of issues) {
        console.error(`  ${issue.component} [${issue.artifact}]: ${issue.detail}`);
    }
}

function reportSummary(issues: readonly Issue[]): void {
    const counts = countByArtifact(issues);
    console.log(
        `  missing stories: ${counts.get('story')} | ` +
        `missing/orphan demo routes: ${counts.get('demo')} | ` +
        `missing e2e coverage: ${counts.get('e2e')}`,
    );
}

// ── Main ────────────────────────────────────────────────────────────────

function isComponentEntry(entry: RegistryEntry): boolean {
    return !entry.isBlock && !entry.name.includes('/');
}

function reportExemptions(exempt: readonly Issue[]): void {
    if (exempt.length === 0) return;
    console.log(
        `\n${exempt.length} grandfathered exemption(s) in ` +
        `packages/components/completeness-allowlist.json — THIS IS DEBT. ` +
        `Run with --strict to see the full backlog.`,
    );
}

function reportStale(stale: readonly StaleExemption[]): void {
    if (stale.length === 0) return;
    console.error(
        '\nStale allowlist entries — no live issue matches them any more (the artifact now ' +
        'exists, or its failure mode changed). REMOVE or re-seed the exemption:',
    );
    for (const s of stale) console.error(`  ${s.component} [${s.artifact}: ${s.kind}]`);
}

function reportBaselines(baselines: readonly string[], strict: boolean): void {
    if (baselines.length === 0) return;
    const log = strict ? console.error : console.warn;
    const prefix = strict ? '' : 'Warning: ';
    log(`\n${prefix}baselines likely stale (heuristic — commit recency, not a regenerate):`);
    for (const line of baselines) log(line);
}

function main(): void {
    const strict = process.argv.includes('--strict');
    const seed = process.argv.includes('--seed');

    const entries = parseRegistrySource(readFileSync(REGISTRY_PATH, 'utf-8')).filter(isComponentEntry);
    const issues = findIssues(collectFacts(entries));

    console.log(`Checking ${entries.length} components for story / demo route / e2e coverage...\n`);
    console.log('True backlog (ignoring the allowlist):');
    reportSummary(issues);

    if (seed) {
        writeAllowlist(seedAllowlist(issues, SEED_REASON));
        return;
    }

    const allowlist = strict ? emptyAllowlist() : loadAllowlist();
    const { errors, exempt } = partitionIssues(issues, allowlist);
    const stale = strict ? [] : staleExemptions(issues, allowlist);
    const baselines = checkBaselines();

    reportExemptions(exempt);
    reportStale(stale);
    reportIssues('Missing artifacts (not allowlisted):', errors);
    reportBaselines(baselines, strict);

    if (errors.length > 0 || stale.length > 0 || (strict && baselines.length > 0)) {
        console.error('\nCompleteness gate FAILED.');
        process.exitCode = 1;
        return;
    }
    console.log('\nCompleteness gate passed.');
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
    try {
        main();
    } catch (error: unknown) {
        console.error(error);
        process.exitCode = 1;
    }
}
