import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextImageResizerComponent, type RichTextImageResizerLabels } from './rich-text-images-resizer.component';

const LABELS_EN: RichTextImageResizerLabels = {
    inline: 'Inline with text',
    floatLeft: 'Float left',
    center: 'Center',
    floatRight: 'Float right',
    deleteImage: 'Delete image',
};
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** jsdom lacks ResizeObserver; the resizer's tracking effect constructs one. */
class ResizeObserverStub {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
}
type ResizeObserverGlobal = { ResizeObserver?: typeof ResizeObserver };
const originalResizeObserver = (globalThis as ResizeObserverGlobal).ResizeObserver;

beforeEach(() => {
    (globalThis as ResizeObserverGlobal).ResizeObserver =
        ResizeObserverStub as unknown as typeof ResizeObserver;
});

afterEach(() => {
    if (originalResizeObserver) {
        (globalThis as ResizeObserverGlobal).ResizeObserver = originalResizeObserver;
    } else {
        delete (globalThis as ResizeObserverGlobal).ResizeObserver;
    }
});

describe('RichTextImageResizerComponent', () => {
    let component: RichTextImageResizerComponent;
    let fixture: ComponentFixture<RichTextImageResizerComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextImageResizerComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextImageResizerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    describe('onDeleteClick', () => {
        it('should not emit imageRemove when target is null', () => {
            let emitted = false;
            component.imageRemove.subscribe(() => {
                emitted = true;
            });

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onDeleteClick(mockEvent);

            expect(emitted).toBe(false);
        });

        it('should call preventDefault and stopPropagation on the event', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            let preventDefaultCalled = false;
            let stopPropagationCalled = false;
            const mockEvent = {
                preventDefault: () => { preventDefaultCalled = true; },
                stopPropagation: () => { stopPropagationCalled = true; },
            } as any;

            component.onDeleteClick(mockEvent);

            expect(preventDefaultCalled).toBe(true);
            expect(stopPropagationCalled).toBe(true);
        });
    });

    describe('onAlignClick', () => {
        it('should not emit when target is null', () => {
            let emitted = false;
            component.alignmentChange.subscribe(() => {
                emitted = true;
            });

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onAlignClick(mockEvent, 'center');

            expect(emitted).toBe(false);
        });
    });

    describe('currentAlignment', () => {
        it('should read data-align attribute from target element', () => {
            const img = document.createElement('img');
            img.dataset['align'] = 'left';
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(component.currentAlignment()).toBe('left');
        });

        it('should return inline when target has no data-align attribute', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(component.currentAlignment()).toBe('inline');
        });

    });

    describe('resolvedAlignmentLabels', () => {
        it('maps alignments to the provided labels', () => {
            fixture.componentRef.setInput('labels', LABELS_EN);
            fixture.detectChanges();
            const labels = component.resolvedAlignmentLabels();
            expect(labels.inline).toBe(LABELS_EN.inline);
            expect(labels.left).toBe(LABELS_EN.floatLeft);
            expect(labels.center).toBe(LABELS_EN.center);
            expect(labels.right).toBe(LABELS_EN.floatRight);
        });
    });

    describe('resize drag', () => {
        let img: HTMLImageElement;
        let container: HTMLElement;

        function buildImage(width: number, height: number): HTMLImageElement {
            const el = document.createElement('img');
            // jsdom/headless gives 0 layout, so stub getBoundingClientRect.
            el.getBoundingClientRect = () =>
                ({ width, height, top: 0, left: 0, right: width, bottom: height } as DOMRect);
            Object.defineProperty(el, 'width', { value: width, configurable: true });
            Object.defineProperty(el, 'height', { value: height, configurable: true });
            return el;
        }

        beforeEach(() => {
            img = buildImage(100, 50);
            container = document.createElement('div');
            document.body.appendChild(container);
            fixture.componentRef.setInput('target', img);
            fixture.componentRef.setInput('container', container);
            fixture.detectChanges();
        });

        type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

        function dragHandle(handle: Handle, deltaX: number, deltaY = 0): void {
            const start = {
                clientX: 0,
                clientY: 0,
                preventDefault: () => {},
                stopPropagation: () => {},
            } as unknown as MouseEvent;
            component.startResize(start, handle);
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: deltaX, clientY: deltaY }));
        }

        it('grows width and height (keeping aspect) when dragging the SE handle right', () => {
            dragHandle('se', 50);
            // aspect = 100/50 = 2; newWidth = 150 -> newHeight = 75
            expect(img.style.width).toBe('150px');
            expect(img.style.height).toBe('75px');
        });

        it('grows when dragging the NE handle right', () => {
            dragHandle('ne', 20);
            expect(img.style.width).toBe('120px');
            expect(img.style.height).toBe('60px');
        });

        it('shrinks width when dragging the SW handle right', () => {
            dragHandle('sw', 40);
            // sw subtracts deltaX: newWidth = 100 - 40 = 60 -> newHeight = 30
            expect(img.style.width).toBe('60px');
            expect(img.style.height).toBe('30px');
        });

        it('shrinks when dragging the NW handle right', () => {
            dragHandle('nw', 30);
            expect(img.style.width).toBe('70px');
            expect(img.style.height).toBe('35px');
        });

        it('stops AT the 20px minimum rather than freezing', () => {
            // This asserted that an undersized drag writes NOTHING -- which is
            // the frozen-drag symptom, enshrined as the contract. With the ratio
            // locked the gate in onPointerMove cannot be satisfied by shrinking
            // further, so the image simply stopped responding. Clamping to the
            // bound is what the resize was always documented to do.
            // 100x50 dragged to 10x5: the short side lands on the floor and the
            // 2:1 ratio holds.
            dragHandle('sw', 90);
            expect(img.style.width).toBe('40px');
            expect(img.style.height).toBe('20px');
        });

        it('respects a custom minWidth floor', () => {
            fixture.componentRef.setInput('minWidth', 80);
            fixture.detectChanges();
            dragHandle('sw', 40);
            expect(img.style.width).toBe('160px');
            expect(img.style.height).toBe('80px');
        });

        function retarget(el: HTMLImageElement): void {
            fixture.componentRef.setInput('target', el);
            fixture.detectChanges();
        }

        it('bounds height on the LOCKED-aspect path, which is the default', () => {
            // lockedSize derived height by an unclamped division, and
            // lockAspectRatio defaults to true -- a tall narrow image reached
            // 5,000,000px. The bound must hold on whichever axis hits it first,
            // and must scale the other axis with it.
            dragHandle('se', 100000);
            expect(img.style.width).toBe('10000px');
            expect(img.style.height).toBe('5000px');
            document.dispatchEvent(new MouseEvent('mouseup'));

            const tall = buildImage(20, 5000);
            retarget(tall);
            dragHandle('e', 100000);
            expect(tall.style.width).toBe('40px');
            expect(tall.style.height).toBe('10000px');
        });

        it('honours the requested width while the ratio allows it', () => {
            // With a 50:1 ratio and a 20px floor, ANY width under 1000px forces
            // the height under the floor, so clamping to one minimum size there
            // is correct geometry, not a freeze. Above it the width must track
            // the request.
            const banner = buildImage(2000, 40);
            retarget(banner);
            const dragTo = (dx: number): string[] => {
                // A refused write leaves the previous size behind; clear it so
                // every drag is judged on what it wrote itself.
                banner.removeAttribute('style');
                dragHandle('e', dx);
                document.dispatchEvent(new MouseEvent('mouseup'));
                return [banner.style.width, banner.style.height];
            };

            expect(dragTo(-500)).toEqual(['1500px', '30px']);
            expect(dragTo(-1000)).toEqual(['1000px', '20px']);
            expect(dragTo(-1900)).toEqual(['1000px', '20px']);
        });

        it('never returns a dimension under the floor it enforces', () => {
            // A 1:1000 sliver: the floor must hold on both axes.
            const sliver = buildImage(10, 10000);
            retarget(sliver);
            dragHandle('e', 8990);
            expect(Number.parseFloat(sliver.style.width)).toBeGreaterThanOrEqual(20);
            expect(Number.parseFloat(sliver.style.height)).toBeGreaterThanOrEqual(20);
        });

        it('clamps width to maxWidth when growing past the ceiling', () => {
            fixture.componentRef.setInput('maxWidth', 130);
            fixture.detectChanges();
            // newWidth = 100 + 200 = 300 -> clamped to 130 -> height = 65
            dragHandle('se', 200);
            expect(img.style.width).toBe('130px');
            expect(img.style.height).toBe('65px');
        });

        describe('free resize (lockAspectRatio = false)', () => {
            beforeEach(() => {
                fixture.componentRef.setInput('lockAspectRatio', false);
                fixture.detectChanges();
            });

            it('changes only width when dragging the E edge handle', () => {
                dragHandle('e', 40, 30);
                // width grows by deltaX, height untouched by an E handle
                expect(img.style.width).toBe('140px');
                expect(img.style.height).toBe('50px');
            });

            it('changes only height when dragging the S edge handle', () => {
                dragHandle('s', 40, 30);
                expect(img.style.width).toBe('100px');
                expect(img.style.height).toBe('80px');
            });

            it('changes both axes non-uniformly when dragging a corner', () => {
                dragHandle('se', 40, 10);
                // width = 100 + 40, height = 50 + 10 (aspect not preserved)
                expect(img.style.width).toBe('140px');
                expect(img.style.height).toBe('60px');
            });

            it('clamps height at the minimum instead of freezing the drag', () => {
                dragHandle('n', 0, 400);
                expect(img.style.width).toBe('100px');
                expect(img.style.height).toBe('20px');
            });

            it('bounds height at an absolute maximum', () => {
                // Removing the width ceiling was right; leaving height with NO
                // upper bound reintroduced the 100,000px drag.
                dragHandle('se', 100, 100000);
                expect(img.style.width).toBe('200px');
                expect(img.style.height).toBe('10000px');
            });

            it('bounds WIDTH at both ends, like height', () => {
                // The height fix covered one of two mirror-image axes; a
                // 100px drag on the broken one was a degenerate input for it.
                dragHandle('e', 100000);
                expect(img.style.width).toBe('10000px');
                document.dispatchEvent(new MouseEvent('mouseup'));

                dragHandle('e', -5000);
                expect(img.style.width).toBe('20px');
                expect(img.style.height).toBe('50px');
            });
        });

        it('emits resizeEnd on mouseup and clears drag listeners', () => {
            let ended = false;
            component.resizeEnd.subscribe(() => (ended = true));

            dragHandle('se', 50);
            document.dispatchEvent(new MouseEvent('mouseup'));
            expect(ended).toBe(true);

            // After mouseup, further mousemove should not change dimensions.
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 0 }));
            expect(img.style.width).toBe('150px');
        });

        it('ignores pointer moves after the target is cleared mid-drag', () => {
            // A throw inside a document listener never reaches dispatchEvent's
            // caller; it is reported on the window, so that is where to look.
            const errors: unknown[] = [];
            const onError = (e: ErrorEvent): void => {
                errors.push(e.error);
                e.preventDefault();
            };
            globalThis.addEventListener('error', onError);
            try {
                const start = {
                    clientX: 0,
                    clientY: 0,
                    preventDefault: () => {},
                    stopPropagation: () => {},
                } as unknown as MouseEvent;
                component.startResize(start, 'se');
                fixture.componentRef.setInput('target', null);
                fixture.detectChanges();

                document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 0 }));
                document.dispatchEvent(new MouseEvent('mouseup'));
            } finally {
                globalThis.removeEventListener('error', onError);
            }
            expect(errors).toEqual([]);
            expect(img.style.width).toBe('');
        });

        it('does nothing on startResize when there is no target', () => {
            fixture.componentRef.setInput('target', null);
            fixture.detectChanges();
            const start = {
                clientX: 0,
                clientY: 0,
                preventDefault: () => {},
                stopPropagation: () => {},
            } as unknown as MouseEvent;
            // Should be a no-op (no listeners added, no throw).
            expect(() => component.startResize(start, 'se')).not.toThrow();
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 0 }));
            expect(img.style.width).toBe('');
        });

        it('calls preventDefault and stopPropagation on startResize', () => {
            const preventDefault = vi.fn();
            const stopPropagation = vi.fn();
            const start = {
                clientX: 0,
                clientY: 0,
                preventDefault,
                stopPropagation,
            } as unknown as MouseEvent;
            component.startResize(start, 'se');
            expect(preventDefault).toHaveBeenCalled();
            expect(stopPropagation).toHaveBeenCalled();
            document.dispatchEvent(new MouseEvent('mouseup'));
        });

        describe('touch input', () => {
            function touchStart(clientX: number, clientY: number): TouchEvent {
                return {
                    touches: [{ clientX, clientY }],
                    changedTouches: [{ clientX, clientY }],
                    preventDefault: () => {},
                    stopPropagation: () => {},
                } as unknown as TouchEvent;
            }

            function dispatchTouch(type: string, clientX: number, clientY: number): void {
                const ev = new Event(type, { bubbles: true, cancelable: true });
                Object.defineProperty(ev, 'touches', { value: [{ clientX, clientY }] });
                Object.defineProperty(ev, 'changedTouches', { value: [{ clientX, clientY }] });
                document.dispatchEvent(ev);
            }

            it('resizes via touchstart + touchmove just like the mouse', () => {
                component.startResize(touchStart(0, 0), 'se');
                dispatchTouch('touchmove', 50, 0);
                // aspect = 100/50 = 2; newWidth = 150 -> newHeight = 75
                expect(img.style.width).toBe('150px');
                expect(img.style.height).toBe('75px');
            });

            it('falls back to changedTouches when touches is empty', () => {
                const event = {
                    touches: [] as unknown as TouchList,
                    changedTouches: [{ clientX: 5, clientY: 5 }] as unknown as TouchList,
                    preventDefault: () => {},
                    stopPropagation: () => {},
                } as unknown as TouchEvent;
                component.startResize(event, 'se');
                // The drag is measured from the changedTouches point (5,5).
                dispatchTouch('touchmove', 55, 5);
                expect(img.style.width).toBe('150px');
                expect(img.style.height).toBe('75px');
                dispatchTouch('touchend', 55, 5);
            });

            it('emits resizeEnd on touchend and clears touch listeners', () => {
                let ended = false;
                component.resizeEnd.subscribe(() => (ended = true));

                component.startResize(touchStart(0, 0), 'se');
                dispatchTouch('touchmove', 50, 0);
                dispatchTouch('touchend', 50, 0);
                expect(ended).toBe(true);

                // After touchend, further touchmove must not change dimensions.
                dispatchTouch('touchmove', 200, 0);
                expect(img.style.width).toBe('150px');
            });
        });
    });

    describe('handle & toolbar rendering', () => {
        const cornerSelector =
            '[class*="cursor-nw-resize"], [class*="cursor-ne-resize"], [class*="cursor-sw-resize"], [class*="cursor-se-resize"]';
        const edgeSelector = '[class*="cursor-ns-resize"], [class*="cursor-ew-resize"]';

        function setTarget(): void {
            const img = document.createElement('img');
            const container = document.createElement('div');
            fixture.componentRef.setInput('container', container);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();
        }

        function query(selector: string): NodeListOf<Element> {
            return (fixture.nativeElement as HTMLElement).querySelectorAll(selector);
        }

        it('renders four corner handles by default', () => {
            setTarget();
            expect(query(cornerSelector)).toHaveLength(4);
        });

        it('hides corner handles when resizable is false', () => {
            fixture.componentRef.setInput('resizable', false);
            setTarget();
            expect(query(cornerSelector)).toHaveLength(0);
        });

        it('hides edge handles while aspect ratio is locked', () => {
            setTarget();
            expect(query(edgeSelector)).toHaveLength(0);
        });

        it('shows four edge handles when aspect ratio is unlocked', () => {
            fixture.componentRef.setInput('lockAspectRatio', false);
            setTarget();
            expect(query(edgeSelector)).toHaveLength(4);
        });

        it('renders alignment buttons plus delete by default', () => {
            setTarget();
            // Scoped to the toolbar: the resize handles are buttons too now, so
            // a bare 'button' count no longer means "toolbar buttons".
            expect(query('button[title]')).toHaveLength(5);
        });

        it('keeps only the delete button when showAlignment is false', () => {
            fixture.componentRef.setInput('showAlignment', false);
            setTarget();
            const buttons = query('button[title]');
            expect(buttons).toHaveLength(1);
            expect(buttons[0].getAttribute('title')).toBe(LABELS_EN.deleteImage);
        });
    });

    describe('tracking lifecycle', () => {
        const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

        /** A tracked image inside a 200x200 container, with a movable rect. */
        async function mountVisible(): Promise<{ img: HTMLImageElement; container: HTMLElement; moveTo(top: number): void }> {
            let top = 10;
            const img = document.createElement('img');
            img.getBoundingClientRect = () =>
                ({ width: 80, height: 40, top, left: 10, right: 90, bottom: top + 40 } as DOMRect);
            const container = document.createElement('div');
            container.getBoundingClientRect = () =>
                ({ width: 200, height: 200, top: 0, left: 0, right: 200, bottom: 200 } as DOMRect);
            document.body.appendChild(container);
            fixture.componentRef.setInput('container', container);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();
            await frame();
            expect(component.visible()).toBe(true);
            return { img, container, moveTo: (t: number) => { top = t; } };
        }

        it('becomes visible and computes a rect when target overlaps the container', async () => {
            const img = document.createElement('img');
            img.getBoundingClientRect = () =>
                ({ width: 80, height: 40, top: 10, left: 10, right: 90, bottom: 50 } as DOMRect);
            const container = document.createElement('div');
            container.getBoundingClientRect = () =>
                ({ width: 200, height: 200, top: 0, left: 0, right: 200, bottom: 200 } as DOMRect);

            fixture.componentRef.setInput('container', container);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            await new Promise((r) => requestAnimationFrame(() => r(null)));

            expect(component.visible()).toBe(true);
            expect(component.rect()).toEqual({ top: 10, left: 10, width: 80, height: 40 });
        });

        it('hides when the target is scrolled out of the container', async () => {
            const img = document.createElement('img');
            img.getBoundingClientRect = () =>
                ({ width: 80, height: 40, top: 500, left: 10, right: 90, bottom: 540 } as DOMRect);
            const container = document.createElement('div');
            container.getBoundingClientRect = () =>
                ({ width: 200, height: 200, top: 0, left: 0, right: 200, bottom: 200 } as DOMRect);

            fixture.componentRef.setInput('container', container);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            await new Promise((r) => requestAnimationFrame(() => r(null)));

            expect(component.visible()).toBe(false);
        });

        it('hides when the container goes away while a target is tracked', async () => {
            const { container } = await mountVisible();

            fixture.componentRef.setInput('container', null);
            fixture.detectChanges();
            await frame();

            expect(component.visible()).toBe(false);
            container.remove();
        });

        it('stops tracking and hides when the target is cleared', async () => {
            const { container } = await mountVisible();

            fixture.componentRef.setInput('target', null);
            fixture.detectChanges();

            expect(component.visible()).toBe(false);
            container.remove();
        });

        it('re-measures on container scroll and window resize', async () => {
            const { container, moveTo } = await mountVisible();

            moveTo(30);
            container.dispatchEvent(new Event('scroll'));
            await frame();
            expect(component.rect().top).toBe(30);

            moveTo(50);
            globalThis.dispatchEvent(new Event('resize'));
            await frame();
            expect(component.rect().top).toBe(50);
            container.remove();
        });

        it('re-measures when the ResizeObserver fires', async () => {
            let observed: (() => void) | null = null;
            class CapturingResizeObserver {
                constructor(cb: () => void) { observed = cb; }
                observe(): void { /* no-op */ }
                unobserve(): void { /* no-op */ }
                disconnect(): void { /* no-op */ }
            }
            (globalThis as ResizeObserverGlobal).ResizeObserver =
                CapturingResizeObserver as unknown as typeof ResizeObserver;

            const { container, moveTo } = await mountVisible();
            moveTo(60);
            observed!();
            await frame();

            expect(component.rect().top).toBe(60);
            container.remove();
        });

        it('stops a drag in progress when destroyed', () => {
            const img = document.createElement('img');
            img.getBoundingClientRect = () =>
                ({ width: 100, height: 50, top: 0, left: 0, right: 100, bottom: 50 } as DOMRect);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();
            component.startResize(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }), 'se');

            fixture.destroy();
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 0 }));

            expect(img.style.width).toBe('');
        });
    });

    describe('keyboard activation of the overlay buttons (round-15 audit)', () => {
        function mountWithImage(): HTMLImageElement {
            const img = document.createElement('img');
            img.src =
                'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            document.body.appendChild(img);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();
            return img;
        }

        function overlayButtons(): HTMLButtonElement[] {
            return Array.from(
                (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
            );
        }

        it('applies an alignment on a keyboard-generated click', () => {
            // The buttons bound (mousedown) only, so a focused button pressed
            // with Enter did nothing at all -- focusable and inert. A keyboard
            // click carries detail === 0, which is what this dispatches.
            const img = mountWithImage();
            const emitted: string[] = [];
            component.alignmentChange.subscribe((a) => emitted.push(a));

            const right = overlayButtons().find(
                (b) => b.getAttribute('aria-label') === component.resolvedAlignmentLabels()['right'],
            );
            expect(right).toBeTruthy();
            right!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

            expect(emitted).toEqual(['right']);
            expect(img.dataset['align']).toBe('right');
            expect(img.style.float).toBe('right');
            img.remove();
        });

        it('emits a removal once for a keyboard click', () => {
            const img = mountWithImage();
            const removed: HTMLElement[] = [];
            component.imageRemove.subscribe((t) => removed.push(t));

            const del = overlayButtons().find(
                (b) => b.getAttribute('aria-label') === component.labels().deleteImage,
            );
            del!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

            expect(removed).toEqual([img]);
            img.remove();
        });

        it('does not act twice when a mouse press fires mousedown then click', () => {
            const img = mountWithImage();
            const removed: HTMLElement[] = [];
            component.imageRemove.subscribe((t) => removed.push(t));

            const del = overlayButtons().find(
                (b) => b.getAttribute('aria-label') === component.labels().deleteImage,
            );
            del!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, detail: 1 }));
            del!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

            expect(removed).toHaveLength(1);
            img.remove();
        });

        it('names every overlay button for assistive tech', () => {
            mountWithImage();
            for (const b of overlayButtons()) {
                expect(b.getAttribute('aria-label')?.length).toBeGreaterThan(0);
            }
        });
    });

    describe('keyboard resizing', () => {
        function mountWithImage(): HTMLImageElement {
            const img = document.createElement('img');
            img.src =
                'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            Object.defineProperty(img, 'getBoundingClientRect', {
                value: () => ({ width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100 }),
            });
            document.body.appendChild(img);
            fixture.componentRef.setInput('target', img);
            fixture.componentRef.setInput('lockAspectRatio', false);
            fixture.detectChanges();
            return img;
        }

        function handle(name: string): HTMLButtonElement {
            const label = component.handleLabel(name as never);
            return (fixture.nativeElement as HTMLElement).querySelector(
                `button[aria-label="${label}"]`,
            ) as HTMLButtonElement;
        }

        function press(el: HTMLButtonElement, key: string, shift = false): void {
            el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true }));
        }

        it('honours the handle: the east edge grows on ArrowRight', () => {
            const img = mountWithImage();
            press(handle('e'), 'ArrowRight');
            expect(img.style.width).toBe('210px');
        });

        it('honours the handle: the west edge SHRINKS on ArrowRight', () => {
            // Every handle used to grow the image on ArrowRight. Dragging the
            // west edge rightwards makes the image narrower, and WIDTH_SIGN.w
            // has said so all along -- the keyboard path just ignored it.
            const img = mountWithImage();
            press(handle('w'), 'ArrowRight');
            expect(img.style.width).toBe('190px');
        });

        it('does not resize width from a handle that only moves vertically', () => {
            // WIDTH_SIGN.n is 0, so the north edge must not change the width.
            const img = mountWithImage();
            press(handle('n'), 'ArrowRight');
            expect(img.style.width).toBe('');
        });

        it('resizes height from the south edge on ArrowDown', () => {
            const img = mountWithImage();
            press(handle('s'), 'ArrowDown');
            expect(img.style.height).toBe('110px');
        });

        it('takes a larger step with Shift held', () => {
            const img = mountWithImage();
            press(handle('e'), 'ArrowRight', true);
            expect(img.style.width).toBe('250px');
        });

        it('folds a run of keypresses into ONE history entry', () => {
            // A whole mouse drag records one entry; the keyboard path emitted
            // per press, so undoing a keyboard resize took N undos.
            vi.useFakeTimers();
            try {
                mountWithImage();
                let ends = 0;
                component.resizeEnd.subscribe(() => ends++);

                const e = handle('e');
                for (let i = 0; i < 5; i++) press(e, 'ArrowRight');
                expect(ends).toBe(0);

                vi.advanceTimersByTime(500);
                expect(ends).toBe(1);
            } finally {
                vi.useRealTimers();
            }
        });


        it('leaves a vertical arrow on a corner to the page when aspect is locked', () => {
            // With the ratio locked the height follows the width, so Up/Down on
            // a corner cannot do anything -- but the handler consumed the event
            // anyway, so the user pressed Up, nothing happened, and their page
            // scroll was eaten too.
            fixture.componentRef.setInput('lockAspectRatio', true);
            const img = mountWithImage();
            fixture.componentRef.setInput('lockAspectRatio', true);
            fixture.detectChanges();

            const corner = handle('se');
            const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
            corner.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(false);
            expect(img.style.width).toBe('');
        });

        it('does not apply the WIDTH ceiling to height', () => {
            // maxWidth is a width ceiling. Using it for height silently squashed
            // every portrait image, and the previous version of this test
            // asserted that squashing as the contract.
            fixture.componentRef.setInput('lockAspectRatio', false);
            fixture.componentRef.setInput('maxWidth', 120);
            const img = mountWithImage();
            fixture.componentRef.setInput('lockAspectRatio', false);
            fixture.componentRef.setInput('maxWidth', 120);
            fixture.detectChanges();

            press(handle('s'), 'ArrowDown', true);
            expect(Number.parseFloat(img.style.height)).toBeGreaterThan(120);
            // The width ceiling still applies to width.
            press(handle('e'), 'ArrowRight', true);
            expect(Number.parseFloat(img.style.width)).toBeLessThanOrEqual(120);
        });


        it('bounds height on the KEYBOARD path with the ratio locked', () => {
            // Round 22 bounded lockedSize -- the DRAG path. The keyboard path 55
            // lines above derives height by the same unclamped division, and this
            // whole describe block's mountWithImage sets lockAspectRatio:false,
            // so every keyboard test ran the ratio-unlocked branch. Third
            // instance of testing the mirror function.
            const img = document.createElement('img');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            Object.defineProperty(img, 'getBoundingClientRect', {
                value: () => ({ width: 20, height: 10000, top: 0, left: 0, right: 20, bottom: 10000 }),
            });
            document.body.appendChild(img);
            fixture.componentRef.setInput('target', img);
            fixture.componentRef.setInput('lockAspectRatio', true);
            fixture.detectChanges();

            // The SE corner: rendered while the ratio is locked (the edge
            // handles are not), and WIDTH_SIGN is +1 there so ArrowRight grows.
            const handle = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
                `button[aria-label="${component.handleLabel('se' as never)}"]`,
            );
            handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            expect(Number.parseFloat(img.style.height)).toBeLessThanOrEqual(10000);
            img.remove();
        });


        it('ignores keys that are not arrows', () => {
            const img = mountWithImage();
            press(handle('e'), 'a');
            expect(img.style.width).toBe('');
        });
    });

});
