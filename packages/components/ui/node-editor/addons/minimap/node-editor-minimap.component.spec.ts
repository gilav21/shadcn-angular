// The minimap component — `specs/node-editor-addons-spec.md` §3.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { NodeEditorMinimapComponent } from './node-editor-minimap.component';
import type { CanvasPoint, CanvasRect, EditorNode, NodeConnection } from '../..';

const NODES: EditorNode[] = [
    { id: 'a', x: 0, y: 0, width: 180, height: 80, accent: '#22c55e' },
    { id: 'b', x: 400, y: 0, width: 180, height: 80 },
    { id: 'c', x: 400, y: 300, width: 180, height: 80 },
];

const CONNECTIONS: NodeConnection[] = [
    { id: 'c1', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
    { id: 'c2', source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' },
];

@Component({
    standalone: true,
    imports: [NodeEditorMinimapComponent],
    template: `
    <ui-node-editor-minimap
      [nodes]="nodes()"
      [connections]="connections"
      [viewport]="viewport()"
      [width]="200"
      [height]="140"
      (navigate)="navigated.set($event)"
    />
  `,
})
class HostComponent {
    readonly nodes = signal<readonly EditorNode[]>(NODES);
    readonly connections = CONNECTIONS;
    readonly viewport = signal<CanvasRect | null>({ x: 0, y: 0, width: 300, height: 200 });
    readonly navigated = signal<CanvasPoint | null>(null);
}

describe('NodeEditorMinimapComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function control(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-slot="node-editor-minimap"]') as HTMLElement;
    }

    function surface(): HTMLCanvasElement {
        return fixture.nativeElement.querySelector(
            '[data-slot="node-editor-minimap-surface"]',
        ) as HTMLCanvasElement;
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

    describe('rendering', () => {
        it('draws on a canvas, not a pile of DOM boxes', () => {
            // At thousands of nodes, DOM would double the element count of the
            // whole graph for something the size of a postage stamp.
            expect(surface().tagName).toBe('CANVAS');
            expect(fixture.nativeElement.querySelectorAll('[data-node]')).toHaveLength(0);
        });

        it('sizes the backing store for the device pixel ratio', () => {
            const dpr = globalThis.devicePixelRatio > 0 ? globalThis.devicePixelRatio : 1;
            expect(surface().width).toBe(Math.round(200 * dpr));
            expect(surface().style.width).toBe('200px');
        });

        it('actually paints something', () => {
            const context = surface().getContext('2d') as CanvasRenderingContext2D;
            const { data } = context.getImageData(0, 0, surface().width, surface().height);
            const painted = [...data].some((channel, i) => i % 4 === 3 && channel > 0);
            expect(painted).toBe(true);
        });

        it('repaints when the graph changes', async () => {
            const before = surface().toDataURL();
            host.nodes.set([...NODES, { id: 'd', x: 900, y: 600, width: 180, height: 80 }]);
            await settle();
            expect(surface().toDataURL()).not.toBe(before);
        });

        it('survives an empty graph', async () => {
            host.nodes.set([]);
            host.viewport.set(null);
            await settle();
            expect(surface()).not.toBeNull();
        });
    });

    describe('navigating', () => {
        it('emits a world point when clicked', () => {
            control().dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true, cancelable: true, clientX: 100, clientY: 70,
            }));
            expect(host.navigated()).not.toBeNull();
        });

        it('follows a drag', async () => {
            control().dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true, cancelable: true, clientX: 40, clientY: 40,
            }));
            const first = host.navigated();

            control().dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true, cancelable: true, clientX: 160, clientY: 100,
            }));
            expect(host.navigated()).not.toEqual(first);
        });

        it('ignores movement when not dragging', () => {
            control().dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true, cancelable: true, clientX: 160, clientY: 100,
            }));
            expect(host.navigated()).toBeNull();
        });

        it('stops following after release', () => {
            control().dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true, cancelable: true, clientX: 40, clientY: 40,
            }));
            control().dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            const parked = host.navigated();

            control().dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true, cancelable: true, clientX: 180, clientY: 120,
            }));
            expect(host.navigated()).toEqual(parked);
        });
    });

    describe('keyboard', () => {
        /**
         * A navigation control that only answers a pointer is one keyboard
         * users cannot use — and the base went to real lengths to make
         * everything else reachable.
         */
        it('moves the viewport with arrow keys', () => {
            control().dispatchEvent(new KeyboardEvent('keydown', {
                key: 'ArrowRight', bubbles: true, cancelable: true,
            }));
            expect(host.navigated()?.x).toBeGreaterThan(150);
        });

        it('moves a whole screen with shift', () => {
            control().dispatchEvent(new KeyboardEvent('keydown', {
                key: 'ArrowRight', bubbles: true, cancelable: true,
            }));
            const small = host.navigated()?.x ?? 0;

            control().dispatchEvent(new KeyboardEvent('keydown', {
                key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true,
            }));
            expect(host.navigated()?.x).toBeGreaterThan(small);
        });

        it('ignores keys it does not handle', () => {
            control().dispatchEvent(new KeyboardEvent('keydown', {
                key: 'a', bubbles: true, cancelable: true,
            }));
            expect(host.navigated()).toBeNull();
        });

        it('does nothing without a viewport to move', async () => {
            host.viewport.set(null);
            await settle();
            control().dispatchEvent(new KeyboardEvent('keydown', {
                key: 'ArrowRight', bubbles: true, cancelable: true,
            }));
            expect(host.navigated()).toBeNull();
        });
    });

    describe('accessibility', () => {
        it('is a real button, so it is focusable and keyboard operable', () => {
            expect(control().tagName).toBe('BUTTON');
        });

        it('names itself and says what it contains', () => {
            const label = control().getAttribute('aria-label') ?? '';
            expect(label).toContain('3 nodes');
            expect(label).toContain('2 connections');
        });

        it('keeps the decorative canvas out of the accessibility tree', () => {
            expect(surface().getAttribute('aria-hidden')).toBe('true');
        });

        it('has no axe violations', async () => {
            const results = await axe.run(control(), { resultTypes: ['violations'] });
            expect(results.violations.map(v => v.id)).toEqual([]);
        });
    });
});
