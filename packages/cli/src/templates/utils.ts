export function getUtilsTemplate(): string {
  return `import { clsx, type ClassValue } from 'clsx';
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

`;
}
