import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
    copyScripts,
    createRepo,
    fixtureScript,
    gitInitCommit,
    removeRepo,
    runScript,
    write,
    type Run,
} from './repo-fixtures';
import {
    DEMO_PAGE_ALIASES,
    allowlistSize,
    componentsCoveredByE2e,
    demoModuleFor,
    demoPageFor,
    emptyAllowlist,
    findIssues,
    parseAllowlist,
    partitionIssues,
    seedAllowlist,
    serializeAllowlist,
    staleExemptions,
    unbackedAliases,
    type Allowlist,
    type ComponentFacts,
    type Exemption,
    type IssueKind,
} from './check-completeness-lib';

function exempt(reason: string, kind: IssueKind = 'missing'): Exemption {
    return { reason, kind };
}

function facts(overrides: Partial<ComponentFacts> & { name: string }): ComponentFacts {
    return {
        hasStory: true,
        demoFile: `demo/src/app/demos/x/${overrides.name}-demo.component.ts`,
        demoRouted: true,
        e2eCovered: true,
        ...overrides,
    };
}

describe('componentsCoveredByE2e', () => {
    it('counts every component of a multi-component EXPLICIT_SPECS entry as covered', () => {
        const covered = componentsCoveredByE2e([
            { names: ['input', 'label', 'button', 'dialog'] },
            { names: ['accordion'] },
        ]);
        expect([...covered].sort((a, b) => a.localeCompare(b)))
            .toEqual(['accordion', 'button', 'dialog', 'input', 'label']);
    });

    it('never treats a scenario harness label as a component', () => {
        // `a11y-form` / `rtl` are spec LABELS, not names — they must not leak in.
        const covered = componentsCoveredByE2e([
            { names: ['input', 'label', 'button', 'dialog', 'checkbox'] }, // label: a11y-form
            { names: ['dialog', 'dropdown-menu', 'select'] },              // label: rtl
        ]);
        expect(covered.has('a11y-form')).toBe(false);
        expect(covered.has('rtl')).toBe(false);
        expect(covered.has('checkbox')).toBe(true);
    });
});

describe('findIssues', () => {
    it('reports nothing for a complete component', () => {
        expect(findIssues([facts({ name: 'button' })])).toEqual([]);
    });

    it('reports a missing story', () => {
        const issues = findIssues([facts({ name: 'button', hasStory: false })]);
        expect(issues).toHaveLength(1);
        expect(issues[0].artifact).toBe('story');
    });

    it('reports a missing demo page', () => {
        const issues = findIssues([facts({ name: 'tour', demoFile: null, demoRouted: false })]);
        expect(issues).toHaveLength(1);
        expect(issues[0].artifact).toBe('demo');
        expect(issues[0].detail).toContain('no demo page');
    });

    it('reports an unrouted demo page as a silent orphan', () => {
        const issues = findIssues([facts({ name: 'tour', demoRouted: false })]);
        expect(issues).toHaveLength(1);
        expect(issues[0].artifact).toBe('demo');
        expect(issues[0].detail).toContain('not routed');
    });

    it('reports missing e2e coverage', () => {
        const issues = findIssues([facts({ name: 'kanban', e2eCovered: false })]);
        expect(issues.map(i => i.artifact)).toEqual(['e2e']);
    });

    it('reports every gap of a fully bare component', () => {
        const issues = findIssues([
            facts({ name: 'bare', hasStory: false, demoFile: null, demoRouted: false, e2eCovered: false }),
        ]);
        expect(issues.map(i => i.artifact)).toEqual(['story', 'demo', 'e2e']);
    });
});

