/**
 * Pure, unit-testable helpers for `check-completeness.ts`.
 *
 * Kept separate from the script (same split as `sync-registry-lib.ts`) so the
 * tricky parts — e2e coverage resolution across multi-component specs,
 * allowlist honouring, and stale-exemption detection — can be exercised by
 * vitest without touching the filesystem or git.
 */

/**
 * The two source conventions `findConventionIssues` checks per shipped component
 * file. They share the allowlist machinery with the artifacts below, keyed by the
 * file's `packages/components/ui`-relative path instead of a registry name.
 */
export type ConventionRule = 'class-input' | 'data-slot';

/** Everything an allowlist section can exempt: the three supporting artifacts, then the two conventions. */
export type Artifact = 'story' | 'demo' | 'e2e' | ConventionRule;

export const ARTIFACTS: readonly Artifact[] = ['story', 'demo', 'e2e', 'class-input', 'data-slot'];

// ── Demo page aliases ───────────────────────────────────────────────────

/**
 * Components documented by a demo page that is NOT named `<name>-demo`.
 *
 * The default rule — one component, one `<name>-demo.component.ts` — is right
 * for most of the library, but two situations make it wrong, and both are
 * deliberate design, not drift:
 *
 *  1. **Shared gallery pages.** The 24 chart components are only meaningful
 *     side by side (you pick a chart by comparing it against the others), so
 *     they share one `/charts` page; the 19 animation primitives share
 *     `/animations` for the same reason. Splitting either into one page per
 *     component would make the demo app *worse* — 43 near-empty pages a user
 *     has to click through one at a time.
 *  2. **A page whose name predates the component's.** `tree` is documented by
 *     `tree-view-demo` (routed at `/tree-view`); the page is real and complete,
 *     only its filename disagrees with the registry key.
 *
 * This map is the exhaustive, reviewable statement of those exceptions: the
 * KEY is the registry component name, the VALUE is the demo page's base name
 * (so the page file is `<value>-demo.component.ts`). Anything not listed here
 * still owes its own page.
 *
 * An entry is NOT a licence to skip the documentation — `unbackedAliases()`
 * re-checks that the aliased page actually renders the component it claims to
 * cover, so an alias for a component the shared page never mentions fails the
 * gate exactly like a missing page would.
 */
export const DEMO_PAGE_ALIASES: Readonly<Record<string, string>> = {
    // ── The /charts gallery ──
    'area-chart': 'charts',
    'bar-chart': 'charts',
    'bar-chart-drilldown': 'charts',
    'bar-race-chart': 'charts',
    boxplot: 'charts',
    'bubble-chart': 'charts',
    'bullet-chart': 'charts',
    'calendar-heatmap': 'charts',
    candlestick: 'charts',
    'chart-brush': 'charts',
    'chart-legend': 'charts',
    'chart-tooltip': 'charts',
    'column-range-chart': 'charts',
    'combo-chart': 'charts',
    'data-table-range-chart': 'charts',
    'funnel-chart': 'charts',
    'gauge-chart': 'charts',
    heatmap: 'charts',
    histogram: 'charts',
    'line-chart': 'charts',
    'org-chart': 'charts',
    'pie-chart': 'charts',
    'pie-chart-drilldown': 'charts',
    'radar-chart': 'charts',
    'scatter-chart': 'charts',
    'stacked-bar-chart': 'charts',
    treemap: 'charts',
    'waterfall-chart': 'charts',

    // ── The /animations gallery ──
    'blur-fade': 'animations',
    'flip-text': 'animations',
    'gradient-text': 'animations',
    magnetic: 'animations',
    marquee: 'animations',
    meteors: 'animations',
    'morphing-text': 'animations',
    orbit: 'animations',
    particles: 'animations',
    ripple: 'animations',
    'scroll-progress': 'animations',
    'shine-border': 'animations',
    sparkles: 'animations',
    'stagger-children': 'animations',
    'streaming-text': 'animations',
    'text-reveal': 'animations',
    'typing-animation': 'animations',
    'wobble-card': 'animations',
    'word-rotate': 'animations',

    // ── Page named before the component was ──
    tree: 'tree-view',
};

/** The demo page base name that documents `component` — itself, unless aliased. */
export function demoPageFor(component: string): string {
    return DEMO_PAGE_ALIASES[component] ?? component;
}

/** The demo MODULE basename (`<page>-demo.component`) that documents `component`. */
export function demoModuleFor(component: string): string {
    return `${demoPageFor(component)}-demo.component`;
}

/** An alias pointing at a page that does not, in fact, render the component. */
export interface UnbackedAlias {
    readonly component: string;
    readonly page: string;
    /** True when the page file itself is missing, as opposed to merely silent. */
    readonly pageMissing: boolean;
}

