import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function for merging Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

/**
 * Check if the current direction is RTL by reading the computed style of the element.
 * This allows components to detect RTL without needing an explicit input.
 */
export function isRtl(el: HTMLElement): boolean {
    return getComputedStyle(el).direction === 'rtl';
}

/**
 * Returns the bounding rect of the nearest ancestor that clips overflow
 * (overflow: hidden | auto | scroll | clip on either axis).
 * Falls back to the full viewport rect when no such ancestor exists.
 *
 * Use this instead of `window.innerWidth/innerHeight` when calculating
 * popup collision boundaries so that containers like sidebars or
 * fixed-height scroll panes are respected.
 */
export function getClippingRect(element: HTMLElement): DOMRect {
    let parent = element.parentElement;
    while (parent && parent !== document.documentElement) {
        const style = window.getComputedStyle(parent);
        if (
            /^(hidden|auto|scroll|clip)$/.test(style.overflowX) ||
            /^(hidden|auto|scroll|clip)$/.test(style.overflowY)
        ) {
            return parent.getBoundingClientRect();
        }
        parent = parent.parentElement;
    }
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

/**
 * Check if the user prefers reduced motion via the OS-level accessibility setting.
 */
export function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
