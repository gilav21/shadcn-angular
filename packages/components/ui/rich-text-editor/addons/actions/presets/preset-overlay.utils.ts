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

/** Position a mounted overlay's host element near an anchor element's rect. */
export function anchorOverlay(overlayHost: HTMLElement, anchor: HTMLElement, gap = 6): void {
    const rect = anchor.getBoundingClientRect();
    overlayHost.style.left = `${Math.round(rect.left)}px`;
    overlayHost.style.top = `${Math.round(rect.bottom + gap)}px`;
}
