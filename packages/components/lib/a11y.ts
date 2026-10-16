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

/**
 * Elements Tab can land on, before filtering. `[tabindex]` is here for the
 * explicit stops; the negative ones are dropped by {@link tabbableElements}.
 */
const TABBABLE_CANDIDATES = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
    '[tabindex]',
    '[contenteditable]:not([contenteditable="false"])',
    'audio[controls]',
    'video[controls]',
].join(',');

function isTabStop(el: HTMLElement): boolean {
    if (el.matches(':disabled') || el.closest('[inert]')) return false;
    const explicit = el.getAttribute('tabindex');
    if (explicit !== null && Number.parseInt(explicit, 10) < 0) return false;
    // jsdom has no layout and no `checkVisibility`: with nothing able to measure, everything counts as visible.
    return typeof el.checkVisibility !== 'function' || el.checkVisibility({ visibilityProperty: true });
}

/** A radio group is one tab stop: its checked button, or the first when none is checked. */
function radioGroupKey(el: HTMLInputElement): string {
    return `${el.form ? 'form' : ''}:${el.name}`;
}

function keepRadioStops(stops: HTMLElement[]): HTMLElement[] {
    const checked = new Set<string>();
    for (const el of stops) {
        if (el instanceof HTMLInputElement && el.type === 'radio' && el.name && el.checked) checked.add(radioGroupKey(el));
    }
    const seen = new Set<string>();
    return stops.filter(el => {
        if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || !el.name) return true;
        const key = radioGroupKey(el);
        if (seen.has(key)) return false;
        if (checked.has(key) && !el.checked) return false;
        seen.add(key);
        return true;
    });
}

/**
 * The elements inside `container` that Tab reaches, in DOM order: enabled,
 * visible, not inert, not `tabindex="-1"`, and one stop per radio group.
 * The panel-level focus trap wraps at the edges of this list, so a disabled or
 * hidden control at an edge cannot let focus slip out.
 */
export function tabbableElements(container: HTMLElement): HTMLElement[] {
    const stops = Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_CANDIDATES)).filter(isTabStop);
    return keepRadioStops(stops);
}

/**
 * Keeps Tab and Shift+Tab inside `container`: wraps at the first and last
 * tabbable element, and pulls focus back in when it is outside. A container with
 * nothing tabbable keeps focus on itself.
 */
export function trapTabKey(event: KeyboardEvent, container: HTMLElement): void {
    if (event.key !== 'Tab') return;
    const stops = tabbableElements(container);
    if (stops.length === 0) {
        event.preventDefault();
        container.focus();
        return;
    }
    const first = stops[0];
    const last = stops.at(-1) ?? first;
    const active = container.ownerDocument.activeElement;
    const outside = !active || !container.contains(active);
    // Outside the panel, or past its last stop: back to the first.
    if (outside || (!event.shiftKey && active === last)) {
        event.preventDefault();
        first.focus();
    } else if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault();
        last.focus();
    }
}

/** Moves focus to the first tabbable element in `container`, or to `container` itself when there is none. */
export function focusFirstTabbable(container: HTMLElement): void {
    (tabbableElements(container)[0] ?? container).focus();
}