describe('partitionIssues', () => {
    const allowlist: Allowlist = { story: {}, demo: {}, e2e: { kanban: exempt('legacy backlog') } };

    it('silences an allowlisted issue and fails an un-allowlisted one', () => {
        const issues = findIssues([
            facts({ name: 'kanban', e2eCovered: false }),
            facts({ name: 'brand-new', e2eCovered: false }),
        ]);
        const { errors, exempt } = partitionIssues(issues, allowlist);
        expect(exempt.map(i => i.component)).toEqual(['kanban']);
        expect(errors.map(i => i.component)).toEqual(['brand-new']);
    });

    it('does not silence a different artifact for an allowlisted component', () => {
        const issues = findIssues([facts({ name: 'kanban', hasStory: false, e2eCovered: false })]);
        const { errors, exempt } = partitionIssues(issues, allowlist);
        expect(errors.map(i => i.artifact)).toEqual(['story']);
        expect(exempt.map(i => i.artifact)).toEqual(['e2e']);
    });

    it('ignores everything when the allowlist is empty (--strict)', () => {
        const issues = findIssues([facts({ name: 'kanban', e2eCovered: false })]);
        expect(partitionIssues(issues, emptyAllowlist()).errors).toHaveLength(1);
    });
});

describe('staleExemptions', () => {
    it('flags an exemption whose artifact now exists', () => {
        const allowlist: Allowlist = { story: {}, demo: {}, e2e: { kanban: exempt('backlog') } };
        const issues = findIssues([facts({ name: 'kanban' })]); // now fully covered
        expect(staleExemptions(issues, allowlist))
            .toEqual([{ component: 'kanban', artifact: 'e2e', kind: 'missing' }]);
    });

    it('keeps an exemption that is still needed', () => {
        const allowlist: Allowlist = { story: {}, demo: {}, e2e: { kanban: exempt('backlog') } };
        const issues = findIssues([facts({ name: 'kanban', e2eCovered: false })]);
        expect(staleExemptions(issues, allowlist)).toEqual([]);
    });
});

describe('seedAllowlist / allowlistSize / parseAllowlist', () => {
    it('seeds exactly today\'s issues, so the gate then passes clean', () => {
        const today = findIssues([
            facts({ name: 'kanban', e2eCovered: false }),
            facts({ name: 'tour', hasStory: false, e2eCovered: false }),
        ]);
        const seeded = seedAllowlist(today, 'grandfathered');
        expect(allowlistSize(seeded)).toBe(3);
        expect(seeded.e2e['kanban']).toEqual({ reason: 'grandfathered', kind: 'missing' });
        const { errors, exempt } = partitionIssues(today, seeded);
        expect(errors).toEqual([]);
        expect(exempt).toHaveLength(3);
        expect(staleExemptions(today, seeded)).toEqual([]);
    });

    it('round-trips through JSON and tolerates missing sections', () => {
        const parsed = parseAllowlist(JSON.stringify({ e2e: { kanban: 'backlog' } }));
        expect(parsed.story).toEqual({});
        // The legacy bare-string form means the `missing` kind.
        expect(parsed.e2e['kanban']).toEqual({ reason: 'backlog', kind: 'missing' });
        expect(allowlistSize(parsed)).toBe(1);
    });

    it('round-trips an orphan-kind exemption through the committed JSON form', () => {
        const seeded = seedAllowlist(findIssues([facts({ name: 'tour', demoRouted: false })]), 'debt');
        expect(seeded.demo['tour']).toEqual({ reason: 'debt', kind: 'orphan' });

        const json = serializeAllowlist(seeded);
        // `missing` stays a bare string; `orphan` must carry its kind or it would
        // parse back as `missing` and silence the wrong failure mode.
        expect(JSON.parse(json).demo.tour).toEqual({ reason: 'debt', kind: 'orphan' });
        expect(parseAllowlist(json)).toEqual(seeded);
    });
});

