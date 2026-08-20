import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DashboardBlockComponent } from './index';

/**
 * T-4 / UC-4 — the stat-tile extraction safety net.
 *
 * This spec is written against the block's *pre-extraction* markup and must go
 * on passing unchanged after the tiles are swapped for `<ui-stat-card>`. It
 * therefore pins the rendered result, not the source: the grid's own layout
 * classes, and — per tile, in order — the label, the value, the delta text and
 * the badge's colour treatment. Those four are exactly what a reader sees, so
 * any real visual regression in the extraction breaks this spec.
 *
 * It deliberately does NOT pin `innerHTML`: the extraction adds a
 * `display: contents` host element and a trend glyph inside the badge, neither
 * of which a reader can see, and an HTML-string snapshot would fail on both
 * while still missing a genuine colour or ordering regression.
 */

/**
 * `'missing'` is not a badge treatment the block can render — it is what
 * {@link badgeTreatment} reports when a tile has no badge at all, so that case
 * surfaces as a legible diff against the expected table instead of a TypeError.
 */
type BadgeTreatment = 'primary' | 'destructive' | 'secondary' | 'outline' | 'missing';

interface TileSnapshot {
    readonly label: string;
    readonly value: string;
    readonly delta: string;
    readonly badge: BadgeTreatment;
}

const EXPECTED_GRID_CLASSES = [
    'grid',
    'grid-cols-1',
    'gap-4',
    'sm:grid-cols-2',
    'lg:grid-cols-4',
];

/**
 * NOT A TYPO — read before "fixing" the last row.
 *
 * Churn rate falls by 0.4% and is deliberately badged `primary`, not
 * `destructive`. The block's data marks it `positive: true`
 * (`dashboard.component.ts`) because falling churn is good news, so the badge
 * colour tracks whether the change is *favourable*, never the sign of the
 * delta string. A refactor that derives the trend from `delta.startsWith('-')`
 * would recolour this tile and is exactly the regression this row exists to
 * catch. If this expectation ever fails, the refactor is wrong — not this
 * table.
 */
const EXPECTED_TILES: readonly TileSnapshot[] = [
    { label: 'Revenue', value: '$45,231', delta: '+12.5%', badge: 'primary' },
    { label: 'Active users', value: '2,340', delta: '+8.1%', badge: 'primary' },
    { label: 'Orders', value: '1,210', delta: '-3.2%', badge: 'destructive' },
    { label: 'Churn rate', value: '1.8%', delta: '-0.4%', badge: 'primary' },
];

function badgeTreatment(badge: HTMLElement | null): BadgeTreatment {
    if (!badge) return 'missing';
    if (badge.classList.contains('bg-primary')) return 'primary';
    if (badge.classList.contains('bg-destructive')) return 'destructive';
    if (badge.classList.contains('bg-secondary')) return 'secondary';
    return 'outline';
}

function text(root: Element, selector: string): string {
    return root.querySelector(selector)?.textContent?.trim() ?? '';
}

describe('DashboardBlockComponent', () => {
    let fixture: ComponentFixture<DashboardBlockComponent>;
    let root: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DashboardBlockComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(DashboardBlockComponent);
        fixture.detectChanges();
        root = fixture.nativeElement as HTMLElement;
    });

    /** The stat grid is the first `.grid` in the block. */
    const statGrid = () => root.querySelector('div.grid') as HTMLElement;

    const tiles = (): TileSnapshot[] =>
        Array.from(statGrid().querySelectorAll('[data-slot="card"]')).map(card => ({
            label: text(card, '[data-slot="card-description"]'),
            value: text(card, '[data-slot="card-title"]'),
            delta: text(card, '[data-slot="badge"]'),
            badge: badgeTreatment(
                card.querySelector('[data-slot="badge"]') as HTMLElement | null,
            ),
        }));

    /** The block shell's direct `ui-card` children, in document order. */
    const sectionCards = (): HTMLElement[] => {
        const shell = root.querySelector('[data-slot="dashboard-block"]')!;
        return Array.from(shell.children).filter((el): el is HTMLElement =>
            el.matches('[data-slot="card"]'),
        );
    };

    it('renders the block shell', () => {
        expect(root.querySelector('[data-slot="dashboard-block"]')).toBeTruthy();
    });

    it('keeps the responsive stat-grid layout', () => {
        for (const cls of EXPECTED_GRID_CLASSES) {
            expect(statGrid().classList.contains(cls)).toBe(true);
        }
    });

    it('adds no competing column or gap utility to the stat grid', () => {
        const isLayoutUtility = (cls: string) => /(^|:)(grid-cols|gap)-/.test(cls);
        const actual = Array.from(statGrid().classList).filter(isLayoutUtility);
        const expected = EXPECTED_GRID_CLASSES.filter(isLayoutUtility);
        // Copy-then-sort, not `toSorted`: this repo's TS lib target predates
        // ES2023, so `toSorted` does not typecheck. The explicit comparator is
        // sonarjs/no-alphabetical-sort.
        const byName = (a: string, b: string) => a.localeCompare(b);
        expect([...actual].sort(byName)).toEqual([...expected].sort(byName));
    });

    it('renders exactly four stat tiles', () => {
        expect(statGrid().querySelectorAll('[data-slot="card"]')).toHaveLength(4);
    });

    it('renders every stat tile identically to the reference snapshot', () => {
        expect(tiles()).toEqual(EXPECTED_TILES);
    });

    it('renders each tile as a card with a header and a content region', () => {
        const cards = statGrid().querySelectorAll('[data-slot="card"]');
        for (const card of cards) {
            expect(card.querySelector('[data-slot="card-header"]')).toBeTruthy();
            expect(card.querySelector('[data-slot="card-content"]')).toBeTruthy();
        }
    });

    it('keeps the stat grid above two full-width section cards', () => {
        const cards = sectionCards();
        expect(cards).toHaveLength(2);
        expect(
            statGrid().compareDocumentPosition(cards[0]) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('still renders the revenue chart inside the first section card', () => {
        const chartCard = sectionCards()[0];
        expect(text(chartCard, '[data-slot="card-title"]')).toBe('Revenue');
        expect(chartCard.querySelector('ui-bar-chart')).toBeTruthy();
    });

    it('still renders the recent-activity table with one row per entry', () => {
        const activityCard = sectionCards()[1];
        expect(text(activityCard, '[data-slot="card-title"]')).toBe('Recent activity');
        const bodyRows = activityCard.querySelectorAll(
            '[data-slot="table-body"] [data-slot="table-row"]',
        );
        expect(bodyRows).toHaveLength(4);
        expect(activityCard.textContent).toContain('Ada Lovelace');
        expect(activityCard.textContent).toContain('Katherine Johnson');
    });
});
