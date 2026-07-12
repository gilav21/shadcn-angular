/**
 * Pure, unit-testable helpers for `check-completeness.ts`.
 *
 * Kept separate from the script (same split as `sync-registry-lib.ts`) so the
 * tricky parts — e2e coverage resolution across multi-component specs,
 * allowlist honouring, and stale-exemption detection — can be exercised by
 * vitest without touching the filesystem or git.
 */

/** The three supporting artifacts every component is expected to ship with. */
export type Artifact = 'story' | 'demo' | 'e2e';

export const ARTIFACTS: readonly Artifact[] = ['story', 'demo', 'e2e'];

/** What the script discovered on disk for one registry component. */
export interface ComponentFacts {
    readonly name: string;
    /** `<name>.stories.ts` (or any `*.stories.ts`) exists in the component folder. */
    readonly hasStory: boolean;
    /** Path of the demo component file, or null when none exists. */
    readonly demoFile: string | null;
    /** The demo component file is referenced by a route in `demo.routes.ts`. */
    readonly demoRouted: boolean;
    /** Component appears in some e2e spec's `names[]` (single or multi-component). */
    readonly e2eCovered: boolean;
}

export interface Issue {
    readonly component: string;
    readonly artifact: Artifact;
    readonly detail: string;
}

/** Committed grandfathering file: artifact → component → reason. */
export interface Allowlist {
    readonly story: Record<string, string>;
    readonly demo: Record<string, string>;
    readonly e2e: Record<string, string>;
}

export interface StaleExemption {
    readonly component: string;
    readonly artifact: Artifact;
}

/** Minimal shape of an e2e orchestrator spec — only `names[]` matters here. */
export interface SpecLike {
    readonly names: readonly string[];
}

export function emptyAllowlist(): Allowlist {
    return { story: {}, demo: {}, e2e: {} };
}

/**
 * Components covered by e2e, derived from the orchestrator's spec catalogue
 * rather than from harness folder names.
 *
 * Two things fall out of this for free:
 *  - Scenario harnesses (`rtl`, `dark-mode`, `a11y-form`, …) are not component
 *    names, so they never appear as coverage — and never as orphans either.
 *  - A component listed in a multi-component EXPLICIT_SPECS entry
 *    (`names: ['input','label','button','dialog']`) IS covered, even though no
 *    `e2e/harness/<name>/` folder bears its name.
 */
export function componentsCoveredByE2e(specs: readonly SpecLike[]): Set<string> {
    const covered = new Set<string>();
    for (const spec of specs) {
        for (const name of spec.names) covered.add(name);
    }
    return covered;
}

function demoIssue(facts: ComponentFacts): Issue | null {
    if (!facts.demoFile) {
        return {
            component: facts.name,
            artifact: 'demo',
            detail: 'no demo page (expected demo/src/app/demos/**/<name>-demo.component.ts)',
        };
    }
    if (facts.demoRouted) return null;
    return {
        component: facts.name,
        artifact: 'demo',
        detail: `orphan demo page '${facts.demoFile}' — not routed in demo/src/app/demo.routes.ts`,
    };
}

/** All completeness problems for one component, in artifact order. */
export function issuesFor(facts: ComponentFacts): Issue[] {
    const issues: Issue[] = [];
    if (!facts.hasStory) {
        issues.push({
            component: facts.name,
            artifact: 'story',
            detail: 'no *.stories.ts in packages/components/ui/<name>/',
        });
    }
    const demo = demoIssue(facts);
    if (demo) issues.push(demo);
    if (!facts.e2eCovered) {
        issues.push({
            component: facts.name,
            artifact: 'e2e',
            detail: 'no e2e coverage — run `npm run e2e:scaffold -- <name>`',
        });
    }
    return issues;
}

export function findIssues(components: readonly ComponentFacts[]): Issue[] {
    return components.flatMap(issuesFor);
}

export interface Partitioned {
    /** Issues that fail the gate. */
    readonly errors: Issue[];
    /** Issues silenced by a committed allowlist entry. */
    readonly exempt: Issue[];
}

/** Splits issues into gate failures and grandfathered exemptions. */
export function partitionIssues(issues: readonly Issue[], allowlist: Allowlist): Partitioned {
    const errors: Issue[] = [];
    const exempt: Issue[] = [];
    for (const issue of issues) {
        if (Object.hasOwn(allowlist[issue.artifact], issue.component)) exempt.push(issue);
        else errors.push(issue);
    }
    return { errors, exempt };
}

/**
 * Allowlist entries whose artifact now exists — the exemption is dead weight
 * and must be deleted, otherwise the allowlist never shrinks and the ratchet
 * never tightens.
 */
export function staleExemptions(issues: readonly Issue[], allowlist: Allowlist): StaleExemption[] {
    const live = new Set(issues.map(i => `${i.artifact}\0${i.component}`));
    const stale: StaleExemption[] = [];
    for (const artifact of ARTIFACTS) {
        for (const component of Object.keys(allowlist[artifact])) {
            if (!live.has(`${artifact}\0${component}`)) stale.push({ component, artifact });
        }
    }
    return stale;
}

export function allowlistSize(allowlist: Allowlist): number {
    return ARTIFACTS.reduce((sum, a) => sum + Object.keys(allowlist[a]).length, 0);
}

/** Builds a fresh allowlist that grandfathers exactly today's issues (`--seed`). */
export function seedAllowlist(issues: readonly Issue[], reason: string): Allowlist {
    const allowlist = emptyAllowlist();
    for (const issue of issues) {
        allowlist[issue.artifact][issue.component] = reason;
    }
    return allowlist;
}

function readReasonMap(value: unknown): Record<string, string> {
    if (typeof value !== 'object' || value === null) return {};
    const out: Record<string, string> = {};
    for (const [key, reason] of Object.entries(value as Record<string, unknown>)) {
        out[key] = typeof reason === 'string' ? reason : '';
    }
    return out;
}

/** Tolerant parse of the committed allowlist JSON — unknown shapes degrade to empty. */
export function parseAllowlist(source: string): Allowlist {
    const raw = JSON.parse(source) as Record<string, unknown>;
    return {
        story: readReasonMap(raw.story),
        demo: readReasonMap(raw.demo),
        e2e: readReasonMap(raw.e2e),
    };
}
