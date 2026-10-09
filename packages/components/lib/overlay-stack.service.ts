import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, untracked } from '@angular/core';

/**
 * One open overlay, as the stack sees it. The stack owns the two things that
 * must be decided across overlays rather than inside one: which layer Escape
 * belongs to, and whether the page scrolls.
 */
export interface OverlayLayer {
    /** Close the overlay and hand focus back. Called by the stack on Escape when this layer is topmost. */
    readonly dismiss: () => void;
    /** Modal layers lock body scroll for as long as they are registered. */
    readonly modal: boolean;
}

/** The inline body declarations the scroll lock overwrites, saved longhand by longhand. */
interface SavedBodyStyle {
    readonly overflowX: string;
    readonly overflowY: string;
    readonly paddingRight: string;
}

interface StackState {
    readonly layers: OverlayLayer[];
    saved: SavedBodyStyle | null;
    onKeydown: ((event: KeyboardEvent) => void) | null;
}

/**
 * The shared state is keyed on the document, not held by the service, so a
 * second copy of this file (the compiled packages bundle their own) joins the
 * same stack and the same lock. The `@1` is a protocol version: bump it if the
 * stored shape changes.
 */
const STATE_KEY = Symbol.for('@gilav21/shadcn-angular/overlay-stack@1');

type DocumentWithState = Document & { [STATE_KEY]?: StackState };

function stateOf(doc: Document): StackState {
    const holder = doc as DocumentWithState;
    holder[STATE_KEY] ??= { layers: [], saved: null, onKeydown: null };
    return holder[STATE_KEY];
}

/** Width of the vertical scrollbar the page currently shows; 0 for overlay scrollbars and with no window. */
function scrollbarWidth(doc: Document): number {
    const win = doc.defaultView;
    if (!win) return 0;
    return Math.max(0, win.innerWidth - doc.documentElement.clientWidth);
}

function lockBody(doc: Document, state: StackState): void {
    const body = doc.body;
    const style = body.style;
    state.saved = {
        overflowX: style.getPropertyValue('overflow-x'),
        overflowY: style.getPropertyValue('overflow-y'),
        paddingRight: style.getPropertyValue('padding-right'),
    };
    // Measured before `overflow: hidden`: hiding the scrollbar changes the width.
    const scrollbar = scrollbarWidth(doc);
    const win = doc.defaultView;
    const padding = scrollbar > 0 && win ? Number.parseFloat(win.getComputedStyle(body).paddingRight) || 0 : 0;
    style.setProperty('overflow', 'hidden');
    if (scrollbar > 0) style.setProperty('padding-right', `${padding + scrollbar}px`);
}

function unlockBody(doc: Document, state: StackState): void {
    const saved = state.saved;
    if (!saved) return;
    const style = doc.body.style;
    // Longhand: the shorthand reads '' when only one axis is set, and writing it back would erase a consumer's `overflow-y`.
    // The lock's own shorthand goes first: jsdom keeps it apart from the longhands, so restoring them alone would leave it behind.
    style.removeProperty('overflow');
    style.setProperty('overflow-x', saved.overflowX);
    style.setProperty('overflow-y', saved.overflowY);
    style.setProperty('padding-right', saved.paddingRight);
    state.saved = null;
}

/** Locked iff some registered layer is modal. */
function syncLock(doc: Document, state: StackState): void {
    if (!doc.body) return;
    const shouldLock = state.layers.some(layer => layer.modal);
    if (shouldLock && !state.saved) lockBody(doc, state);
    else if (!shouldLock) unlockBody(doc, state);
}

/**
 * Escape belongs to the topmost layer only. An Escape something already
 * consumed (`defaultPrevented`: a submenu closing itself) or that arrives
 * mid-composition (an IME cancelling a candidate) dismisses nothing.
 */
function dispatchEscape(doc: Document, state: StackState, event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    const top = state.layers.at(-1);
    if (!top) return;
    event.preventDefault();
    // Removed before dismiss() runs, so a dismiss that opens another overlay stacks on a clean state.
    removeLayer(doc, state, top);
    top.dismiss();
}

function removeLayer(doc: Document, state: StackState, layer: OverlayLayer): void {
    const index = state.layers.indexOf(layer);
    if (index !== -1) state.layers.splice(index, 1);
    if (state.layers.length === 0 && state.onKeydown) {
        doc.removeEventListener('keydown', state.onKeydown);
        state.onKeydown = null;
    }
    syncLock(doc, state);
}

/**
 * The stack of open overlays -- dialogs, sheets, drawers, popovers, menus --
 * in the order they opened.
 *
 * Every overlay used to handle Escape and lock scroll on its own, and one
 * keypress closed whatever heard it (a popover AND the dialog it sat in), while
 * the first overlay to close unlocked the page under the others. Both are now
 * decisions made here, from one list: Escape goes to the topmost layer, and the
 * page is locked while any modal layer is registered.
 */
@Injectable({ providedIn: 'root' })
export class OverlayStackService {
    private readonly doc = inject(DOCUMENT);

    /**
     * Put `layer` on top, moving it there if it is already registered.
     * @returns its unregister function, safe to call more than once.
     */
    register(layer: OverlayLayer): () => void {
        const doc = this.doc;
        const state = stateOf(doc);
        const index = state.layers.indexOf(layer);
        if (index !== -1) state.layers.splice(index, 1);
        state.layers.push(layer);
        if (!state.onKeydown) {
            state.onKeydown = (event: KeyboardEvent) => dispatchEscape(doc, state, event);
            doc.addEventListener('keydown', state.onKeydown);
        }
        syncLock(doc, state);
        return () => removeLayer(doc, state, layer);
    }

    /** Whether `layer` is the topmost registered layer. */
    isTopmost(layer: OverlayLayer): boolean {
        return stateOf(this.doc).layers.at(-1) === layer;
    }
}

/**
 * Register `layer` for as long as `isOpen()` is true, and unregister on destroy.
 * Must be called in an injection context (a constructor or field initialiser).
 */
export function bindOverlayLayer(isOpen: () => boolean, layer: OverlayLayer): void {
    const stack = inject(OverlayStackService);
    let unregister: (() => void) | null = null;
    const release = (): void => {
        unregister?.();
        unregister = null;
    };
    effect(() => {
        if (isOpen()) {
            untracked(() => {
                unregister = stack.register(layer);
            });
        } else {
            untracked(release);
        }
    });
    inject(DestroyRef).onDestroy(release);
}
