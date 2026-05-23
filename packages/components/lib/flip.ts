/**
 * FLIP animation engine — First, Last, Invert, Play.
 *
 * Usage:
 *   const flip = createFlip(() => Array.from(container.querySelectorAll('.item')));
 *   flip.measure();           // before the DOM mutation
 *   // ... mutate the list / re-render ...
 *   await flip.play(200);     // after the mutation; animates each element
 *                             // from its previous rect to its new rect.
 *
 * Elements not present in both measurements are skipped.
 * Elements that moved less than 1px are skipped.
 * When prefers-reduced-motion is set, play() is a no-op — no animations run
 * and elements remain at their post-mutation positions, giving the same
 * observable end state as a 0ms animation.
 *
 * Element identity is matched by reference, so the same DOM node must be
 * returned by the elements() callback before and after the mutation.
 * Frameworks that recycle nodes (e.g. *ngFor track by index when items
 * change identity) need a stable track function for FLIP to work.
 */

export interface FlipHandle {
    /** Snapshot current rects of every element. Call before the mutation. */
    measure(): void;

    /**
     * Diff against the snapshot, apply inverse transforms, then animate
     * back to identity over `durationMs`. Resolves when all animations
     * have finished (or immediately when reduced-motion is set).
     */
    play(durationMs: number): Promise<void>;

    /** Drop the current snapshot without playing. */
    reset(): void;

    /** Returns true if there is an active snapshot waiting to be played. */
    hasSnapshot(): boolean;
}

interface Snapshot {
    readonly element: HTMLElement;
    readonly rect: DOMRect;
}

function prefersReducedMotion(): boolean {
    return globalThis.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
}

function snapshot(elements: HTMLElement[]): Snapshot[] {
    return elements.map(element => ({ element, rect: element.getBoundingClientRect() }));
}

function findPrevious(snapshots: Snapshot[], element: HTMLElement): DOMRect | null {
    for (const snap of snapshots) {
        if (snap.element === element) return snap.rect;
    }
    return null;
}

function animatePair(
    element: HTMLElement,
    previous: DOMRect,
    durationMs: number,
): Animation | null {
    const next = element.getBoundingClientRect();
    const dx = previous.left - next.left;
    const dy = previous.top - next.top;
    if (Math.hypot(dx, dy) < 1) return null;

    return element.animate(
        [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0, 0)' },
        ],
        {
            duration: durationMs,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
            fill: 'none',
        },
    );
}

/**
 * Build a FLIP handle for a dynamic set of elements.
 * `elements` is called each time measure/play runs so the set can change.
 */
export function createFlip(elements: () => HTMLElement[]): FlipHandle {
    let snap: Snapshot[] | null = null;

    return {
        measure(): void {
            snap = snapshot(elements());
        },

        async play(durationMs: number): Promise<void> {
            const previousSnap = snap;
            snap = null;
            if (previousSnap === null) return;

            const duration = prefersReducedMotion() ? 0 : Math.max(0, durationMs);
            if (duration === 0) return;

            const animations: Animation[] = [];
            for (const element of elements()) {
                const previousRect = findPrevious(previousSnap, element);
                if (previousRect === null) continue;
                const animation = animatePair(element, previousRect, duration);
                if (animation !== null) animations.push(animation);
            }

            await Promise.all(animations.map(a => a.finished.catch(() => undefined)));
        },

        reset(): void {
            snap = null;
        },

        hasSnapshot(): boolean {
            return snap !== null;
        },
    };
}
