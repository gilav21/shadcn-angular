import { describe, it, expect } from 'vitest';
import { detectTheme } from './status.js';
import { themeColors } from '../templates/styles.js';

describe('detectTheme', () => {
    it('returns "unknown" when --primary is not set', () => {
        expect(detectTheme(null, null, undefined)).toBe('unknown');
    });

    it('returns "custom" for an unrecognized --primary value', () => {
        expect(detectTheme('oklch(0.5 0.2 200)', null, undefined)).toBe('custom');
    });

    it.each(['red', 'rose', 'blue', 'yellow', 'amber', 'slate', 'stone', 'gray'] as const)(
        'detects the %s preset from its --primary value',
        (theme) => {
            const primary = themeColors[theme].light['--primary'];
            expect(detectTheme(primary, null, undefined)).toBe(theme);
        },
    );

    describe('zinc/neutral ambiguity (identical --primary)', () => {
        const primary = themeColors.zinc.light['--primary'];

        it('prefers the configured theme when it is a candidate', () => {
            expect(detectTheme(primary, null, 'zinc')).toBe('zinc');
            expect(detectTheme(primary, null, 'neutral')).toBe('neutral');
        });

        it('ignores a configured theme that is not a candidate', () => {
            expect(detectTheme(primary, 'oklch(0.141 0.005 285.823)', 'rose')).toBe('zinc');
        });

        it('falls back to the base palette --foreground', () => {
            expect(detectTheme(primary, 'oklch(0.141 0.005 285.823)', undefined)).toBe('zinc');
            expect(detectTheme(primary, 'oklch(0.145 0 0)', undefined)).toBe('neutral');
        });

        it('falls back to the first candidate when nothing disambiguates', () => {
            expect(detectTheme(primary, null, undefined)).toBe('neutral');
        });
    });
});
