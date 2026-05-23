/**
 * Edge-triggered auto-scroll for drag operations.
 *
 * Usage:
 *   const scroller = startAutoScroll({ edge: 40, maxSpeed: 12 });
 *   // on every pointer move during a drag:
 *   scroller.update(clientX, clientY);
 *   // on drag end:
 *   scroller.stop();
 *
 * Each frame the controller locates the nearest scrollable ancestor under
 * the pointer and, if the pointer is within `edge` pixels of one of that
 * ancestor's edges, scrolls toward that edge at a speed proportional to
 * proximity. Independent scroll containers (e.g. separate kanban columns)
 * are handled naturally because the target is recomputed every frame
 * via `elementFromPoint`.
 *
 * The controller is idempotent: calling stop() without an active loop is
 * safe; calling update() after stop() restarts the loop.
 */

export interface AutoScrollOptions {
    /** Distance from a scrollable edge (in px) within which scrolling kicks in. Default 40. */
    readonly edge?: number;
    /** Maximum scroll speed in pixels per frame at the edge itself. Default 12. */
    readonly maxSpeed?: number;
    /** Override the window used for elementFromPoint and rAF (testing hook). */
    readonly win?: Window;
}

export interface AutoScrollController {
    /** Report the current pointer position; starts the rAF loop if needed. */
    update(clientX: number, clientY: number): void;
    /** Stop the rAF loop. Safe to call repeatedly. */
    stop(): void;
}

interface Vec2 {
    readonly x: number;
    readonly y: number;
}

interface ScrollDelta {
    readonly dx: number;
    readonly dy: number;
}

function isScrollable(el: Element): boolean {
    if (!(el instanceof HTMLElement)) return false;
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    if (!style) return false;
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const scrollableY = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    const scrollableX = (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
    return scrollableY || scrollableX;
}

function findScrollableAncestor(start: Element | null): HTMLElement | null {
    let node: Element | null = start;
    while (node !== null) {
        if (isScrollable(node)) return node as HTMLElement;
        node = node.parentElement;
    }
    return null;
}

function computeDelta(rect: DOMRect, pointer: Vec2, edge: number, maxSpeed: number): ScrollDelta {
    const distLeft = pointer.x - rect.left;
    const distRight = rect.right - pointer.x;
    const distTop = pointer.y - rect.top;
    const distBottom = rect.bottom - pointer.y;

    return {
        dx: axisDelta(distLeft, distRight, edge, maxSpeed),
        dy: axisDelta(distTop, distBottom, edge, maxSpeed),
    };
}

function axisDelta(distStart: number, distEnd: number, edge: number, maxSpeed: number): number {
    if (distStart < edge && distStart >= 0) {
        return -Math.round(maxSpeed * (1 - distStart / edge));
    }
    if (distEnd < edge && distEnd >= 0) {
        return Math.round(maxSpeed * (1 - distEnd / edge));
    }
    return 0;
}

function scrollContainer(container: HTMLElement | Window, delta: ScrollDelta): void {
    if (delta.dx === 0 && delta.dy === 0) return;
    container.scrollBy({ left: delta.dx, top: delta.dy, behavior: 'auto' });
}

function viewportRect(win: Window): DOMRect {
    return new DOMRect(0, 0, win.innerWidth, win.innerHeight);
}

function pickTarget(
    win: Window,
    pointer: Vec2,
): { container: HTMLElement | Window; rect: DOMRect } {
    const beneath = win.document.elementFromPoint(pointer.x, pointer.y);
    const ancestor = findScrollableAncestor(beneath);
    if (ancestor !== null) {
        return { container: ancestor, rect: ancestor.getBoundingClientRect() };
    }
    return { container: win, rect: viewportRect(win) };
}

/** Start an auto-scroll controller. Caller must invoke `update()` on every pointer move. */
export function startAutoScroll(options: AutoScrollOptions = {}): AutoScrollController {
    const edge = options.edge ?? 40;
    const maxSpeed = options.maxSpeed ?? 12;
    const win = options.win ?? globalThis.window;

    let pointer: Vec2 | null = null;
    let rafId: number | null = null;

    const tick = (): void => {
        rafId = null;
        if (pointer === null || !win) return;
        const { container, rect } = pickTarget(win, pointer);
        const delta = computeDelta(rect, pointer, edge, maxSpeed);
        scrollContainer(container, delta);
        rafId = win.requestAnimationFrame(tick);
    };

    return {
        update(clientX: number, clientY: number): void {
            pointer = { x: clientX, y: clientY };
            if (rafId === null && win) {
                rafId = win.requestAnimationFrame(tick);
            }
        },
        stop(): void {
            pointer = null;
            if (rafId !== null && win) {
                win.cancelAnimationFrame(rafId);
                rafId = null;
            }
        },
    };
}
