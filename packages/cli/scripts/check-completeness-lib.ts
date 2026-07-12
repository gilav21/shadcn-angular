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

/**
 * The FAILURE MODE, not just the artifact. One artifact can fail two ways — a
 * demo page can be absent (`missing`) or present-but-unrouted (`orphan`) — and
 * an exemption for one must not silence the other, or a component grandfathered
 * for "no demo page" that later gains an UNROUTED demo page keeps its exemption
 * and the orphan-route regression ships silently.
 */
export type IssueKind = 'missing' | 'orphan';

export interface Issue {
    readonly component: string;
    readonly artifact: Artifact;
    readonly kind: IssueKind;
    readonly detail: string;
}

/** One grandfathered exemption: silences exactly one (artifact, component, kind). */
export interface Exemption {
    readonly reason: string;
    readonly kind: IssueKind;
}

/** Committed grandfathering file: artifact → component → exemption. */
export interface Allowlist {
    readonly story: Record<string, Exemption>;
    readonly demo: Record<string, Exemption>;
    readonly e2e: Record<string, Exemption>;
}

export interface StaleExemption {
    readonly component: string;
    readonly artifact: Artifact;
    readonly kind: IssueKind;
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
            kind: 'missing',
            detail: 'no demo page (expected demo/src/app/demos/**/<name>-demo.component.ts)',
        };
    }
    if (facts.demoRouted) return null;
    return {
        component: facts.name,
        artifact: 'demo',
        kind: 'orphan',
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
            kind: 'missing',
            detail: 'no *.stories.ts in packages/components/ui/<name>/',
        });
    }
    const demo = demoIssue(facts);
    if (demo) issues.push(demo);
    if (!facts.e2eCovered) {
        issues.push({
            component: facts.name,
            artifact: 'e2e',
            kind: 'missing',
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

/**
 * Splits issues into gate failures and grandfathered exemptions.
 *
 * An exemption silences only the exact failure mode it was granted for: a
 * component grandfathered for a MISSING demo page that later grows an ORPHAN
 * (unrouted) demo page is a different issue kind, so the exemption no longer
 * applies and the gate fails — which is the whole point of the allowlist being
 * a ratchet.
 */
export function partitionIssues(issues: readonly Issue[], allowlist: Allowlist): Partitioned {
    const errors: Issue[] = [];
    const exempt: Issue[] = [];
    for (const issue of issues) {
        const entry = allowlist[issue.artifact][issue.component];
        if (entry?.kind === issue.kind) exempt.push(issue);
        else errors.push(issue);
    }
    return { errors, exempt };
}

function issueKey(artifact: Artifact, component: string, kind: IssueKind): string {
    return `${artifact}\0${component}\0${kind}`;
}

/**
 * Allowlist entries that no longer match a live issue — the artifact now exists,
 * or its failure mode changed. Either way the exemption is dead weight and must
 * be deleted, otherwise the allowlist never shrinks and the ratchet never
 * tightens.
 */
export function staleExemptions(issues: readonly Issue[], allowlist: Allowlist): StaleExemption[] {
    const live = new Set(issues.map(i => issueKey(i.artifact, i.component, i.kind)));
    const stale: StaleExemption[] = [];
    for (const artifact of ARTIFACTS) {
        for (const [component, entry] of Object.entries(allowlist[artifact])) {
            if (!live.has(issueKey(artifact, component, entry.kind))) {
                stale.push({ component, artifact, kind: entry.kind });
            }
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
        allowlist[issue.artifact][issue.component] = { reason, kind: issue.kind };
    }
    return allowlist;
}

function readExemption(value: unknown): Exemption {
    if (typeof value === 'string') return { reason: value, kind: 'missing' };
    if (typeof value !== 'object' || value === null) return { reason: '', kind: 'missing' };
    const entry = value as Record<string, unknown>;
    return {
        reason: typeof entry['reason'] === 'string' ? entry['reason'] : '',
        kind: entry['kind'] === 'orphan' ? 'orphan' : 'missing',
    };
}

function readExemptionMap(value: unknown): Record<string, Exemption> {
    if (typeof value !== 'object' || value === null) return {};
    const out: Record<string, Exemption> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        out[key] = readExemption(entry);
    }
    return out;
}

/**
 * Tolerant parse of the committed allowlist JSON — unknown shapes degrade to
 * empty. A bare string value is the legacy form and means the `missing` kind.
 */
export function parseAllowlist(source: string): Allowlist {
    const raw = JSON.parse(source) as Record<string, unknown>;
    return {
        story: readExemptionMap(raw['story']),
        demo: readExemptionMap(raw['demo']),
        e2e: readExemptionMap(raw['e2e']),
    };
}

/** The committed JSON form: `missing` stays a bare string, `orphan` carries its kind. */
export function serializeAllowlist(allowlist: Allowlist): string {
    const out: Record<string, Record<string, string | Exemption>> = {};
    for (const artifact of ARTIFACTS) {
        const entries: Record<string, string | Exemption> = {};
        for (const [component, entry] of Object.entries(allowlist[artifact])) {
            entries[component] = entry.kind === 'missing' ? entry.reason : entry;
        }
        out[artifact] = entries;
    }
    return JSON.stringify(out, null, 2) + '\n';
}
