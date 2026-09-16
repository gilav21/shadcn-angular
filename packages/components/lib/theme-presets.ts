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
 * Carries a themed ancestor's preset onto an overlay rendered outside it.
 *
 * Custom properties inherit through the DOM tree, so anything a themed component
 * renders inside itself is themed for free. An overlay appended to
 * `document.body` is not a descendant, and would silently fall back to the
 * global tokens. When `origin` is not inside a themed host this is a no-op, so
 * unthemed overlays keep following the global tokens live (a dark-mode toggle
 * while open included).
 */
export function inheritThemeTokens(origin: Element, overlay: HTMLElement): void {
    const themed = origin.closest<HTMLElement>(`[${THEME_ATTRIBUTE}]`);
    if (!themed) return;

    const computed = getComputedStyle(themed);
    for (const token of THEME_TOKENS) {
        overlay.style.setProperty(token, computed.getPropertyValue(token));
    }
    // The attribute travels too, so an overlay opened FROM this overlay (a
    // context submenu, a tooltip inside a popover) still finds a themed origin.
    overlay.dataset['uiTheme'] = themed.dataset['uiTheme'];
}
