// The groups panel — `specs/node-editor-addons-spec.md` §6, tasks F1 and F3–F5.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import {
    NodeEditorGroupsComponent,
    type GroupMoveEvent,
} from './node-editor-groups.component';
import type { NodeComment, NodeGroup } from './node-editor-groups.types';
import type { EditorNode } from '../..';

const NODES: EditorNode[] = [
    { id: 'in', x: 60, y: 80, width: 100, height: 60 },
    { id: 'also-in', x: 200, y: 80, width: 100, height: 60 },
    { id: 'out', x: 900, y: 900, width: 100, height: 60 },
];

const GROUPS: NodeGroup[] = [
    { id: 'stage-1', title: 'Ingest', x: 20, y: 20, width: 400, height: 300, colour: '#22c55e' },
    { id: 'tiny', title: 'Nested', x: 40, y: 40, width: 120, height: 120 },
];

const COMMENTS: NodeComment[] = [
    { id: 'note', text: 'Runs nightly', x: 600, y: 40, width: 180, height: 80 },
];

@Component({
    standalone: true,
    imports: [NodeEditorGroupsComponent],
    template: `
    <div style="position: relative; width: 900px; height: 700px">
      <ui-node-editor-groups
        [(groups)]="groups"
        [comments]="comments"
        [nodes]="nodes()"
        [readonlyGroups]="readonlyGroups()"
        (groupMoved)="moved.set($event)"
        (groupActivated)="activated.set($event.id)"
      />
    </div>
  `,
})
class HostComponent {
    readonly groups = signal<readonly NodeGroup[]>(GROUPS);
    readonly comments = COMMENTS;
    readonly nodes = signal<readonly EditorNode[]>(NODES);
    readonly readonlyGroups = signal(false);
    readonly moved = signal<GroupMoveEvent | null>(null);
    readonly activated = signal<string | null>(null);
}