/**
 * Collapses hyphens and case so a component name can be looked for in demo
 * source regardless of how it is spelled there: `line-chart` is written
 * `<ui-line-chart>` in a template but `uiLineChart`-ish in a directive binding,
 * and both normalize to a string containing `linechart`.
 */
function normalizeForSearch(value: string): string {
    return value.toLowerCase().replaceAll('-', '');
}

/**
 * Aliases the shared page does not honour. Keeps `DEMO_PAGE_ALIASES` from
 * degrading into a rubber stamp: listing `funnel-chart: 'charts'` only silences
 * the gate while the charts page genuinely renders a funnel chart. If someone
 * deletes the section, the alias goes unbacked and the gate fails.
 *
 * @param readPage returns the demo page's source, or null when it is absent
 */
export function unbackedAliases(
    aliases: Readonly<Record<string, string>>,
    readPage: (page: string) => string | null,
): UnbackedAlias[] {
    const sources = new Map<string, string | null>();
    const unbacked: UnbackedAlias[] = [];

    for (const [component, page] of Object.entries(aliases)) {
        if (!sources.has(page)) sources.set(page, readPage(page));
        const source = sources.get(page) ?? null;
        if (source === null) {
            unbacked.push({ component, page, pageMissing: true });
        } else if (!normalizeForSearch(source).includes(normalizeForSearch(component))) {
            unbacked.push({ component, page, pageMissing: false });
        }
    }
    return unbacked;
}

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
export type Allowlist = Readonly<Record<Artifact, Record<string, Exemption>>>;

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
    return { story: {}, demo: {}, e2e: {}, 'class-input': {}, 'data-slot': {} };
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
    const page = demoPageFor(facts.name);
    const aliased = page !== facts.name;
    if (!facts.demoFile) {
        const expected = aliased
            ? `no demo page — DEMO_PAGE_ALIASES sends it to the shared '${page}' page, which does not exist`
            : 'no demo page (expected demo/src/app/demos/**/<name>-demo.component.ts)';
        return { component: facts.name, artifact: 'demo', kind: 'missing', detail: expected };
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
        'class-input': readExemptionMap(raw['class-input']),
        'data-slot': readExemptionMap(raw['data-slot']),
    };
}

/** A shipped `.ts` file under `packages/components/ui`, with its sibling template when it has one. */
export interface ConventionSource {
    /** Path relative to `packages/components/ui`, forward slashes. */
    readonly path: string;
    readonly ts: string;
    readonly html: string | null;
}

// ── Source conventions: `class` input and `data-slot` ───────────────────

const CLASS_INPUT_DECLARATION = /\bclass\s*=\s*input\b/;
const CLASS_INPUT_READ = /\bclass\(\)/;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * Removing a match can splice its neighbours into a new one (`<!<!-- a -->-- x -->` leaves
 * `<!-- x -->`), so a single pass is not enough: repeat until no opener is left to find.
 */