// Regression (review finding #6): an exemption is keyed by the FAILURE MODE, not
// just the artifact — otherwise a component grandfathered for "no demo page" that
// later gains an UNROUTED demo page keeps its exemption and the orphan-route
// regression ships silenced.
describe('exemptions are kind-scoped', () => {
    const grandfathered: Allowlist = {
        story: {},
        demo: { tour: exempt('grandfathered: no demo page', 'missing') },
        e2e: {},
    };

    it('does NOT silence an orphan demo page for a component exempted for a MISSING one', () => {
        const issues = findIssues([facts({ name: 'tour', demoRouted: false })]); // demo now exists, unrouted
        const { errors, exempt: silenced } = partitionIssues(issues, grandfathered);

        expect(silenced).toEqual([]);
        expect(errors).toHaveLength(1);
        expect(errors[0].kind).toBe('orphan');
        expect(errors[0].detail).toContain('not routed');
    });

    it('reports the now-mismatched exemption as stale', () => {
        const issues = findIssues([facts({ name: 'tour', demoRouted: false })]);
        expect(staleExemptions(issues, grandfathered))
            .toEqual([{ component: 'tour', artifact: 'demo', kind: 'missing' }]);
    });

    it('still silences the exact failure mode it was granted for', () => {
        const issues = findIssues([facts({ name: 'tour', demoFile: null, demoRouted: false })]);
        const { errors, exempt: silenced } = partitionIssues(issues, grandfathered);
        expect(errors).toEqual([]);
        expect(silenced).toHaveLength(1);
        expect(staleExemptions(issues, grandfathered)).toEqual([]);
    });
});

describe('demo page aliases', () => {
    it('resolves an unaliased component to its own demo page', () => {
        expect(demoPageFor('button')).toBe('button');
        expect(demoModuleFor('button')).toBe('button-demo.component');
    });

    it('resolves an aliased component to the shared gallery page', () => {
        expect(demoPageFor('funnel-chart')).toBe('charts');
        expect(demoModuleFor('funnel-chart')).toBe('charts-demo.component');
        expect(demoModuleFor('marquee')).toBe('animations-demo.component');
    });

    it('resolves a component whose page was named before it was', () => {
        expect(demoModuleFor('tree')).toBe('tree-view-demo.component');
    });

    it('counts an aliased component as covered when the shared page is routed', () => {
        const shared = facts({
            name: 'funnel-chart',
            demoFile: 'demo/src/app/demos/charts/charts-demo.component.ts',
            demoRouted: true,
        });
        expect(findIssues([shared])).toEqual([]);
    });

    it('still reports an aliased component whose shared page is unrouted', () => {
        const orphaned = facts({
            name: 'funnel-chart',
            demoFile: 'demo/src/app/demos/charts/charts-demo.component.ts',
            demoRouted: false,
        });
        const [issue] = findIssues([orphaned]);
        expect(issue.artifact).toBe('demo');
        expect(issue.kind).toBe('orphan');
    });

    it('names the shared page when an aliased component has no page at all', () => {
        const [issue] = findIssues([facts({ name: 'funnel-chart', demoFile: null })]);
        expect(issue.kind).toBe('missing');
        expect(issue.detail).toContain("shared 'charts' page");
    });
});

describe('unbackedAliases', () => {
    const aliases = { 'funnel-chart': 'charts', marquee: 'animations' };

    it('accepts an alias whose shared page renders the component', () => {
        const pages: Record<string, string> = {
            charts: '<ui-funnel-chart [data]="d" />',
            animations: '<ui-marquee>scrolling</ui-marquee>',
        };
        expect(unbackedAliases(aliases, page => pages[page] ?? null)).toEqual([]);
    });

    it('matches a directive spelling that drops the hyphens', () => {
        const pages: Record<string, string> = {
            charts: '<ui-funnel-chart />',
            animations: '<button uiMarquee></button>',
        };
        expect(unbackedAliases(aliases, page => pages[page] ?? null)).toEqual([]);
    });

    it('rejects an alias whose shared page never mentions the component', () => {
        const pages: Record<string, string> = {
            charts: '<ui-line-chart />',
            animations: '<ui-marquee />',
        };
        expect(unbackedAliases(aliases, page => pages[page] ?? null)).toEqual([
            { component: 'funnel-chart', page: 'charts', pageMissing: false },
        ]);
    });

    it('rejects an alias pointing at a page that does not exist', () => {
        expect(unbackedAliases(aliases, () => null)).toEqual([
            { component: 'funnel-chart', page: 'charts', pageMissing: true },
            { component: 'marquee', page: 'animations', pageMissing: true },
        ]);
    });

    it('reads each shared page once, however many components alias to it', () => {
        const reads: string[] = [];
        unbackedAliases({ a: 'charts', b: 'charts', c: 'charts' }, page => {
            reads.push(page);
            return 'a b c';
        });
        expect(reads).toEqual(['charts']);
    });
});