describe('NodeEditorGroupsComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function frames(): HTMLElement[] {
        return [...fixture.nativeElement.querySelectorAll('[data-slot="node-editor-group"]')];
    }

    function frame(id: string): HTMLElement {
        return fixture.nativeElement.querySelector(`[data-slot="node-editor-group"][data-group="${id}"]`);
    }

    function title(id: string): HTMLElement {
        return frame(id).querySelector('[data-slot="node-editor-group-title"]') as HTMLElement;
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    /**
     * A drag, in screen pixels. The component derives the zoom from the
     * frame's drawn width, which in a test is 1:1.
     */
    async function drag(target: HTMLElement, dx: number, dy: number): Promise<void> {
        target.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: 0, clientY: 0,
        }));
        target.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true, cancelable: true, pointerId: 1, clientX: dx, clientY: dy,
        }));
        target.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true, cancelable: true, pointerId: 1, clientX: dx, clientY: dy,
        }));
        await settle();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        host.groups.set(GROUPS);
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('rendering', () => {
        it('draws a frame per group', () => {
            expect(frames()).toHaveLength(2);
        });

        it('positions it in world coordinates', () => {
            expect(frame('stage-1').style.left).toBe('20px');
            expect(frame('stage-1').style.width).toBe('400px');
        });

        /**
         * A small group nested inside a big one has to paint on top, or it is
         * invisible and unclickable.
         */
        it('draws the largest first, so a nested group stays visible', () => {
            expect(frames().map(f => f.dataset['group'])).toEqual(['stage-1', 'tiny']);
        });

        it('shows how many nodes each group holds', () => {
            expect(title('stage-1').textContent).toContain('2');
        });

        it('draws comments too', () => {
            const note = fixture.nativeElement.querySelector('[data-slot="node-editor-comment"]');
            expect(note?.textContent).toContain('Runs nightly');
        });
    });

    describe('membership follows the geometry', () => {
        /**
         * Recomputed, never stored. A stored list drifts the moment a node is
         * dragged out, and then a group claims a node that is visibly not in
         * it.
         */
        it('recounts when a node is dragged out of the frame', async () => {
            expect(title('stage-1').textContent).toContain('2');

            host.nodes.set([
                { ...NODES[0], x: 5000 },      // dragged far away
                NODES[1],
                NODES[2],
            ]);
            await settle();

            expect(title('stage-1').textContent).toContain('1');
        });

        it('recounts when a node is dragged in', async () => {
            expect(title('tiny').textContent).toContain('1');

            host.nodes.set([{ ...NODES[0], x: 50, y: 50, width: 40, height: 40 }]);
            await settle();

            expect(title('tiny').textContent).toContain('1');
            expect(title('stage-1').textContent).toContain('1');
        });

        it('counts nothing when the group holds nothing', async () => {
            host.nodes.set([]);
            await settle();
            expect(title('stage-1').textContent).toContain('0');
        });
    });

    describe('dragging the title bar', () => {
        it('moves the frame', async () => {
            await drag(title('stage-1'), 100, 50);
            expect(host.groups().find(g => g.id === 'stage-1')).toMatchObject({ x: 120, y: 70 });
        });

        /**
         * The addon never writes node positions: the editor owns them and
         * routes them through the undo funnel, so this reports and the
         * consumer applies.
         */
        it('reports where the members should land rather than moving them', async () => {
            await drag(title('stage-1'), 100, 50);

            const event = host.moved();
            expect(event?.members.get('in')).toEqual({ x: 160, y: 130 });
            // Reported, not applied — the editor owns node positions.
            expect(host.nodes()[0]).toMatchObject({ x: 60, y: 80 });
        });

        it('leaves nodes outside the group alone', async () => {
            await drag(title('stage-1'), 100, 50);
            expect(host.moved()?.members.has('out')).toBe(false);
        });

        /**
         * The frame has already moved by the time the drag ends, so asking
         * which nodes it contains NOW would collect whatever it happens to be
         * sitting over.
         */
        it('takes members from where the frame STARTED', async () => {
            await drag(title('stage-1'), 800, 800);
            const ids: string[] = [...(host.moved()?.members.keys() ?? [])].map(String);
            ids.sort((a, b) => a.localeCompare(b));
            expect(ids).toEqual(['also-in', 'in']);
        });

        it('treats a press that never moved as an activation, not a drag', async () => {
            await drag(title('tiny'), 0, 0);
            expect(host.activated()).toBe('tiny');
            expect(host.moved()).toBeNull();
        });

        it('does not move on a press that never moved', async () => {
            await drag(title('tiny'), 0, 0);
            expect(host.groups().find(g => g.id === 'tiny')).toMatchObject({ x: 40, y: 40 });
        });

        it('ignores a right-click', async () => {
            title('stage-1').dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true, cancelable: true, button: 2, pointerId: 1,
            }));
            title('stage-1').dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true, cancelable: true, pointerId: 1, clientX: 100, clientY: 100,
            }));
            await settle();
            expect(host.groups().find(g => g.id === 'stage-1')).toMatchObject({ x: 20 });
        });
    });

    describe('resizing', () => {
        function handle(id: string): HTMLElement {
            return frame(id).querySelector('[data-slot="node-editor-group-resize"]') as HTMLElement;
        }

        it('grows the frame', async () => {
            await drag(handle('stage-1'), 60, 40);
            expect(host.groups().find(g => g.id === 'stage-1')).toMatchObject({
                width: 460,
                height: 340,
            });
        });

        it('does not move the members — resizing changes what is IN the group', async () => {
            await drag(handle('stage-1'), 60, 40);
            expect(host.moved()).toBeNull();
        });
    });

    describe('readonly', () => {
        beforeEach(async () => {
            host.readonlyGroups.set(true);
            await settle();
        });

        it('refuses to move a frame', async () => {
            await drag(title('stage-1'), 100, 50);
            expect(host.groups().find(g => g.id === 'stage-1')).toMatchObject({ x: 20, y: 20 });
        });

        it('hides the resize handle entirely', () => {
            expect(frame('stage-1').querySelector('[data-slot="node-editor-group-resize"]')).toBeNull();
        });
    });

    describe('restoreGroup — the undo half the addon owns', () => {
        /**
         * Handed to the editor's `pushEdit` so a frame move and the node moves
         * it caused are ONE undo entry. Only the addon knows how to put its
         * own data back.
         */
        it('puts a frame back where it was', async () => {
            const editor = fixture.debugElement.query(
                el => el.componentInstance instanceof NodeEditorGroupsComponent,
            ).componentInstance as NodeEditorGroupsComponent;

            await drag(title('stage-1'), 100, 50);
            editor.restoreGroup(GROUPS[0]);
            await settle();

            expect(host.groups().find(g => g.id === 'stage-1')).toMatchObject({ x: 20, y: 20 });
        });
    });

    describe('accessibility', () => {
        /**
         * A group must never become a container you have to enter to reach
         * what it holds: its members are real nodes elsewhere in the DOM.
         */
        it('is a labelled region naming what it holds', () => {
            const label = frame('stage-1').getAttribute('aria-label') ?? '';
            expect(label).toContain('Ingest');
            expect(label).toContain('2 nodes');
        });

        it('makes the drag handle a real button, so it is keyboard reachable', () => {
            expect(title('stage-1').tagName).toBe('BUTTON');
        });

        /**
         * The frame is drawn over the plane. Taking pointer events on the body
         * would make every node inside it unselectable and swallow pans.
         */
        it('lets pointer events through the frame body', () => {
            expect(getComputedStyle(frame('stage-1')).pointerEvents).toBe('none');
            expect(getComputedStyle(title('stage-1')).pointerEvents).toBe('auto');
        });

        it('keeps the resize corner out of the tab order and the a11y tree', () => {
            const corner = frame('stage-1').querySelector('[data-slot="node-editor-group-resize"]');
            expect(corner?.getAttribute('aria-hidden')).toBe('true');
            expect(corner?.hasAttribute('tabindex')).toBe(false);
        });

        it('has no axe violations', async () => {
            const results = await axe.run(fixture.nativeElement, { resultTypes: ['violations'] });
            expect(results.violations.map(v => v.id)).toEqual([]);
        });
    });
});
