// The plane is a space, not a paragraph.
//
// `portAnchor` puts an input at world x 0 and an output at world x = width, and
// a world coordinate has no writing direction — a node's x is authored data
// that must mean the same thing in every locale, or a saved graph would render
// mirrored for some readers and a node "at x 0" would be on the right.
//
// The port row used logical insets, which flip with `dir`. So in a
// right-to-left document the dot moved to the far side of the card while the
// wire stayed anchored where the maths put it: "the output shows on the right,
// but the line gets out of the left".
//
// Mounted as a bare port rather than a whole editor. The canvas drives a
// requestAnimationFrame loop, and standing one up per assertion put enough
// load into the parallel run to tip an unrelated wall-clock test in treemap —
// so this stays as small as the claim it is checking.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { POINTER_METRICS, portAnchor } from './node-editor.layout';
import { NodeEditorPortComponent } from './sub/node-editor-port.component';
import type { EditorNode, NodePort } from './node-editor.types';

const CARD_WIDTH = 180;

const PORTS: readonly NodePort[] = [
    { id: 'in', direction: 'in', label: 'In' },
    { id: 'out', direction: 'out', label: 'Out' },
];

const NODE: EditorNode = {
    id: 'a',
    x: 0,
    y: 0,
    width: CARD_WIDTH,
    height: 120,
    title: 'Pass',
    ports: PORTS,
};

/** A stand-in for the node card: the box the ports position themselves against. */
@Component({
    standalone: true,
    imports: [NodeEditorPortComponent],
    template: `
    <div
      #card
      class="relative"
      [style.width.px]="width"
      [style.height.px]="120"
      [attr.dir]="direction()"
      data-testid="card"
    >
      @for (port of ports; track port.id) {
        <ui-node-editor-port [port]="port" [node]="node" [metrics]="metrics" />
      }
    </div>
  `,
})
class HostComponent {
    readonly width = CARD_WIDTH;
    readonly ports = PORTS;
    readonly node = NODE;
    readonly metrics = POINTER_METRICS;
    readonly direction = signal<'ltr' | 'rtl'>('ltr');
}

describe('port geometry does not follow writing direction', () => {
    let fixture: ComponentFixture<HostComponent>;

    function card(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-testid="card"]') as HTMLElement;
    }

    /** A port dot's centre, as an offset from the card's left edge. */
    function dotOffset(portId: string): number {
        const port = fixture.nativeElement.querySelector(
            `[data-slot="node-editor-port"][data-port="${portId}"]`,
        ) as HTMLElement;
        const dot = port.querySelector('[data-slot="node-editor-port-dot"]') as HTMLElement;
        const cardBox = card().getBoundingClientRect();
        const dotBox = dot.getBoundingClientRect();
        return Math.round(dotBox.left + dotBox.width / 2 - cardBox.left);
    }

    function measure(direction: 'ltr' | 'rtl') {
        fixture.componentInstance.direction.set(direction);
        fixture.detectChanges();
        return { in: dotOffset('in'), out: dotOffset('out') };
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    it('draws the dots in the same places whichever way the document runs', () => {
        const ltr = measure('ltr');
        const rtl = measure('rtl');

        expect(rtl).toEqual(ltr);
    });

    it('keeps the input on the left edge and the output on the right, in both', () => {
        for (const direction of ['ltr', 'rtl'] as const) {
            const { in: input, out: output } = measure(direction);

            expect(input, `${direction} input`).toBeLessThan(output);
            // Within the row's own padding of each edge of the card.
            expect(input, `${direction} input`).toBeLessThan(20);
            expect(output, `${direction} output`).toBeGreaterThan(CARD_WIDTH - 20);
        }
    });

    /** The side the wire leaves from, which is what the dots have to agree with. */
    it('anchors edges at the same world offsets the dots are drawn at', () => {
        expect(portAnchor(NODE, 'in')?.x).toBe(0);
        expect(portAnchor(NODE, 'out')?.x).toBe(CARD_WIDTH);
    });
});
