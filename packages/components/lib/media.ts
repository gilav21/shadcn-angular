/**
 * Media-query reads that degrade where `matchMedia` does not exist.
 *
 * SSR and jsdom (where consumers' own unit tests run) have no `matchMedia`;
 * every helper here answers its documented default there instead of throwing.
 */

/**
 * Check if the user prefers reduced motion via the OS-level accessibility setting.
 * Returns `false` where `matchMedia` does not exist, so callers animate as normal.
 */
export function prefersReducedMotion(): boolean {
    return globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
