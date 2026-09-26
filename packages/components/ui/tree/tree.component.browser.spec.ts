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
