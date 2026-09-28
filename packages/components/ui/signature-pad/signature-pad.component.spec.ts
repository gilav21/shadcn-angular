// `signature-pad` â€” `specs/form-controls-small-spec.md` T-4, UC-6, R-4.
//
// Drawing is driven with real PointerEvents at a real canvas. A test that
// called `onPointerDown` directly would prove the method works and say nothing
// about whether the template ever reaches it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, ErrorHandler, signal, type ModelSignal } from '@angular/core';
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

    /**
     * Gives the canvas a layout box on the instance. jsdom has no layout, so
     * a pad there is 0ª0 and every point would collapse onto the origin.
     */
    function sizeCanvas(box: { width: number; height: number }): void {
        Object.defineProperty(canvas(), 'getBoundingClientRect', {
            configurable: true,
            value: () => new DOMRect(0, 0, box.width, box.height),
        });
    }

    /**
     * jsdom has neither layout nor an image encoder: give this one canvas the
     * box a browser would, and an encoder that answers in the real format, so
     * the pad's value is a data URL as it is in a browser.
     */
    function giveJsdomACanvas(): void {
        sizeCanvas({ width: 300, height: 180 });
        Object.defineProperty(canvas(), 'toDataURL', {
            configurable: true,
            value: (type = 'image/png') => `data:${type};base64,iVBORw0KGgo=`,
        });
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
        if (canvas().getBoundingClientRect().width === 0) giveJsdomACanvas();
    });

    afterEach(() => fixture.destroy());

    describe('the conformance contract', () => {
        it('exposes value as a model signal', () => {
            const value: ModelSignal<string | null> = pad().value;

            expect(typeof value.set).toBe('function');
            expect(typeof value.subscribe).toBe('function');
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
    });

    describe('drawing', () => {
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

        it('does not resurrect a stroke cleared while the pointer is still down', async () => {
            canvas().dispatchEvent(pointer('pointerdown', 10, 10));
            pad().clear();
            canvas().dispatchEvent(pointer('pointermove', 60, 60));
            canvas().dispatchEvent(pointer('pointerup', 60, 60));
            await settle();

            expect(pad().strokes()).toEqual([]);
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
     * UC-6 and Â§3.3: the pad is mostly used with a finger, and a second finger
     * means the user is zooming the page â€” not adding a spike across their
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
         * event defaults to it â€” narrowing to touch is what keeps that from
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
        it('undoes the last stroke only', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);
            const first = pad().strokes()[0];
            await draw([
                [50, 50],
                [70, 70],
            ]);

            button('undo')!.click();
            await settle();

            expect(pad().strokes()).toEqual([first]);
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

    describe('a value written in from outside', () => {
        it('erases the drawing when the value is reset to null', async () => {
            await draw([
                [10, 10],
                [40, 40],
            ]);

            host.signature.set(null);
            await settle();

            expect(pad().strokes()).toEqual([]);
        });
    });

    /** R-4: the bitmap follows the box, so a resize must re-measure the pad. */
    describe('resizing', () => {
        it('re-measures the pad when its box changes', async () => {
            const own = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
            let onResize: (() => void) | undefined;
            class CapturingResizeObserver {
                constructor(callback: () => void) {
                    onResize = callback;
                }
                observe(): void { /* driven by hand below */ }
                disconnect(): void { /* nothing to release */ }
            }
            Object.defineProperty(globalThis, 'ResizeObserver', {
                configurable: true,
                value: CapturingResizeObserver,
            });
            try {
                fixture.destroy();
                fixture = TestBed.createComponent(HostComponent);
                host = fixture.componentInstance;
                await settle();
                const box = { width: 300, height: 180 };
                sizeCanvas(box);
                await draw([
                    [30, 30],
                    [150, 90],
                ]);

                box.width = 600;
                onResize?.();

                const svg = decodeURIComponent(pad().toDataURL('svg')!);
                expect(svg).toContain('width="600" height="180"');
            } finally {
                if (own) Object.defineProperty(globalThis, 'ResizeObserver', own);
                else Reflect.deleteProperty(globalThis, 'ResizeObserver');
            }
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
         * A real blur, not a direct call â€” `blur` does not bubble, so a
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
    });
});

describe('SignaturePadComponent where ResizeObserver does not exist', () => {
    /** SSR and jsdom — where consumers' own tests run — have no ResizeObserver. */
    it('sets up without reporting an error', async () => {
        const own = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
        Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: undefined });
        const errors: unknown[] = [];
        try {
            await TestBed.configureTestingModule({
                imports: [HostComponent],
                providers: [{ provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } }],
            }).compileComponents();
            const fixture = TestBed.createComponent(HostComponent);
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.destroy();
        } finally {
            if (own) Object.defineProperty(globalThis, 'ResizeObserver', own);
            else Reflect.deleteProperty(globalThis, 'ResizeObserver');
        }

        expect(errors).toEqual([]);
    });
});
