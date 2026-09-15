import { Injectable } from '@angular/core';

/**
 * The stack of open overlays -- dialogs, sheets, drawers, popovers -- in the
 * order they opened, so Escape can be given to exactly one of them: the
 * innermost.
 *
 * Every overlay used to handle Escape on its own (a panel keydown here, a
 * document listener there), and one keypress closed whatever heard it: a
 * popover AND the dialog it sat in, or every open popover at once. Each
 * overlay now registers while open and asks whether anything opened after it;
 * only an overlay with nothing above it acts on the key. An overlay that never
 * registered is treated as the outermost layer, so a component used outside
 * the stack keeps its old behaviour.
 */
@Injectable({ providedIn: 'root' })
export class OverlayStackService {
    private readonly stack: object[] = [];

    /** Put `overlay` on top, moving it there if it is already registered. */
    push(overlay: object): void {
        this.remove(overlay);
        this.stack.push(overlay);
    }

    remove(overlay: object): void {
        const index = this.stack.indexOf(overlay);
        if (index !== -1) this.stack.splice(index, 1);
    }

    /**
     * Whether another open overlay sits above `overlay`. False when nothing is
     * open above it -- including when `overlay` never registered and the stack
     * is empty, which is the standalone case.
     */
    hasOverlayAbove(overlay: object | null | undefined): boolean {
        if (this.stack.length === 0) return false;
        const index = overlay ? this.stack.indexOf(overlay) : -1;
        return index === -1 ? true : index < this.stack.length - 1;
    }
}
