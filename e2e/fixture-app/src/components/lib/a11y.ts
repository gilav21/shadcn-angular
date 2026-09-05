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
 * True when the *projected* content contains at least one interactive element —
 * i.e. it is already operable and the wrapper must not add a competing
 * `role="button"` / `tabindex` of its own.
 *
 * Pass the wrapper component's HOST element. The search starts from the host's
 * first element child — the wrapper's own `<span>` — and therefore looks only at
 * what the consumer projected inside it.
 *
 * Searching from the host itself would match the wrapper's own `<span>`, which
 * carries `role="button"` and `tabindex="0"` on the first render: every wrapper
 * would detect itself as "wrapping interactive content" and strip the very
 * semantics it had just applied, leaving a text-only trigger unfocusable
 * (WCAG 2.1.1). `querySelector` never matches the element it is called on, so
 * descending one level first is what makes the check see only projected content.
 */
export function hasInteractiveContent(host: Element | null | undefined): boolean {
    const projectionRoot = host?.firstElementChild ?? host;
    return !!projectionRoot?.querySelector(INTERACTIVE_SELECTOR);
}
