import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TreeComponent, TreeNode } from './tree.component';

/** Real-browser check: the chevron's mirroring is computed style, which jsdom does not resolve. */
const data: TreeNode[] = [
    { key: 'docs', label: 'Docs', children: [{ key: 'intro', label: 'Intro' }] },
    { key: 'readme', label: 'README' },
];

@Component({
    template: `
        <div [dir]="dir()">
            <ui-tree [data]="data" />
        </div>
    `,
    imports: [TreeComponent],
})
class ChevronHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
    readonly data = data;
}

function collapsedChevronRotation(dir: 'ltr' | 'rtl'): string {
    TestBed.configureTestingModule({ imports: [ChevronHost] });
    const fixture = TestBed.createComponent(ChevronHost);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();
    const chevron = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="tree-item"] button')!;
    // The chevron transitions its rotation; read the settled value.
    for (const animation of chevron.getAnimations()) animation.finish();
    return getComputedStyle(chevron).rotate;
}

describe('Tree RTL rendering (browser)', () => {
    it('points a collapsed chevron toward the inline end: unrotated in LTR, turned 180deg in RTL', () => {
        expect(collapsedChevronRotation('ltr')).toBe('none');
        TestBed.resetTestingModule();
        expect(collapsedChevronRotation('rtl')).toBe('180deg');
    });
});

const explorer: TreeNode[] = [
    {
        key: 'src',
        label: 'src',
        children: Array.from({ length: 12 }, (_, i) => ({ key: `src/file-${i + 1}.ts`, label: `file-${i + 1}.ts` })),
    },
    ...Array.from({ length: 16 }, (_, i) => ({ key: `doc-${i + 1}.md`, label: `doc-${i + 1}.md` })),
];

@Component({
    template: `
        <div data-testid="scroller" style="height: 160px; overflow: auto">
            <ui-tree [data]="data" [initialExpandDepth]="1" />
        </div>
    `,
    imports: [TreeComponent],
})
class ScrollingTreeHost {
    readonly data = explorer;
}

/** Real-layout case: the tree navigates by aria-activedescendant, so only real scrolling keeps the node visible. */
describe('Tree keyboard navigation in a scroll container (browser)', () => {
    it('keeps the active node inside the scroll viewport going down and back to the top', async () => {
        const fixture = TestBed.createComponent(ScrollingTreeHost);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        const tree = root.querySelector<HTMLElement>('[role="tree"]')!;
        const scroller = root.querySelector<HTMLElement>('[data-testid="scroller"]')!;
        const press = (key: string): void => {
            tree.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
            fixture.detectChanges();
        };
        const activeRow = (): HTMLElement => {
            const item = document.getElementById(tree.getAttribute('aria-activedescendant')!)!;
            return item.firstElementChild as HTMLElement;
        };
        const expectInView = (label: string): void => {
            const row = activeRow();
            expect(row.textContent?.trim()).toBe(label);
            const view = scroller.getBoundingClientRect();
            const rect = row.getBoundingClientRect();
            expect(rect.top).toBeGreaterThanOrEqual(view.top - 0.5);
            expect(rect.bottom).toBeLessThanOrEqual(view.bottom + 0.5);
        };

        for (let i = 0; i < 20; i++) press('ArrowDown');
        expect(scroller.scrollTop).toBeGreaterThan(0);
        expectInView('doc-7.md');

        press('Home');
        expectInView('src');

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
