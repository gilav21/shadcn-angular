import { ApplicationRef, createComponent, type Injector, type Type } from '@angular/core';

/** A mounted top-layer overlay: the created instance, its host, plus a teardown. */
export interface MountedOverlay<C> {
    instance: C;
    /** The fixed-position top-layer host element (for anchoring). */
    host: HTMLElement;
    /** Remove the overlay from the DOM and destroy the component. */
    destroy: () => void;
}

/**
 * Imperatively mount a standalone component into the native top layer (above
 * any modal the editor lives inside), positioned via the returned host
 * element. Inputs are assigned with `setInput`. Returns the instance +
 * teardown. Used by the optional action presets.
 */
export function mountTopLayer<C>(
    injector: Injector, component: Type<C>, inputs: Record<string, unknown> = {},
): MountedOverlay<C> {
    const appRef = injector.get(ApplicationRef);
    const host = document.createElement('div');
    host.setAttribute('popover', 'manual');
    host.style.position = 'fixed';
    host.style.margin = '0';
    host.style.padding = '0';
    host.style.border = '0';
    host.style.background = 'transparent';
    host.style.inset = 'auto';
    document.body.appendChild(host);

    const ref = createComponent(component, { environmentInjector: appRef.injector, hostElement: host });
    for (const [key, value] of Object.entries(inputs)) {
        ref.setInput(key, value);
    }
    appRef.attachView(ref.hostView);
    ref.changeDetectorRef.detectChanges();

    const popover = host as HTMLElement & { showPopover?: () => void; hidePopover?: () => void };
    popover.showPopover?.();

    return {
        instance: ref.instance,
        host,
        destroy: () => {
            popover.hidePopover?.();
            appRef.detachView(ref.hostView);
            ref.destroy();
            host.remove();
        },
    };
}

/** The resolved text direction of an element — so top-layer overlays (which are
 *  detached from the anchor's DOM subtree) can mirror the anchored content. */
export function directionOf(el: HTMLElement): 'ltr' | 'rtl' {
    return el.ownerDocument.defaultView?.getComputedStyle(el).direction === 'rtl' ? 'rtl' : 'ltr';
}

/** Clamp `value` into `[min, max]`, tolerating an inverted range (min > max). */
function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Position a mounted overlay's host near an anchor, kept inside the viewport:
 * clamped horizontally, and flipped above the anchor when there is no room
 * below. The overlay must already be in the DOM so its size can be measured.
 */
export function anchorOverlay(overlayHost: HTMLElement, anchor: HTMLElement, gap = 6): void {
    const rect = anchor.getBoundingClientRect();
    const size = overlayHost.getBoundingClientRect();
    const docEl = overlayHost.ownerDocument.documentElement;
    const vw = docEl.clientWidth;
    const vh = docEl.clientHeight;
    const margin = 8;

    const left = clamp(rect.left, margin, vw - size.width - margin);
    const below = rect.bottom + gap;
    const noRoomBelow = below + size.height > vh - margin;
    const canFlip = rect.top - gap - size.height >= margin;
    const top = noRoomBelow && canFlip
        ? rect.top - gap - size.height
        : clamp(below, margin, vh - size.height - margin);

    overlayHost.style.left = `${Math.round(left)}px`;
    overlayHost.style.top = `${Math.round(top)}px`;
}
