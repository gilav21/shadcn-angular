import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TreemapComponent } from './treemap.component';
import { TreemapNode } from './treemap.types';

class ResizeObserverStub {
    observe(): void {
        /* no-op: the suite never resizes, so no callbacks are wanted */
    }
    disconnect(): void {
        /* no-op */
    }
}

const originalResizeObserver = (
    globalThis as unknown as { ResizeObserver?: unknown }
).ResizeObserver;

const FLAT: TreemapNode[] = [
    { label: 'Docs', value: 120 },
    { label: 'Media', value: 80 },
    { label: 'Code', value: 60 },
    { label: 'Other', value: 40 },
];

const NESTED: TreemapNode[] = [
    {
        label: 'Docs',
        children: [
            { label: 'Specs', value: 70 },
            { label: 'Guides', value: 50 },
        ],
    },
    { label: 'Media', value: 80 },
];

describe('TreemapComponent', () => {
    let component: TreemapComponent;
    let fixture: ComponentFixture<TreemapComponent>;

    async function createFixture(nodes: TreemapNode[] = FLAT): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [TreemapComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TreemapComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('nodes', nodes);
        fixture.detectChanges();
    }

    beforeEach(() => {
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
            ResizeObserverStub;
    });

    afterEach(() => {
        (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver =
            originalResizeObserver;
    });

    // T-13: rect areas are proportional to values
    describe('T-13 proportional areas', () => {
        it('renders one rectangle per flat node', async () => {
            await createFixture();
            expect(component.cells()).toHaveLength(4);
            expect(fixture.nativeElement.querySelectorAll('[data-slot="treemap-cell"]'))
                .toHaveLength(4);
        });

        it('makes each area proportional to its value', async () => {
            await createFixture();
            const cells = component.cells();
            const docs = cells.find(c => c.node.label === 'Docs')!;
            const other = cells.find(c => c.node.label === 'Other')!;
            expect((docs.width * docs.height) / (other.width * other.height))
                .toBeCloseTo(120 / 40, 2);
        });

        it('totals the hierarchy', async () => {
            await createFixture();
            expect(component.total()).toBe(300);
        });
    });

    // T-14: nested children render nested rects
    describe('T-14 nesting', () => {
        it('renders group and child rectangles, children inside their group', async () => {
            await createFixture(NESTED);
            const cells = component.cells();
            expect(cells).toHaveLength(4);

            const group = cells.find(c => c.node.label === 'Docs')!;
            expect(group.isLeaf).toBe(false);
            for (const label of ['Specs', 'Guides']) {
                const child = cells.find(c => c.node.label === label)!;
                expect(child.depth).toBe(1);
                expect(child.x).toBeGreaterThanOrEqual(group.x - 1e-6);
                expect(child.y).toBeGreaterThanOrEqual(group.y - 1e-6);
                expect(child.x + child.width).toBeLessThanOrEqual(group.x + group.width + 1e-6);
                expect(child.y + child.height).toBeLessThanOrEqual(group.y + group.height + 1e-6);
            }
        });

        it('draws group rectangles as borders, not fills', async () => {
            await createFixture(NESTED);
            const group = component.cells().find(c => c.node.label === 'Docs')!;
            expect(group.fillOpacity).toBe(0);
            expect(component.cells().find(c => c.node.label === 'Media')!.fillOpacity)
                .toBeGreaterThan(0);
        });

        it('marks the depth and leaf state on the DOM', async () => {
            await createFixture(NESTED);
            const groups = fixture.nativeElement.querySelectorAll(
                '[data-slot="treemap-cell"]',
            );
            expect(groups[0].getAttribute('data-depth')).toBe('0');
            expect(groups[0].getAttribute('data-leaf')).toBe('false');
            expect(groups[1].getAttribute('data-depth')).toBe('1');
        });

        it('gives children their group’s colour unless they set one', async () => {
            await createFixture([
                { label: 'g', color: '#123456', children: [{ label: 'a', value: 1 }] },
            ]);
            const [group, child] = component.cells();
            expect(group.color).toBe('#123456');
            expect(child.color).toBe('#123456');
        });
    });

    // T-15: aspect ratios stay within squarified bounds
    describe('T-15 squarified aspect ratios', () => {
        it('keeps every rectangle near square rather than a sliver', async () => {
            await createFixture([
                { label: 'a', value: 50 }, { label: 'b', value: 30 }, { label: 'c', value: 20 },
                { label: 'd', value: 12 }, { label: 'e', value: 9 }, { label: 'f', value: 7 },
                { label: 'g', value: 5 }, { label: 'h', value: 4 },
            ]);
            for (const cell of component.cells()) {
                expect(Math.max(cell.width / cell.height, cell.height / cell.width))
                    .toBeLessThan(6);
            }
        });
    });

    // T-16: labels hide when the rect is too small
    describe('T-16 label suppression', () => {
        it('labels a large rectangle and hides the label on a tiny one', async () => {
            await createFixture([
                { label: 'Huge', value: 1000 },
                { label: 'Tiny', value: 1 },
            ]);
            const huge = component.cells().find(c => c.node.label === 'Huge')!;
            const tiny = component.cells().find(c => c.node.label === 'Tiny')!;
            expect(huge.showLabel).toBe(true);
            expect(tiny.showLabel).toBe(false);
            expect(fixture.nativeElement.querySelectorAll('[data-slot="treemap-label"]'))
                .toHaveLength(1);
        });

        it('honours the minimum label size inputs', async () => {
            await createFixture();
            expect(component.cells().every(c => c.showLabel)).toBe(true);
            fixture.componentRef.setInput('minLabelWidth', 10_000);
            fixture.detectChanges();
            expect(component.cells().some(c => c.showLabel)).toBe(false);
        });

        it('drops every label when showLabels is false', async () => {
            await createFixture();
            fixture.componentRef.setInput('showLabels', false);
            fixture.detectChanges();
            expect(fixture.nativeElement.querySelectorAll('[data-slot="treemap-label"]'))
                .toHaveLength(0);
        });
    });

    // T-17: click emits node data
    describe('T-17 click', () => {
        it('emits the clicked node’s data', async () => {
            await createFixture();
            const seen: TreemapNode[] = [];
            component.nodeClick.subscribe(e => seen.push(e.point));
            component.onCellClick(new MouseEvent('click'), component.cells()[0]);
            expect(seen[0].label).toBe(component.cells()[0].node.label);
        });

        it('forwards only real MouseEvents', async () => {
            await createFixture();
            const events: (MouseEvent | undefined)[] = [];
            component.nodeClick.subscribe(e => events.push(e.event));
            component.onCellClick(new MouseEvent('click'), component.cells()[0]);
            component.onCellClick(new KeyboardEvent('keydown'), component.cells()[0]);
            expect(events[0]).toBeInstanceOf(MouseEvent);
            expect(events[1]).toBeUndefined();
        });

        it('emits group nodes too, so a consumer can drill down', async () => {
            await createFixture(NESTED);
            const group = component.cells().find(c => c.node.label === 'Docs')!;
            const seen: TreemapNode[] = [];
            component.nodeClick.subscribe(e => seen.push(e.point));
            component.onCellClick(new MouseEvent('click'), group);
            expect(seen[0].children).toHaveLength(2);
        });
    });

    describe('interaction', () => {
        it('emits nodeHover with the node and null on leave', async () => {
            await createFixture();
            const seen: (string | null)[] = [];
            component.nodeHover.subscribe(e => seen.push(e === null ? null : e.point.label));
            component.onCellHover(component.cells()[0]);
            component.onCellLeave();
            expect(seen).toEqual([component.cells()[0].node.label, null]);
        });

        it('shows the value and share in the tooltip', async () => {
            await createFixture();
            const docs = component.cells().find(c => c.node.label === 'Docs')!;
            component.onCellHover(docs);
            fixture.detectChanges();
            expect(component.tooltipTitle()).toBe('Docs');
            expect(component.tooltipRows().map(r => r.label)).toEqual(['Value', 'Share']);
            expect(component.tooltipRows()[0].value).toBe('120');
            expect(component.tooltipRows()[1].value).toBe('40%');
        });

        it('clears the tooltip on leave', async () => {
            await createFixture();
            component.onCellHover(component.cells()[0]);
            component.onCellLeave();
            expect(component.tooltipRows()).toEqual([]);
            expect(component.tooltipTitle()).toBeUndefined();
        });
    });

    describe('accessibility', () => {
        it('labels the chart with a summary including the title', async () => {
            await createFixture();
            fixture.componentRef.setInput('title', 'Disk usage');
            fixture.detectChanges();
            expect(component.ariaLabel()).toContain('Disk usage');
            expect(component.ariaLabel()).toContain('Treemap');
        });

        it('announces each node’s label and value', async () => {
            await createFixture();
            const docs = component.cells().find(c => c.node.label === 'Docs')!;
            expect(component.getCellAriaLabel(docs)).toBe('Docs: 120');
        });

        it('makes every cell focusable', async () => {
            await createFixture();
            const cell = fixture.nativeElement.querySelector(
                '[data-slot="treemap-cell"]',
            );
            expect(cell.getAttribute('tabindex')).toBe('0');
            expect(cell.getAttribute('role')).toBe('button');
        });
    });

    describe('edge cases', () => {
        it('renders an empty state for no nodes', async () => {
            await createFixture([]);
            expect(component.isEmpty()).toBe(true);
            expect(fixture.nativeElement.querySelector('[data-slot="treemap-empty"]'))
                .toBeTruthy();
        });

        it('renders an empty state when every value is zero', async () => {
            await createFixture([{ label: 'a', value: 0 }, { label: 'b', value: 0 }]);
            expect(component.isEmpty()).toBe(true);
        });

        // §2.2 edge case — zero-value node among positives
        it('gives a zero-value node a zero-size rectangle without breaking the rest', async () => {
            await createFixture([
                { label: 'a', value: 5 }, { label: 'zero', value: 0 }, { label: 'b', value: 5 },
            ]);
            const zero = component.cells().find(c => c.node.label === 'zero')!;
            expect(zero.width * zero.height).toBe(0);
            expect(component.cells().find(c => c.node.label === 'a')!.width)
                .toBeGreaterThan(0);
        });

        it('gives a single node the whole plot', async () => {
            await createFixture([{ label: 'only', value: 9 }]);
            const [cell] = component.cells();
            expect(cell.width).toBeGreaterThan(0);
            expect(cell.height).toBeGreaterThan(0);
            expect(Number.isFinite(cell.x)).toBe(true);
        });

        it('ignores negative values rather than inverting the layout', async () => {
            await createFixture([{ label: 'a', value: 10 }, { label: 'neg', value: -5 }]);
            expect(component.cells().find(c => c.node.label === 'neg')!.width * 1).toBe(0);
            expect(component.total()).toBe(10);
        });

        it('lays out very large values without NaN geometry', async () => {
            await createFixture([
                { label: 'a', value: 1e12 }, { label: 'b', value: 2e12 },
            ]);
            for (const cell of component.cells()) {
                for (const n of [cell.x, cell.y, cell.width, cell.height]) {
                    expect(Number.isFinite(n)).toBe(true);
                }
            }
        });
    });

    // T-20: RTL
    describe('T-20 RTL', () => {
        it('mirrors the layout horizontally when dir is rtl', async () => {
            await createFixture();
            const ltr = component.cells().map(c => c.x);
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            const rtl = component.cells().map(c => c.x);
            expect(rtl).not.toEqual(ltr);
            expect(component.labelAnchor()).toBe('end');
        });

        it('keeps every mirrored rectangle inside the plot', async () => {
            await createFixture();
            fixture.componentRef.setInput('dir', 'rtl');
            fixture.detectChanges();
            for (const cell of component.cells()) {
                expect(cell.x).toBeGreaterThanOrEqual(-1e-6);
                expect(cell.x + cell.width).toBeLessThanOrEqual(component.svgWidth() + 1e-6);
            }
        });
    });

    // T-18: resize
    describe('T-18 resize', () => {
        it('falls back to the width input before the container is measured', async () => {
            await createFixture();
            fixture.componentRef.setInput('width', 640);
            fixture.detectChanges();
            expect(component.svgWidth()).toBe(640);
        });

        it('re-lays out the cells when the width changes', async () => {
            await createFixture();
            const before = Math.max(...component.cells().map(c => c.x + c.width));
            fixture.componentRef.setInput('width', 1000);
            fixture.detectChanges();
            expect(Math.max(...component.cells().map(c => c.x + c.width)))
                .toBeGreaterThan(before);
        });
    });

    describe('styling hooks', () => {
        it('merges the class input onto the container', async () => {
            await createFixture();
            fixture.componentRef.setInput('class', 'my-treemap');
            fixture.detectChanges();
            expect(
                fixture.nativeElement.querySelector('[data-slot="treemap"].my-treemap'),
            ).toBeTruthy();
        });
    });
    // CLAUDE.md section 6 — the tooltip is hover-revealed, so touch needs its own path
    describe('touch', () => {
        it('reveals the tooltip on touchstart, not only on mouseenter', async () => {
            await createFixture();
            const mark = fixture.nativeElement.querySelector('[data-slot="treemap-cell"]');
            expect(component.hoveredIndex()).toBeNull();

            mark.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
            fixture.detectChanges();

            expect(component.hoveredIndex()).toBe(0);
        });
    });

});
