/**
 * Promote a popup panel into the browser's top layer so it escapes every
 * `overflow: hidden` ancestor.
 *
 * A `z-index` cannot do this. Stacking order only decides what paints in front
 * of what *within* the same clipping context — an ancestor with clipped overflow
 * cuts the panel off no matter how high its `z-index` is. That is why a picker
 * placed inside a card, an accordion panel, a scroll area or a dialog body
 * appears chopped in half.
 *
 * The native Popover API moves the element to the top layer, outside the normal
 * box tree, where nothing clips it and nothing can stack above it. The trade-off
 * is that a top-layer element resolves `position: fixed` against the viewport,
 * so the panel can no longer be laid out with `absolute` + `top-full` relative
 * to its trigger — it has to be given explicit viewport coordinates, which is
 * what {@link anchorToTopLayer} computes and keeps up to date.
 *
 * Engines without the API (and any element that is not connected when the call
 * is made) fall back to leaving the panel exactly where it was, so the previous
 * `absolute` behaviour still applies rather than the panel vanishing.
 */

/** Which edge of the anchor the panel sits against. */
export type TopLayerSide = 'top' | 'bottom';

/** How the panel lines up with the anchor along the inline axis. */
export type TopLayerAlign = 'start' | 'end';

export interface TopLayerOptions {
    /** Gap in pixels between the anchor and the panel. Defaults to 4. */
    readonly gap?: number;
    /** Preferred side; flips automatically when there is not enough room. */
    readonly side?: TopLayerSide;
    /** Inline alignment against the anchor. Defaults to `'start'`. */
    readonly align?: TopLayerAlign;
}

/** Controls a panel that has been promoted to the top layer. */
export interface TopLayerHandle {
    /** Recompute the panel's viewport position. Safe to call repeatedly. */
    reposition(): void;
    /** Return the panel to normal flow and detach the scroll/resize listeners. */
    release(): void;
    /** Whether the panel actually reached the top layer (false on a fallback). */
    readonly promoted: boolean;
}

/**
 * The Popover API surface, declared as optional because the lib types assume it
 * is always present while older engines do not ship it at all.
 */
type PopoverCapable = HTMLElement & {
    showPopover?: () => void;
    hidePopover?: () => void;
};

const supportsPopover = (el: HTMLElement): el is PopoverCapable =>
    typeof (el as PopoverCapable).showPopover === 'function';

/**
 * Keep the preferred side unless the panel does not fit there and genuinely
 * fits better on the other one, so a panel does not flip on a few pixels.
 */
function resolveSide(
    preferred: TopLayerSide,
    panelHeight: number,
    roomAbove: number,
    roomBelow: number,
): TopLayerSide {
    if (preferred === 'bottom') {
        const cramped = roomBelow < panelHeight && roomAbove > roomBelow;
        return cramped ? 'top' : 'bottom';
    }
    const cramped = roomAbove < panelHeight && roomBelow > roomAbove;
    return cramped ? 'bottom' : 'top';
}

/**
 * Write the panel's viewport coordinates, flipping side and clamping inline so
 * it stays on screen. Separate from {@link anchorToTopLayer} so the geometry can
 * be re-run on scroll and resize without re-promoting the element.
 */
function place(panel: HTMLElement, anchor: HTMLElement, opts: Required<TopLayerOptions>): void {
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const side = resolveSide(opts.side, p.height, a.top, globalThis.innerHeight - a.bottom);

    const top = side === 'bottom' ? a.bottom + opts.gap : a.top - p.height - opts.gap;
    const rawLeft = opts.align === 'start' ? a.left : a.right - p.width;
    const left = Math.max(opts.gap, Math.min(rawLeft, globalThis.innerWidth - p.width - opts.gap));

    panel.style.position = 'fixed';
    panel.style.inset = 'auto';
    panel.style.margin = '0';
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(Math.max(opts.gap, top))}px`;
}

/**
 * Place `panel` against `anchor` in the top layer and keep it there.
 *
 * Returns a handle whose `release()` MUST be called when the panel closes —
 * otherwise the element stays in the top layer and the listeners leak.
 *
 * When the panel cannot be promoted (no Popover API, or the element is not yet
 * connected — `showPopover` throws `InvalidStateError` in that case) the panel
 * is left untouched and `promoted` is false, so the caller's existing
 * `absolute` positioning continues to apply.
 */
export function anchorToTopLayer(
    panel: HTMLElement,
    anchor: HTMLElement,
    options: TopLayerOptions = {},
): TopLayerHandle {
    const gap = options.gap ?? 4;
    const align = options.align ?? 'start';
    const preferred = options.side ?? 'bottom';

    if (!supportsPopover(panel) || !panel.isConnected) {
        return { reposition: () => undefined, release: () => undefined, promoted: false };
    }

    const previousPosition = panel.style.position;
    const previousInset = panel.style.inset;
    const previousMargin = panel.style.margin;

    try {
        panel.setAttribute('popover', 'manual');
        panel.showPopover();
    } catch {
        panel.removeAttribute('popover');
        return { reposition: () => undefined, release: () => undefined, promoted: false };
    }

    const reposition = (): void => place(panel, anchor, { gap, side: preferred, align });

    reposition();

    // Capture phase so a scroll inside any ancestor keeps the panel on its
    // anchor, not just a scroll of the document.
    globalThis.addEventListener('scroll', reposition, true);
    globalThis.addEventListener('resize', reposition);

    return {
        reposition,
        promoted: true,
        release: () => {
            globalThis.removeEventListener('scroll', reposition, true);
            globalThis.removeEventListener('resize', reposition);
            try {
                panel.hidePopover?.();
            } catch {
                // Already disconnected — the element left the top layer with its subtree.
            }
            panel.removeAttribute('popover');
            panel.style.position = previousPosition;
            panel.style.inset = previousInset;
            panel.style.margin = previousMargin;
            panel.style.left = '';
            panel.style.top = '';
        },
    };
}
