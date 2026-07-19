import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextImageResizerComponent, type RichTextImageResizerLabels } from './rich-text-images-resizer.component';
import { applyImageAlignment } from './rich-text-images.utils';

const LABELS_EN: RichTextImageResizerLabels = {
    inline: 'Inline with text',
    floatLeft: 'Float left',
    center: 'Center',
    floatRight: 'Float right',
    deleteImage: 'Delete image',
};
const LABELS_HE: RichTextImageResizerLabels = {
    inline: 'בתוך הטקסט',
    floatLeft: 'הצמדה לשמאל',
    center: 'מירכוז',
    floatRight: 'הצמדה לימין',
    deleteImage: 'מחיקת תמונה',
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

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should default target to null', () => {
        expect(component.target()).toBeNull();
    });

    it('should default container to null', () => {
        expect(component.container()).toBeNull();
    });

    it('should not be visible when target is null', () => {
        expect(component.visible()).toBe(false);
    });

    it('should have alignment options', () => {
        expect(component.alignments).toEqual(['inline', 'left', 'center', 'right']);
    });

    it('should default currentAlignment to inline when no target', () => {
        expect(component.currentAlignment()).toBe('inline');
    });

    describe('applyImageAlignment', () => {
        let img: HTMLImageElement;

        beforeEach(() => {
            img = document.createElement('img');
        });

        it('should set display to inline for inline alignment', () => {
            applyImageAlignment(img, 'inline');

            expect(img.style.display).toBe('inline');
            expect(img.style.margin).toBe('0px');
        });

        it('should set float to left for left alignment', () => {
            applyImageAlignment(img, 'left');

            expect(img.style.display).toBe('block');
            expect(img.style.float).toBe('left');
            expect(img.style.marginRight).toBe('12px');
            expect(img.style.marginBottom).toBe('4px');
        });

        it('should set auto margins for center alignment', () => {
            applyImageAlignment(img, 'center');

            expect(img.style.display).toBe('block');
            expect(img.style.marginLeft).toBe('auto');
            expect(img.style.marginRight).toBe('auto');
        });

        it('should set float to right for right alignment', () => {
            applyImageAlignment(img, 'right');

            expect(img.style.display).toBe('block');
            expect(img.style.float).toBe('right');
            expect(img.style.marginLeft).toBe('12px');
            expect(img.style.marginBottom).toBe('4px');
        });

        it('should clear previous alignment styles when switching alignments', () => {
            applyImageAlignment(img, 'left');
            expect(img.style.float).toBe('left');

            applyImageAlignment(img, 'center');
            expect(img.style.float).toBe('');
            expect(img.style.marginLeft).toBe('auto');
            expect(img.style.marginRight).toBe('auto');
        });

        it('should clear float when switching from right to inline', () => {
            applyImageAlignment(img, 'right');
            expect(img.style.float).toBe('right');

            applyImageAlignment(img, 'inline');
            expect(img.style.float).toBe('');
            expect(img.style.display).toBe('inline');
        });
    });

    describe('onDeleteClick', () => {
        it('should emit imageRemove with the target element', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            let emittedTarget: HTMLImageElement | undefined;
            component.imageRemove.subscribe((target) => {
                emittedTarget = target;
            });

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onDeleteClick(mockEvent);

            expect(emittedTarget).toBe(img);
        });

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
        it('should emit alignmentChange with the selected alignment', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            let emittedAlignment: string | undefined;
            component.alignmentChange.subscribe((align) => {
                emittedAlignment = align;
            });

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onAlignClick(mockEvent, 'center');

            expect(emittedAlignment).toBe('center');
        });

        it('should set data-align attribute on the target image', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onAlignClick(mockEvent, 'right');

            expect(img.dataset['align']).toBe('right');
        });

        it('should apply alignment styles to the target image', () => {
            const img = document.createElement('img');
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            const mockEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
            component.onAlignClick(mockEvent, 'left');

            expect(img.style.float).toBe('left');
            expect(img.style.display).toBe('block');
        });

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

        it('should return center when target has data-align set to center', () => {
            const img = document.createElement('img');
            img.dataset['align'] = 'center';
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(component.currentAlignment()).toBe('center');
        });

        it('should return right when target has data-align set to right', () => {
            const img = document.createElement('img');
            img.dataset['align'] = 'right';
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(component.currentAlignment()).toBe('right');
        });
    });

    describe('getAlignIcon', () => {
        it('returns a SafeHtml icon for each alignment', () => {
            for (const align of component.alignments) {
                expect(component.getAlignIcon(align)).toBeTruthy();
            }
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

        it('reflects a different label set', () => {
            fixture.componentRef.setInput('labels', LABELS_HE);
            fixture.detectChanges();
            const labels = component.resolvedAlignmentLabels();
            expect(labels.inline).toBe(LABELS_HE.inline);
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

        it('does not resize below the 20px minimum', () => {
            // Drag SW far enough that newWidth would drop to/under 20.
            dragHandle('sw', 90);
            // newWidth = 100 - 90 = 10 (< 20) -> no style applied
            expect(img.style.width).toBe('');
            expect(img.style.height).toBe('');
        });

        it('respects a custom minWidth floor', () => {
            fixture.componentRef.setInput('minWidth', 80);
            fixture.detectChanges();
            // newWidth = 100 - 40 = 60 (< 80) -> rejected
            dragHandle('sw', 40);
            expect(img.style.width).toBe('');
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
            const start = {
                clientX: 0,
                clientY: 0,
                preventDefault: () => {},
                stopPropagation: () => {},
            } as unknown as MouseEvent;
            component.startResize(start, 'se');
            fixture.componentRef.setInput('target', null);
            fixture.detectChanges();

            expect(() =>
                document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 0 })),
            ).not.toThrow();
            document.dispatchEvent(new MouseEvent('mouseup'));
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
                expect(() => component.startResize(event, 'se')).not.toThrow();
                document.dispatchEvent(new Event('touchend'));
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
            expect(query('button')).toHaveLength(5);
        });

        it('keeps only the delete button when showAlignment is false', () => {
            fixture.componentRef.setInput('showAlignment', false);
            setTarget();
            const buttons = query('button');
            expect(buttons).toHaveLength(1);
            expect(buttons[0].getAttribute('title')).toBe(LABELS_EN.deleteImage);
        });
    });

    describe('tracking lifecycle', () => {
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

        it('stays hidden when a target is tracked without a container', async () => {
            const img = document.createElement('img');
            img.getBoundingClientRect = () =>
                ({ width: 80, height: 40, top: 10, left: 10, right: 90, bottom: 50 } as DOMRect);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            await new Promise((r) => requestAnimationFrame(() => r(null)));

            expect(component.visible()).toBe(false);
        });

        it('stops tracking and hides when the target is cleared', () => {
            const img = document.createElement('img');
            const container = document.createElement('div');
            fixture.componentRef.setInput('container', container);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            fixture.componentRef.setInput('target', null);
            fixture.detectChanges();

            expect(component.visible()).toBe(false);
        });

        it('reschedules an update on container scroll and window resize', () => {
            const img = document.createElement('img');
            const container = document.createElement('div');
            document.body.appendChild(container);
            fixture.componentRef.setInput('container', container);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(() => {
                container.dispatchEvent(new Event('scroll'));
                window.dispatchEvent(new Event('resize'));
            }).not.toThrow();
            container.remove();
        });

        it('reschedules an update when the ResizeObserver fires', () => {
            let observed: (() => void) | null = null;
            class CapturingResizeObserver {
                constructor(cb: () => void) { observed = cb; }
                observe(): void { observed?.(); }
                unobserve(): void { /* no-op */ }
                disconnect(): void { /* no-op */ }
            }
            (globalThis as ResizeObserverGlobal).ResizeObserver =
                CapturingResizeObserver as unknown as typeof ResizeObserver;

            const img = document.createElement('img');
            const container = document.createElement('div');
            fixture.componentRef.setInput('container', container);
            fixture.componentRef.setInput('target', img);
            expect(() => fixture.detectChanges()).not.toThrow();
            expect(observed).not.toBeNull();
        });

        it('cleans up listeners on destroy without throwing', () => {
            const img = document.createElement('img');
            const container = document.createElement('div');
            fixture.componentRef.setInput('container', container);
            fixture.componentRef.setInput('target', img);
            fixture.detectChanges();

            expect(() => fixture.destroy()).not.toThrow();
        });
    });
});
