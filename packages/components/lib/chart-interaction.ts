/**
 * Chart Interaction Helpers
 * Pointer normalization (mouse + touch) and nearest-point detection used by
 * crosshair, tooltip, and brush behaviours across cartesian charts.
 *
 * Pure functions, no Angular. Centralizing pointer math here gives every chart
 * mouse/touch parity for free (CLAUDE.md Section 6).
 */

export interface IndexedX<T> {
    x: number;
    datum: T;
}

export interface IndexedXY<T> {
    x: number;
    y: number;
    datum: T;
}

export interface NearestResult<P> {
    index: number;
    point: P;
}

/** Find the point whose x is closest to the pointer x (clamps at the ends). */
export function nearestPointX<T>(
    pointerX: number,
    points: IndexedX<T>[],
): NearestResult<IndexedX<T>> | null {
    if (points.length === 0) return null;
    let bestIndex = 0;
    let bestDist = Math.abs(points[0].x - pointerX);
    for (let i = 1; i < points.length; i++) {
        const dist = Math.abs(points[i].x - pointerX);
        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
        }
    }
    return { index: bestIndex, point: points[bestIndex] };
}

/** Find the euclidean-nearest point to a 2-D pointer. */
export function nearestPoint2D<T>(
    pointer: { x: number; y: number },
    points: IndexedXY<T>[],
): NearestResult<IndexedXY<T>> | null {
    if (points.length === 0) return null;
    let bestIndex = 0;
    let bestDist = Math.hypot(points[0].x - pointer.x, points[0].y - pointer.y);
    for (let i = 1; i < points.length; i++) {
        const dist = Math.hypot(points[i].x - pointer.x, points[i].y - pointer.y);
        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
        }
    }
    return { index: bestIndex, point: points[bestIndex] };
}

export interface ClientPoint {
    clientX: number;
    clientY: number;
}

/** Extract client coordinates from a mouse or touch event. */
export function getClientPoint(evt: MouseEvent | TouchEvent): ClientPoint {
    if ('touches' in evt) {
        const touch = evt.touches[0] ?? evt.changedTouches[0];
        return { clientX: touch?.clientX ?? 0, clientY: touch?.clientY ?? 0 };
    }
    return { clientX: evt.clientX, clientY: evt.clientY };
}

/** Map a pointer event to SVG user-space coordinates (mouse + touch). */
export function pointerToSvg(evt: MouseEvent | TouchEvent, svg: SVGSVGElement): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    const { clientX, clientY } = getClientPoint(evt);
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const viewBox = svg.viewBox.baseVal;
    if (viewBox && viewBox.width > 0 && rect.width > 0 && rect.height > 0) {
        return {
            x: (localX / rect.width) * viewBox.width,
            y: (localY / rect.height) * viewBox.height,
        };
    }
    return { x: localX, y: localY };
}

const TOOLTIP_POINTER_OFFSET = 12;

/**
 * Where to park a chart tooltip for a hover/focus event, in pixels from the
 * chart's `relative` wrapper (the tooltip's containing block). Any mouse
 * event, a legend entry's hover included, anchors just past the pointer; a
 * focus event, which has no pointer, anchors to the centre of its target.
 * Returns `null` when the event has no element or no `relative` ancestor.
 */
export function tooltipAnchor(evt: Event): { x: number; y: number } | null {
    const target = evt.currentTarget;
    if (!(target instanceof Element)) return null;
    const container = target.closest('.relative');
    if (!container) return null;
    const box = container.getBoundingClientRect();
    let clientX: number;
    let clientY: number;
    if (evt instanceof MouseEvent) {
        clientX = evt.clientX + TOOLTIP_POINTER_OFFSET;
        clientY = evt.clientY + TOOLTIP_POINTER_OFFSET;
    } else {
        const rect = target.getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
    }
    return { x: Math.max(0, clientX - box.left), y: Math.max(0, clientY - box.top) };
}

/** Parks a chart's tooltip signal at {@link tooltipAnchor} for `evt`; a no-op when there is no event to anchor to. */
export function placeTooltip(position: { set(value: { x: number; y: number }): void }, evt?: Event): void {
    const anchor = evt ? tooltipAnchor(evt) : null;
    if (anchor) position.set(anchor);
}
