import { describe, it, expect } from 'vitest';
import {
    allowlistSize,
    componentsCoveredByE2e,
    emptyAllowlist,
    findIssues,
    parseAllowlist,
    partitionIssues,
    seedAllowlist,
    staleExemptions,
    type Allowlist,
    type ComponentFacts,
} from './check-completeness-lib';

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
    const allowlist: Allowlist = { story: {}, demo: {}, e2e: { kanban: 'legacy backlog' } };

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
        const allowlist: Allowlist = { story: {}, demo: {}, e2e: { kanban: 'backlog' } };
        const issues = findIssues([facts({ name: 'kanban' })]); // now fully covered
        expect(staleExemptions(issues, allowlist)).toEqual([{ component: 'kanban', artifact: 'e2e' }]);
    });

    it('keeps an exemption that is still needed', () => {
        const allowlist: Allowlist = { story: {}, demo: {}, e2e: { kanban: 'backlog' } };
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
        expect(seeded.e2e.kanban).toBe('grandfathered');
        const { errors, exempt } = partitionIssues(today, seeded);
        expect(errors).toEqual([]);
        expect(exempt).toHaveLength(3);
        expect(staleExemptions(today, seeded)).toEqual([]);
    });

    it('round-trips through JSON and tolerates missing sections', () => {
        const parsed = parseAllowlist(JSON.stringify({ e2e: { kanban: 'backlog' } }));
        expect(parsed.story).toEqual({});
        expect(parsed.e2e.kanban).toBe('backlog');
        expect(allowlistSize(parsed)).toBe(1);
    });
});