describe('DEMO_PAGE_ALIASES', () => {
    it('points every alias at one of the known shared pages', () => {
        const pages = new Set(Object.values(DEMO_PAGE_ALIASES));
        expect([...pages].sort((a, b) => a.localeCompare(b)))
            .toEqual(['animations', 'charts', 'tree-view']);
    });

    it('never aliases a component to itself', () => {
        for (const [component, page] of Object.entries(DEMO_PAGE_ALIASES)) {
            expect(page).not.toBe(component);
        }
    });
});

// ── The entry script (subprocess, fixture repo) ──────────────────────────
//
// The gate resolves every root from its OWN file location, so it cannot be
// pointed at a temp tree: run in place it reads the real registry, the real
// ui/ folder and the real demo routes, and `--seed` REWRITES the committed
// allowlist. To seed a real gap and assert a real exit code, the script is
// copied into a throwaway repo (see repo-fixtures.ts) whose registry has two
// components: `alpha` (complete) and, optionally, `beta` (no story, no demo
// page, no e2e).

interface Fixture {
    readonly root: string;
    readonly allowlist: string;
}

function registrySource(withBeta: boolean): string {
    const beta = `  beta: {
    name: 'beta',
    category: 'utility',
    description: 'Beta.',
    tags: ['beta'],
    files: ['beta/beta.component.ts', 'beta/index.ts'],
  },
`;
    return `import { defineRegistry } from './define';

export const registry = defineRegistry({
  alpha: {
    name: 'alpha',
    category: 'utility',
    description: 'Alpha.',
    tags: ['alpha'],
    files: ['alpha/alpha.component.ts', 'alpha/index.ts'],
  },
${withBeta ? beta : ''}});
`;
}

/**
 * `checkAliases()` walks DEMO_PAGE_ALIASES unconditionally — every shared page
 * it names must exist AND mention each component it claims to document, or the
 * gate fails for reasons that have nothing to do with the test. So the fixture
 * generates those pages from the real alias map.
 */
function writeAliasPages(root: string): void {
    const pages = new Map<string, string[]>();
    for (const [component, page] of Object.entries(DEMO_PAGE_ALIASES)) {
        pages.set(page, [...(pages.get(page) ?? []), component]);
    }
    for (const [page, components] of pages) {
        const tags = components.map(c => `      <ui-${c} />`).join('\n');
        write(
            root,
            `demo/src/app/demos/shared/${page}-demo.component.ts`,
            `export const template = \`\n${tags}\n\`;\n`,
        );
    }
}

function seedCompletenessFixture(withBeta: boolean): Fixture {
    const root = createRepo('completeness');
    copyScripts(root, ['check-completeness.ts', 'check-completeness-lib.ts', 'sync-registry-lib.ts']);

    write(root, 'packages/cli/src/registry/define.ts',
        'export function defineRegistry<T>(r: T): T { return r; }\n');
    write(root, 'packages/cli/src/registry/index.ts', registrySource(withBeta));

    // The gate reads ALL_COMPONENTS from the orchestrator's catalogue. The real
    // one scans e2e/harness/ and validates against the real registry, so the
    // fixture supplies its own: `alpha` is covered, `beta` is not.
    write(root, 'e2e/orchestrator/specs.ts',
        "export const ALL_COMPONENTS = [{ names: ['alpha'] }];\n");

    write(root, 'packages/components/ui/alpha/alpha.component.ts', 'export const Alpha = 1;\n');
    write(root, 'packages/components/ui/alpha/alpha.stories.ts', 'export default { title: "Alpha" };\n');
    if (withBeta) {
        write(root, 'packages/components/ui/beta/beta.component.ts', 'export const Beta = 1;\n');
    }

    write(root, 'demo/src/app/demos/alpha-demo.component.ts', 'export class AlphaDemoComponent {}\n');
    writeAliasPages(root);
    write(root, 'demo/src/app/demo.routes.ts',
        "export const routes = [\n  { path: 'alpha', loadComponent: () => import('./demos/alpha-demo.component') },\n];\n");

    // checkBaselines() compares COMMIT RECENCY of each generated baseline against
    // its sources. One commit containing both sides gives them equal timestamps,
    // so nothing reads as stale and the heuristic stays out of the way.
    for (const name of ['component', 'lib', 'legacy']) {
        write(root, `packages/cli/src/registry/${name}-baselines.ts`, 'export const baselines = {};\n');
    }
    write(root, 'packages/components/lib/utils.ts', 'export const cn = (s: string) => s;\n');
    gitInitCommit(root);

    return { root, allowlist: path.join(root, 'packages/components/completeness-allowlist.json') };
}

