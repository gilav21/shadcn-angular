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
    if (viewBox && viewBox.width > 0 && rect.width > 0) {
        return {
            x: (localX / rect.width) * viewBox.width,
            y: (localY / rect.height) * viewBox.height,
        };
    }
    return { x: localX, y: localY };
}
