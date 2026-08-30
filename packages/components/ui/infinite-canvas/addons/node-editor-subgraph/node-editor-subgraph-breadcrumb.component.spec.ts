// The breadcrumb — `specs/node-editor-addons-spec.md` §7, task G4.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { NodeEditorSubgraphBreadcrumbComponent } from './node-editor-subgraph-breadcrumb.component';
import type { SubgraphFrame } from './node-editor-subgraph.types';

const EMPTY = { nodes: [], connections: [] };

const PATH: SubgraphFrame[] = [
    { nodeId: null, label: 'Main', graph: EMPTY },
    { nodeId: 'outer', label: 'Doubler', graph: EMPTY },
    { nodeId: 'inner', label: 'Adder', graph: EMPTY },
];

@Component({
    standalone: true,
    imports: [NodeEditorSubgraphBreadcrumbComponent],
    template: `
    <ui-node-editor-subgraph-breadcrumb [path]="path()" (navigate)="went.set($event)" />
  `,
})
class HostComponent {
    readonly path = signal<readonly SubgraphFrame[]>(PATH);
    readonly went = signal<number | null>(null);
}

describe('NodeEditorSubgraphBreadcrumbComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function crumbs(): HTMLElement[] {
        return [...fixture.nativeElement.querySelectorAll('[data-slot="node-editor-subgraph-crumb"]')];
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => fixture.destroy());

    it('shows a crumb per level, root first', () => {
        expect(crumbs().map(c => c.textContent?.trim())).toEqual(['Main', 'Doubler', 'Adder']);
    });

    /**
     * Descending into a subgraph is navigation, and the breadcrumb is the only
     * way back — so every ancestor has to be a real button.
     */
    it('makes every ancestor a real button', () => {
        expect(crumbs()[0].tagName).toBe('BUTTON');
        expect(crumbs()[1].tagName).toBe('BUTTON');
    });

    it('does not make the current level a link to itself', () => {
        expect(crumbs()[2].tagName).toBe('SPAN');
    });

    it('emits the level that was picked', () => {
        crumbs()[1].click();
        expect(host.went()).toBe(1);
    });

    it('emits the root when the root is picked', () => {
        crumbs()[0].click();
        expect(host.went()).toBe(0);
    });

    it('shows a single crumb at the root, with nothing to go back to', async () => {
        host.path.set([PATH[0]]);
        await settle();

        expect(crumbs()).toHaveLength(1);
        expect(crumbs()[0].tagName).toBe('SPAN');
    });

    it('separates levels visibly without putting the separator in the a11y tree', () => {
        const separators = fixture.nativeElement.querySelectorAll('[aria-hidden="true"]');
        expect(separators.length).toBeGreaterThan(0);
    });

    describe('accessibility', () => {
        it('is a labelled navigation landmark', () => {
            const nav = fixture.nativeElement.querySelector('nav');
            expect(nav?.getAttribute('aria-label')).toBe('Graph path');
        });

        /**
         * Says which level you are on rather than leaving a screen reader to
         * infer it from styling.
         */
        it('marks the current level', () => {
            expect(crumbs()[2].getAttribute('aria-current')).toBe('page');
            expect(crumbs()[0].getAttribute('aria-current')).toBeNull();
        });

        it('names each link in words', () => {
            expect(crumbs()[1].getAttribute('aria-label')).toBe('Go to Doubler');
        });

        it('has no axe violations', async () => {
            const results = await axe.run(fixture.nativeElement, { resultTypes: ['violations'] });
            expect(results.violations.map(v => v.id)).toEqual([]);
        });
    });
});
