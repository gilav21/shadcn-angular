// `signature-pad` — `specs/form-controls-small-spec.md` T-4, UC-6, R-4.
//
// Drawing is driven with real PointerEvents at a real canvas. A test that
// called `onPointerDown` directly would prove the method works and say nothing
// about whether the template ever reaches it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal, type ModelSignal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SignaturePadComponent } from './signature-pad.component';

@Component({
    standalone: true,
    imports: [SignaturePadComponent],
    template: `
    <ui-signature-pad
      [(value)]="signature"
      [disabled]="disabled()"
      [hideControls]="hideControls()"
      (strokeEnd)="strokes.set(strokes() + 1)"
    />
  `,
})
class HostComponent {
    readonly signature = signal<string | null>(null);
    readonly disabled = signal(false);
    readonly hideControls = signal(false);
    readonly strokes = signal(0);
}

@Component({
    standalone: true,
    imports: [SignaturePadComponent, ReactiveFormsModule],
    template: `<ui-signature-pad [formControl]="control" />`,
})
class ReactiveHostComponent {
    readonly control = new FormControl<string | null>(null);
}

describe('SignaturePadComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function pad(): SignaturePadComponent {
        return fixture.debugElement.children[0].componentInstance as SignaturePadComponent;
    }

    function canvas(): HTMLCanvasElement {
        return fixture.nativeElement.querySelector('[data-slot="signature-pad-canvas"]');
    }

    function button(slot: 'undo' | 'clear'): HTMLButtonElement | null {
        return fixture.nativeElement.querySelector(`[data-slot="signature-pad-${slot}"] button`)
            ?? fixture.nativeElement.querySelector(`[data-slot="signature-pad-${slot}"]`);
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    /** A pointer event positioned in the pad's own coordinate space. */
    function pointer(
        type: string,
        x: number,
        y: number,
        init: PointerEventInit = {},
    ): PointerEvent {
        const rect = canvas().getBoundingClientRect();
        return new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            isPrimary: true,
            pointerType: 'mouse',
            clientX: rect.left + x,
            clientY: rect.top + y,
            ...init,
        });
    }

    /** Draw a stroke through a list of points, the way a hand would. */
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
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('the conformance contract', () => {
        it('exposes value as a model signal', () => {
            const value: ModelSignal<string | null> = pad().value;

            expect(typeof value.set).toBe('function');
            expect(typeof value.subscribe).toBe('function');
        });

        it('emits a PNG data URL when a stroke finishes', async () => {
            await draw([
                [10, 10],
                [40, 40],
                [80, 20],
            ]);

            expect(host.signature()).toMatch(/^data:image\/png;base64,/);
        });

        it('fires strokeEnd once per stroke', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);
            expect(host.strokes()).toBe(1);

            await draw([
                [50, 50],
                [60, 60],
            ]);
            expect(host.strokes()).toBe(2);
        });

        /** Risk R-3 — a form writing in must not look like a user drawing. */
        it('does NOT emit when a value is written in from outside', async () => {
            let emissions = 0;
            pad().value.subscribe(() => emissions++);

            pad().writeValue(null);
            await settle();

            expect(emissions).toBe(0);
        });
    });

    describe('drawing', () => {
        it('records a stroke', async () => {
            await draw([
                [10, 10],
                [40, 40],
                [80, 20],
            ]);

            expect(pad().strokes()).toHaveLength(1);
            expect(pad().strokes()[0].length).toBeGreaterThan(1);
        });

        /**
         * R-4: the strokes are normalised to the pad, so the same mark means
         * the same thing at any size or pixel ratio.
         */
        it('keeps the strokes normalised to the pad', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);

            for (const point of pad().strokes()[0]) {
                expect(point.x).toBeGreaterThanOrEqual(0);
                expect(point.x).toBeLessThanOrEqual(1);
                expect(point.y).toBeGreaterThanOrEqual(0);
                expect(point.y).toBeLessThanOrEqual(1);
            }
        });

        it('starts a new stroke for each press', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);
            await draw([
                [50, 50],
                [70, 70],
            ]);

            expect(pad().strokes()).toHaveLength(2);
        });

        /** A pointer emits far faster than a hand moves. */
        it('drops points that did not move far enough to matter', async () => {
            canvas().dispatchEvent(pointer('pointerdown', 20, 20));
            for (let repeat = 0; repeat < 10; repeat++) {
                canvas().dispatchEvent(pointer('pointermove', 20, 20));
            }
            canvas().dispatchEvent(pointer('pointerup', 20, 20));
            await settle();

            expect(pad().strokes()[0]).toHaveLength(1);
        });

        it('ignores a pointer that is not the one drawing', async () => {
            canvas().dispatchEvent(pointer('pointerdown', 10, 10));
            canvas().dispatchEvent(pointer('pointermove', 40, 40, { pointerId: 7 }));
            canvas().dispatchEvent(pointer('pointerup', 10, 10));
            await settle();

            expect(pad().strokes()[0]).toHaveLength(1);
        });

        it('draws nothing while disabled', async () => {
            host.disabled.set(true);
            await settle();
            await draw([
                [10, 10],
                [40, 40],
            ]);

            expect(pad().strokes()).toHaveLength(0);
            expect(host.signature()).toBeNull();
        });
    });

    /**
     * UC-6 and §3.3: the pad is mostly used with a finger, and a second finger
     * means the user is zooming the page — not adding a spike across their
     * signature.
     */
    describe('a second finger', () => {
        it('abandons the stroke rather than drawing a spike', async () => {
            canvas().dispatchEvent(
                pointer('pointerdown', 10, 10, { pointerType: 'touch', isPrimary: true }),
            );
            canvas().dispatchEvent(
                pointer('pointermove', 40, 40, { pointerType: 'touch', isPrimary: true }),
            );
            canvas().dispatchEvent(
                pointer('pointerdown', 90, 90, {
                    pointerType: 'touch',
                    isPrimary: false,
                    pointerId: 2,
                }),
            );
            await settle();

            expect(pad().strokes()).toHaveLength(0);
        });

        /**
         * A mouse reports `isPrimary: false` for some buttons, and a synthetic
         * event defaults to it — narrowing to touch is what keeps that from
         * cancelling ordinary drawing.
         */
        it('does not confuse a non-primary mouse pointer for a second finger', async () => {
            canvas().dispatchEvent(
                pointer('pointerdown', 10, 10, { pointerType: 'mouse', isPrimary: false }),
            );
            await settle();

            expect(pad().strokes()).toHaveLength(1);
        });
    });

    describe('undo and clear', () => {
        it('removes the last stroke only', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);
            await draw([
                [50, 50],
                [70, 70],
            ]);

            button('undo')!.click();
            await settle();

            expect(pad().strokes()).toHaveLength(1);
        });

        it('erases everything and empties the value', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);

            button('clear')!.click();
            await settle();

            expect(pad().strokes()).toHaveLength(0);
            expect(host.signature()).toBeNull();
        });

        it('offers nothing to undo or clear on a blank pad', () => {
            expect(button('undo')!.disabled).toBe(true);
            expect(button('clear')!.disabled).toBe(true);
        });

        it('offers both once something is drawn', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);

            expect(button('undo')!.disabled).toBe(false);
            expect(button('clear')!.disabled).toBe(false);
        });

        it('can be hidden for a custom toolbar', async () => {
            host.hideControls.set(true);
            await settle();

            expect(button('undo')).toBeNull();
            expect(button('clear')).toBeNull();
        });

        it('is disabled along with the pad', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);
            host.disabled.set(true);
            await settle();

            expect(button('clear')!.disabled).toBe(true);
        });
    });

    describe('other formats', () => {
        it('offers nothing for a blank pad', () => {
            expect(pad().toDataURL()).toBeNull();
            expect(pad().toDataURL('svg')).toBeNull();
        });

        it('offers an SVG, which is line art rather than a bitmap', async () => {
            await draw([
                [10, 10],
                [40, 40],
                [80, 20],
            ]);

            const svg = pad().toDataURL('svg');
            expect(svg).toMatch(/^data:image\/svg\+xml/);
            expect(decodeURIComponent(svg!)).toContain('<path');
        });

        it('offers a JPEG without changing the value type', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);

            expect(pad().toDataURL('image/jpeg')).toMatch(/^data:image\/jpeg/);
            expect(host.signature()).toMatch(/^data:image\/png/);
        });
    });

    describe('a reactive form', () => {
        let reactive: ComponentFixture<ReactiveHostComponent>;

        beforeEach(async () => {
            await TestBed.resetTestingModule();
            await TestBed.configureTestingModule({
                imports: [ReactiveHostComponent],
            }).compileComponents();
            reactive = TestBed.createComponent(ReactiveHostComponent);
            reactive.detectChanges();
            await reactive.whenStable();
            reactive.detectChanges();
        });

        afterEach(() => reactive.destroy());

        it('disables the pad when the form disables the control', async () => {
            reactive.componentInstance.control.disable();
            reactive.detectChanges();
            await reactive.whenStable();
            reactive.detectChanges();

            const wrapper = reactive.nativeElement.querySelector('[data-slot="signature-pad"]');
            expect(wrapper.getAttribute('aria-disabled')).toBe('true');
        });

        /**
         * A real blur, not a direct call — `blur` does not bubble, so a
         * handler bound on the wrong element never runs.
         */
        it('marks the control touched on a real blur', async () => {
            const surface: HTMLCanvasElement = reactive.nativeElement.querySelector(
                '[data-slot="signature-pad-canvas"]',
            );
            expect(reactive.componentInstance.control.touched).toBe(false);

            surface.focus();
            surface.blur();
            reactive.detectChanges();
            await reactive.whenStable();

            expect(reactive.componentInstance.control.touched).toBe(true);
        });
    });

    describe('accessibility, and its honest limit', () => {
        it('names the surface', () => {
            expect(canvas().getAttribute('aria-label')).toBe('Signature');
            expect(canvas().getAttribute('role')).toBe('img');
        });

        it('is reachable by keyboard even though it cannot be drawn on by one', () => {
            expect(canvas().getAttribute('tabindex')).toBe('0');
        });

        /** The page must not scroll out from under a stroke. */
        it('takes the touch gesture rather than letting the page have it', () => {
            expect(getComputedStyle(canvas()).touchAction).toBe('none');
        });
    });
});
