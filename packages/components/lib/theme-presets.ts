/**
 * Per-instance colour presets — the same names `npx shadcn-angular change-theme`
 * accepts. A component that exposes a `theme` input reflects it as the
 * `data-ui-theme` attribute, and its own stylesheet maps each name to the
 * preset's tokens, so nothing global is involved.
 */
export const THEME_NAMES = [
    'zinc', 'slate', 'stone', 'gray', 'neutral',
    'red', 'rose', 'orange', 'green', 'blue', 'yellow', 'violet', 'amber',
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

/** The attribute a themed host carries; overlays look it up to inherit the preset. */
export const THEME_ATTRIBUTE = 'data-ui-theme';

/** The tokens a preset overrides — everything else stays the app's global tokens. */
export const THEME_TOKENS = ['--primary', '--primary-foreground', '--ring'] as const;

/**
 * Carries a themed component's preset onto an overlay rendered outside it.
 * Call it when the overlay is shown — including every re-show of a reused one.
 *
 * Custom properties inherit through the DOM tree, so anything a themed component
 * renders inside itself is themed for free, live. Two kinds of overlay are NOT
 * descendants and would silently fall back to the global tokens: one appended
 * to `document.body`, and one an addon directive creates through its
 * `ViewContainerRef`, which Angular inserts as a SIBLING of the host. Those get
 * the resolved tokens copied at show time (so a dark-mode toggle while one is
 * open is not reflected until it re-opens).
 *
 * A real descendant is left alone so it keeps inheriting live, and an overlay
 * whose origin is not themed (any more) has earlier copies cleared, so it
 * follows the global tokens.
 */
export function inheritThemeTokens(origin: Element, overlay: HTMLElement): void {
    const themed = origin.closest<HTMLElement>(`[${THEME_ATTRIBUTE}]`);
    if (themed?.contains(overlay)) return;
    if (!themed) {
        for (const token of THEME_TOKENS) overlay.style.removeProperty(token);
        delete overlay.dataset['uiTheme'];
        return;
    }

    const computed = getComputedStyle(themed);
    for (const token of THEME_TOKENS) {
        overlay.style.setProperty(token, computed.getPropertyValue(token));
    }
    // The attribute travels too, so an overlay opened FROM this overlay (a
    // context submenu, a tooltip inside a popover) still finds a themed origin.
    overlay.dataset['uiTheme'] = themed.dataset['uiTheme'];
}