function stripUntilStable(text: string, pattern: RegExp): string {
    let current = text;
    for (let previous = ''; previous !== current; ) {
        previous = current;
        current = current.replaceAll(pattern, '');
    }
    return current;
}
/** An opening tag that is a real element — `ng-content`, `ng-container` and `ng-template` render none. */
const ELEMENT_TAG = /(?<![\w)\]])<(?!\/|ng-content\b|ng-container\b|ng-template\b)[a-z][\w-]*/i;
/** The attribute, bound (`[attr.data-slot]`) or plain — not a `[data-slot="…"]` selector that merely mentions it. */
const DATA_SLOT_ATTRIBUTE = /(?<!\[)data-slot\]?['"]?\s*[=:]/;
const CLASS_DECLARATION = /^[ \t]*(?:export )?(?:default )?(?:abstract )?class (\w+)(?: extends (\w+))?/m;
const CLASS_DECLARATIONS = new RegExp(CLASS_DECLARATION.source, 'gm');

/** Index of the quote that closes the string literal opening at `start`. */
function endOfString(text: string, start: number): number {
    const quote = text[start];
    let i = start + 1;
    while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1;
    return i;
}

const isQuote = (ch: string): boolean => ch === "'" || ch === '"' || ch === '`';

/** The text between the bracket at `open` and its partner, skipping string literals. */
function balancedBody(text: string, open: number): string {
    const opener = text[open];
    const closer = opener === '(' ? ')' : '}';
    let depth = 0;
    let i = open;
    while (i < text.length) {
        const ch = text[i];
        if (isQuote(ch)) {
            i = endOfString(text, i);
        } else if (ch === opener) {
            depth++;
        } else if (ch === closer) {
            depth--;
            if (depth === 0) return text.slice(open + 1, i);
        }
        i++;
    }
    return text.slice(open + 1);
}

/** The literal behind `key:` in a decorator body — an object's inside or a string's content; '' when absent. */
function decoratorProperty(body: string, key: string): string {
    const match = new RegExp(String.raw`(?:^|[\s,{])${key}\s*:\s*`).exec(body);
    if (!match) return '';
    const start = match.index + match[0].length;
    if (body[start] === '{') return balancedBody(body, start);
    if (!isQuote(body[start])) return '';
    return body.slice(start + 1, endOfString(body, start));
}

interface ComponentInfo {
    readonly source: ConventionSource;
    readonly parent: string | null;
    readonly template: string;
    readonly host: string;
}

function componentsIn(source: ConventionSource): ComponentInfo[] {
    return [...source.ts.matchAll(/@Component\s*\(/g)].map(decorator => {
        const open = decorator.index + decorator[0].length - 1;
        const body = balancedBody(source.ts, open);
        const declaration = CLASS_DECLARATION.exec(source.ts.slice(open + body.length + 2));
        return {
            source,
            parent: declaration?.[2] ?? null,
            template: stripUntilStable(decoratorProperty(body, 'template') || source.html || '', HTML_COMMENT),
            host: decoratorProperty(body, 'host'),
        };
    });
}

/**
 * A host that is `display: contents` (the consumer styles what it projects) or `hidden` (an
 * API-parity placeholder such as `ui-input-otp-slot`, never painted) and whose template
 * renders no element has no box for a `class` to reach.
 */
function isZeroBox(component: ComponentInfo): boolean {
    return /(?<![\w:.-])(?:contents|hidden)(?![\w-])/.test(component.host) && !ELEMENT_TAG.test(component.template);
}

/** Source files on the inheritance chain above `parent` that exist within the scanned set. */
function ancestorSources(parent: string | null, classes: ReadonlyMap<string, { parent: string | null; source: ConventionSource }>): ConventionSource[] {
    const chain: ConventionSource[] = [];
    const seen = new Set<string>();
    for (let name = parent; name !== null && !seen.has(name); ) {
        seen.add(name);
        const declared = classes.get(name);
        if (!declared) break;
        chain.push(declared.source);
        name = declared.parent;
    }
    return chain;
}

function classInputProblem(component: ComponentInfo, lineage: readonly ConventionSource[]): string | null {
    const declared = lineage.some(file => CLASS_INPUT_DECLARATION.test(file.ts));
    if (isZeroBox(component)) {
        return declared ? 'zero-box component (contents host, no element) declares a no-op class input — remove it; style what you project' : null;
    }
    if (!declared) return 'renders a box but has no class input — add one and merge it with cn()';
    const applied = lineage.some(file => CLASS_INPUT_READ.test(file.ts) || CLASS_INPUT_READ.test(file.html ?? ''));
    return applied ? null : 'class input is declared but not applied to any element';
}

/** Source with block and line comments removed, so a JSDoc example is not mistaken for the attribute. */
const withoutComments = (text: string): string => stripUntilStable(text, /\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|^[ \t]*\/\/.*$/gm);

const hasDataSlot = (source: ConventionSource): boolean =>
    DATA_SLOT_ATTRIBUTE.test(withoutComments(source.ts)) || DATA_SLOT_ATTRIBUTE.test(withoutComments(source.html ?? ''));

/**
 * Per shipped component file, two conventions from `.claude/CLAUDE.md`:
 *
 *  - **`class-input`** — a component that renders a box must declare a `class`
 *    input and apply it (read as `class()`; an inherited input counts). A
 *    zero-box component — `display: contents` host, template with no element —
 *    has nothing for a class to reach, so declaring one is the defect.
 *  - **`data-slot`** — the attribute appears in the template or the host.
 *
 * Issues are keyed by the file's `ui/`-relative path so the allowlist can exempt
 * them like any other artifact. Static text scan, no TypeScript program: cheap
 * enough for the CLI test leg that runs on every push.
 */
export function findConventionIssues(sources: readonly ConventionSource[]): Issue[] {
    const classes = new Map<string, { parent: string | null; source: ConventionSource }>();
    for (const source of sources) {
        for (const match of source.ts.matchAll(CLASS_DECLARATIONS)) {
            classes.set(match[1], { parent: match[2] ?? null, source });
        }
    }

    const issues = new Map<string, Issue>();
    const report = (component: string, artifact: ConventionRule, detail: string): void => {
        issues.set(`${artifact}\0${component}`, { component, artifact, kind: 'missing', detail });
    };
    for (const source of sources) {
        for (const component of componentsIn(source)) {
            const lineage = [source, ...ancestorSources(component.parent, classes)];
            const problem = classInputProblem(component, lineage);
            if (problem) report(source.path, 'class-input', problem);
            if (!hasDataSlot(source)) report(source.path, 'data-slot', 'no data-slot attribute in the template or the host');
        }
    }
    return [...issues.values()];
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
