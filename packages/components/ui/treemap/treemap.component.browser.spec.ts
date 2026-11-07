import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { TreemapComponent } from './treemap.component';
import type { TreemapNode } from './treemap.types';

const NODES: TreemapNode[] = [
    { label: 'Documents', value: 120 },
    { label: 'Media', value: 80 },
    { label: 'Code', value: 60 },
    { label: 'Other', value: 40 },
];

type Mode = { pageDir: 'ltr' | 'rtl'; dir: 'auto' | 'ltr' | 'rtl' };

/** Real-browser geometry: SVG `text-anchor` start/end flip with the text direction, which jsdom does not lay out. */
describe('TreemapComponent — label placement', () => {
    it.each<Mode>([
        { pageDir: 'ltr', dir: 'auto' },
        { pageDir: 'rtl', dir: 'auto' },
        { pageDir: 'rtl', dir: 'rtl' },
        { pageDir: 'ltr', dir: 'rtl' },
    ])('keeps every label inside its cell (page $pageDir, dir=$dir)', (mode) => {
        const fixture = TestBed.createComponent(TreemapComponent);
        const host = document.createElement('div');
        host.dir = mode.pageDir;
        host.style.width = '600px';
        document.body.appendChild(host);
        host.appendChild(fixture.nativeElement);
        fixture.componentRef.setInput('nodes', NODES);
        fixture.componentRef.setInput('dir', mode.dir);
        fixture.componentRef.setInput('width', 600);
        fixture.detectChanges();

        const labels = [...fixture.nativeElement.querySelectorAll('[data-slot="treemap-label"]')] as SVGTextElement[];
        expect(labels.length).toBeGreaterThan(0);
        for (const label of labels) {
            const cell = label.parentElement?.querySelector('rect')?.getBoundingClientRect();
            const box = label.getBoundingClientRect();
            expect(box.left).toBeGreaterThanOrEqual((cell?.left ?? 0) - 0.5);
            expect(box.right).toBeLessThanOrEqual((cell?.right ?? 0) + 0.5);
        }

        fixture.destroy();
        host.remove();
    });
});
