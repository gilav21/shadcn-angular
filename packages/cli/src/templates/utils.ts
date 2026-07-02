const UTILS_TEMPLATE = `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function for merging Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

/**
 * Coerce an arbitrary value to a display string without ever emitting the
 * \`[object Object]\` default object stringification: primitives use their own
 * \`toString\`, objects are JSON-serialized. Avoids \`String(unknown)\` so it
 * satisfies SonarQube S6551 (no base-to-string) without a type assertion.
 */
export function stringifyValue(value: unknown): string {
    switch (typeof value) {
        case 'string':
            return value;
        case 'number':
        case 'boolean':
        case 'bigint':
        case 'symbol':
            return value.toString();
        default:
            return value == null ? '' : JSON.stringify(value);
    }
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
 * Use this instead of \`window.innerWidth/innerHeight\` when calculating
 * popup collision boundaries so that containers like sidebars or
 * fixed-height scroll panes are respected.
 */
export function getClippingRect(element: HTMLElement): DOMRect {
    let parent = element.parentElement;
    while (parent && parent !== document.documentElement) {
        const style = globalThis.window?.getComputedStyle(parent);
        if (
            style &&
            (/^(hidden|auto|scroll|clip)$/.test(style.overflowX) ||
            /^(hidden|auto|scroll|clip)$/.test(style.overflowY))
        ) {
            return parent.getBoundingClientRect();
        }
        parent = parent.parentElement;
    }
    return new DOMRect(0, 0, globalThis.window?.innerWidth ?? 0, globalThis.window?.innerHeight ?? 0);
}

/**
 * Check if the user prefers reduced motion via the OS-level accessibility setting.
 */
export function prefersReducedMotion(): boolean {
    return globalThis.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
}
`;

export function getUtilsTemplate(): string {
  return UTILS_TEMPLATE;
}