const BETA_EXEMPTIONS = JSON.stringify({
    story: { beta: 'grandfathered' },
    demo: { beta: 'grandfathered' },
    e2e: { beta: 'grandfathered' },
}, null, 2);

describe('check-completeness entry (fixture repo)', () => {
    let fixture: Fixture | null = null;

    afterEach(() => {
        if (fixture) removeRepo(fixture.root);
        fixture = null;
    });

    function run(withBeta: boolean, args: readonly string[] = []): Run {
        fixture = seedCompletenessFixture(withBeta);
        return runScript(fixtureScript(fixture.root, 'check-completeness.ts'), args);
    }

    it('exits 0 and passes the gate when every component is complete', () => {
        const { status, stdout } = run(false, ['--strict']);

        expect(status).toBe(0);
        expect(stdout).toContain('Checking 1 components');
        expect(stdout).toContain('Completeness gate passed.');
    }, 60_000);

    it('--strict exits 1 and names every missing artifact of the seeded gap', () => {
        const { status, output } = run(true, ['--strict']);

        expect(status).toBe(1);
        expect(output).toContain('beta [story]');
        expect(output).toContain('beta [demo]');
        expect(output).toContain('beta [e2e]');
        expect(output).toContain('Completeness gate FAILED.');
    }, 60_000);

    it('honours the allowlist by default, and ignores it under --strict', () => {
        fixture = seedCompletenessFixture(true);
        writeFileSync(fixture.allowlist, BETA_EXEMPTIONS);
        const script = fixtureScript(fixture.root, 'check-completeness.ts');

        const allowed = runScript(script);
        expect(allowed.status).toBe(0);
        expect(allowed.stdout).toContain('3 grandfathered exemption(s)');
        expect(allowed.stdout).toContain('Completeness gate passed.');

        const strict = runScript(script, ['--strict']);
        expect(strict.status).toBe(1);
        expect(strict.output).toContain('Completeness gate FAILED.');
    }, 60_000);

    it('--seed writes the gap into the allowlist file', () => {
        const { status, stdout } = run(true, ['--seed']);

        expect(status).toBe(0);
        expect(stdout).toContain('Seeded 3 exemption(s)');

        const seeded = JSON.parse(readFileSync(fixture!.allowlist, 'utf-8')) as Record<string, Record<string, unknown>>;
        expect(Object.keys(seeded['story'])).toEqual(['beta']);
        expect(Object.keys(seeded['demo'])).toEqual(['beta']);
        expect(Object.keys(seeded['e2e'])).toEqual(['beta']);
    }, 60_000);

    it('fails the gate when an allowlist entry no longer matches a live issue', () => {
        fixture = seedCompletenessFixture(false);
        writeFileSync(fixture.allowlist, BETA_EXEMPTIONS);

        const { status, output } = runScript(fixtureScript(fixture.root, 'check-completeness.ts'));

        expect(status).toBe(1);
        expect(output).toContain('Stale allowlist entries');
        expect(output).toContain('beta [story: missing]');
    }, 60_000);
});
