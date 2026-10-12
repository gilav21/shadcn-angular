/**
 * Activation rules shared by every menu item (dropdown, context menu, menubar).
 *
 * The invariant: *a key activation is a click.* A consumer binds `(click)` on an
 * item once and expects it to run for the pointer, for Enter and Space, and for
 * assistive technology, exactly once and never while the item is disabled. The
 * only way to honour that for listeners the library does not own is to make the
 * keyboard produce a real `click` and to stop a disabled item's click before any
 * of them sees it.
 */

/**
 * Stops every click on `host` (or inside it) from reaching a listener while
 * `isDisabled()` is true — the consumer's `(click)` included.
 *
 * `pointer-events: none` only keeps a mouse out. An assistive-technology
 * activation and a programmatic `.click()` ignore it, so the guard has to sit on
 * the event path. It listens in the capture phase: at the target, capture
 * listeners run before bubble listeners, so it precedes a `(click)` bound on the
 * same element regardless of the order the two were registered in.
 *
 * @returns cleanup
 */
export function blockDisabledActivation(host: HTMLElement, isDisabled: () => boolean): () => void {
    const guard = (event: Event): void => {
        if (!isDisabled()) return;
        event.stopImmediatePropagation();
        event.preventDefault();
    };
    host.addEventListener('click', guard, { capture: true });
    return () => host.removeEventListener('click', guard, { capture: true });
}

/**
 * Enter or Space on a menu item: dispatches one native `click` on `target`
 * unless the item is disabled. The default action is cancelled — Space would
 * otherwise scroll the page behind the menu.
 *
 * Only a key pressed on the item itself counts. One that bubbles up from a
 * control nested inside it (a switch, a button, an input) belongs to that
 * control and is left untouched.
 */
export function activateAsClick(event: Event, target: HTMLElement, isDisabled: boolean): void {
    if (event.target !== target) return;
    event.preventDefault();
    if (!isDisabled) target.click();
}
