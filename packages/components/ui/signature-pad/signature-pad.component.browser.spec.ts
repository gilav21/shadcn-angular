// Signature-pad cases that need a real canvas: its layout box (strokes are
// normalised to it), a real PNG encoder, and a real image load for a value
// written in from outside. jsdom has none of the three.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SignaturePadComponent } from './signature-pad.component';

@Component({
    imports: [SignaturePadComponent],
    template: `<ui-signature-pad [(value)]="signature" />`,
})
class HostComponent {
    readonly signature = signal<string | null>(null);
}

/** A saved signature as a form would hold it: a real (1x1) PNG data URL. */
const SAVED_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('SignaturePadComponent (browser)', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function pad(): SignaturePadComponent {
        return fixture.debugElement.children[0].componentInstance as SignaturePadComponent;
    }

    function canvas(): HTMLCanvasElement {
        return fixture.nativeElement.querySelector('[data-slot="signature-pad-canvas"]');
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    function pointer(type: string, x: number, y: number): PointerEvent {
        const rect = canvas().getBoundingClientRect();
        return new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            isPrimary: true,
            pointerType: 'mouse',
            clientX: rect.left + x,
            clientY: rect.top + y,
        });
    }

    async function draw(points: readonly (readonly [number, number])[]): Promise<void> {
        const [first, ...rest] = points;
        canvas().dispatchEvent(pointer('pointerdown', first[0], first[1]));
        for (const [x, y] of rest) {
            canvas().dispatchEvent(pointer('pointermove', x, y));
        }
        canvas().dispatchEvent(pointer('pointerup', ...points[points.length - 1]));
        await settle();
    }

    beforeEach(async () => {
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => fixture.destroy());

    /** Risk R-3 — a form writing in must not look like a user drawing. */
    it('does NOT emit when a value is written in from outside', async () => {
        let emissions = 0;
        pad().value.subscribe(() => emissions++);

        pad().writeValue(SAVED_PNG);
        // The image is adopted as the backdrop once it has loaded.
        await vi.waitFor(() => expect(pad().hasSignature()).toBe(true));
        await settle();

        expect(emissions).toBe(0);
        expect(host.signature()).toBeNull();
    });

    it('records a stroke', async () => {
        await draw([
            [10, 10],
            [40, 40],
            [80, 20],
        ]);

        // Stored normalised to the canvas box, so a resize cannot distort it.
        const { width, height } = canvas().getBoundingClientRect();
        const strokes = pad().strokes();
        expect(strokes).toHaveLength(1);
        expect(strokes[0].map(p => [p.x, p.y])).toEqual([
            [10 / width, 10 / height],
            [40 / width, 40 / height],
            [80 / width, 20 / height],
        ].map(([x, y]) => [expect.closeTo(x, 6), expect.closeTo(y, 6)]));
    });

    it('removes the last stroke only', async () => {
        await draw([
            [10, 10],
            [40, 40],
        ]);
        await draw([
            [50, 50],
            [70, 70],
        ]);
        const committed = host.signature();

        const undo = fixture.nativeElement.querySelector('[data-slot="signature-pad-undo"] button')
            ?? fixture.nativeElement.querySelector('[data-slot="signature-pad-undo"]');
        (undo as HTMLButtonElement).click();
        await settle();

        const { width, height } = canvas().getBoundingClientRect();
        const remaining = pad().strokes();
        expect(remaining).toHaveLength(1);
        expect(remaining[0][0].x).toBeCloseTo(10 / width, 6);
        expect(remaining[0][0].y).toBeCloseTo(10 / height, 6);
        expect(host.signature()).not.toBe(committed);
        expect(host.signature()).toMatch(/^data:image\/png/);
    });
});
