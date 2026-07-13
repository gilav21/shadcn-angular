/**
 * Accessibility helpers shared by the trigger/close wrapper components.
 *
 * The wrappers (`ui-popover-trigger`, `ui-dialog-trigger`, `ui-sheet-close`, …)
 * project arbitrary content and must stay keyboard-operable. Historically they
 * always rendered `role="button" tabindex="0"` on their own `<span>`, which is
 * correct when the consumer projects inert content (plain text, an icon) but
 * produces a nested interactive control — a real WCAG 4.1.2 failure, flagged by
 * axe's `nested-interactive` — as soon as the consumer projects a `<ui-button>`
 * or any other focusable element, which is by far the common case.
 *
 * `hasInteractiveContent()` lets a wrapper decide at runtime which of the two it
 * is: if the projected content already carries the button semantics and focus,
 * the wrapper stays a transparent, non-focusable event delegate; if it does not,
 * the wrapper supplies them itself. Same public API, correct semantics in both
 * modes.
 */

/**
 * Elements that are focusable / expose a widget role, and therefore already
 * provide the interaction semantics a trigger wrapper would otherwise add.
 */
const INTERACTIVE_SELECTOR = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    'summary',
    '[tabindex]',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="combobox"]',
    '[role="menuitem"]',
    '[role="switch"]',
    '[role="tab"]',
].join(',');

/**
 * True when `host` contains at least one interactive descendant — i.e. the
 * projected content is itself operable and the wrapper must not add a competing
 * `role="button"` / `tabindex` of its own.
 */
export function hasInteractiveContent(host: Element | null | undefined): boolean {
    return !!host?.querySelector(INTERACTIVE_SELECTOR);
}
