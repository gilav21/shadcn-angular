// Money in a locale — `specs/form-controls-small-spec.md` §3.6, T-locale-parse.
//
// The table below is the spike that ran before the component existed. Its
// point is the `ar-EG` row: a parser built on `[0-9]` returns null for the
// exact string it formatted a moment earlier, and this library ships `ar`
// locales throughout.
import { describe, it, expect } from 'vitest';
import {
    currencyParts,
    currencyScale,
    formatCurrency,
    formatEditable,
    parseCurrency,
    roundToCurrency,
    toMinorUnits,
} from './currency-input.format';

/** Locale, currency, and the trap each one carries. */
const LOCALES: readonly (readonly [string, string, string])[] = [
    ['en-US', 'USD', 'the easy one'],
    ['de-DE', 'EUR', 'dot groups, comma decimal'],
    ['fr-FR', 'EUR', 'the group separator is U+202F, not a space'],
    ['ja-JP', 'JPY', 'no decimal places at all'],
    ['ar-EG', 'EGP', 'Arabic-Indic digits'],
    ['en-IN', 'INR', 'groups by lakh, not by thousand'],
];

describe('a currency knows its own precision', () => {
    it.each([
        ['USD', 2],
        ['EUR', 2],
        ['JPY', 0],
        ['KWD', 3],
    ])('%s has %i decimal places', (currency, expected) => {
        expect(currencyScale('en-US', currency)).toBe(expected);
    });

    /** Showing a yen amount with cents is simply wrong, not merely ugly. */
    it('never shows a fractional yen', () => {
        expect(formatCurrency(12345.6, 'ja-JP', 'JPY')).not.toContain('.');
    });

    it('shows three places for a three-decimal currency', () => {
        expect(formatCurrency(1.234, 'en-US', 'KWD')).toContain('1.234');
    });
});

describe('parsing reads back what formatting wrote', () => {
    /**
     * The round trip is the only assertion that matters here: a field whose
     * parser rejects its own formatter is broken in the most confusing
     * possible way — it works until you blur it.
     */
    it.each(LOCALES)('%s / %s — %s', (locale, currency, _why) => {
        const scale = currencyScale(locale, currency);
        const amount = Number((12345.6).toFixed(scale));

        const formatted = formatCurrency(amount, locale, currency);
        expect(parseCurrency(formatted, locale, currency)).toBeCloseTo(amount, 9);
    });

    it.each(LOCALES)('%s / %s round-trips a negative amount', (locale, currency) => {
        const formatted = formatCurrency(-42, locale, currency);
        expect(parseCurrency(formatted, locale, currency)).toBe(-42);
    });

    it.each(LOCALES)('%s / %s round-trips zero', (locale, currency) => {
        expect(parseCurrency(formatCurrency(0, locale, currency), locale, currency)).toBe(0);
    });
});

describe('the Arabic case, called out because it is the one that bites', () => {
    const parts = currencyParts('ar-EG', 'EGP');

    it('discovers that the digits are not ASCII', () => {
        expect(parts.digits[1]).not.toBe('1');
        expect(parts.digits[1]).toBe('١');
    });

    it('reads Arabic-Indic digits', () => {
        expect(parseCurrency('١٢٣', 'ar-EG', 'EGP')).toBe(123);
    });

    /**
     * Someone with a physical keyboard types ASCII even in an Arabic locale.
     * Being strict here would reject the most common input.
     */
    it('also reads ASCII digits typed into an Arabic locale', () => {
        expect(parseCurrency('123', 'ar-EG', 'EGP')).toBe(123);
    });

    it('survives the bidi marks Intl adds', () => {
        const formatted = formatCurrency(99, 'ar-EG', 'EGP');
        expect(formatted).toMatch(/[‎‏]/);
        expect(parseCurrency(formatted, 'ar-EG', 'EGP')).toBe(99);
    });
});

describe('the separators nobody types by hand', () => {
    it('treats the French group separator as a separator, not as a space', () => {
        const { group } = currencyParts('fr-FR', 'EUR');
        expect(group).not.toBe(' ');
        expect(parseCurrency(`12${group}345,60`, 'fr-FR', 'EUR')).toBeCloseTo(12345.6, 9);
    });

    it('reads a German amount, where dot and comma swap roles', () => {
        expect(parseCurrency('1.234,56', 'de-DE', 'EUR')).toBeCloseTo(1234.56, 9);
    });

    it('reads the same amount written the American way', () => {
        expect(parseCurrency('1,234.56', 'en-US', 'USD')).toBeCloseTo(1234.56, 9);
    });
});

describe('input that is not a number', () => {
    it.each([
        ['', 'empty'],
        ['   ', 'whitespace'],
        ['abc', 'letters'],
        ['$', 'a symbol alone'],
        ['1.2.3', 'two decimal points'],
    ])('reads %j (%s) as nothing', raw => {
        expect(parseCurrency(raw, 'en-US', 'USD')).toBeNull();
    });

    it('ignores a stray currency symbol around a real number', () => {
        expect(parseCurrency('$1,234.56', 'en-US', 'USD')).toBeCloseTo(1234.56, 9);
    });

    it('reads accounting-style parentheses as negative', () => {
        expect(parseCurrency('(42.00)', 'en-US', 'USD')).toBe(-42);
    });

    it('reads a real minus sign as well as a hyphen', () => {
        expect(parseCurrency('−42', 'en-US', 'USD')).toBe(-42);
    });
});

describe('rounding to the currency', () => {
    /**
     * Asserted in MINOR units, not as a float.
     *
     * `12.35` is not exactly representable, so comparing floats for equality
     * is both fragile and beside the point — what matters is that the amount
     * is 1235 cents. Integers say that exactly.
     */
    const cents = (value: number, locale = 'en-US', currency = 'USD'): number =>
        toMinorUnits(roundToCurrency(value, locale, currency), locale, currency);

    it('rounds to two places for dollars', () => {
        expect(cents(12.345)).toBe(1235);
    });

    it('rounds to whole yen', () => {
        expect(roundToCurrency(12345.6, 'ja-JP', 'JPY')).toBe(12346);
    });

    it('leaves an amount that already fits the scale alone', () => {
        expect(cents(0.01)).toBe(1);
    });

    it('keeps three places for a three-decimal currency', () => {
        expect(cents(1.2345, 'en-US', 'KWD')).toBe(1235);
    });

    /**
     * `1.005` is stored as 1.00499999999999989, so a plain `Math.round`
     * rounds it DOWN — which reads as a bug in the till rather than as
     * floating point.
     */
    it('rounds a half up even when the float sits just below it', () => {
        expect(cents(1.005)).toBe(101);
        expect(cents(8.475)).toBe(848);
    });

    it('leaves an already-exact amount alone', () => {
        expect(cents(12.34)).toBe(1234);
    });
});

describe('minor units', () => {
    it('gives whole cents', () => {
        expect(toMinorUnits(12.34, 'en-US', 'USD')).toBe(1234);
    });

    it('gives whole yen, because yen has no minor unit', () => {
        expect(toMinorUnits(12346, 'ja-JP', 'JPY')).toBe(12346);
    });

    it('is an integer even when the float is not', () => {
        expect(Number.isInteger(toMinorUnits(19.99, 'en-US', 'USD'))).toBe(true);
    });
});

describe('the editable form', () => {
    /** A symbol and grouping both fight a caret, so neither is shown. */
    it('drops the symbol and the grouping while editing', () => {
        const editable = formatEditable(1234.5, 'en-US', 'USD');
        expect(editable).not.toContain('$');
        expect(editable).not.toContain(',');
    });

    it('keeps the locale decimal separator, which is the key about to be pressed', () => {
        expect(formatEditable(1234.5, 'de-DE', 'EUR')).toContain(',');
    });

    it('round-trips through the parser', () => {
        const editable = formatEditable(1234.56, 'de-DE', 'EUR');
        expect(parseCurrency(editable, 'de-DE', 'EUR')).toBeCloseTo(1234.56, 9);
    });
});

describe('robustness', () => {
    /**
     * An unknown code throws from the `Intl` constructor. Taking the whole
     * field down over a typo in one input is a poor trade for strictness.
     */
    it('falls back to a plain decimal for an unknown currency code', () => {
        expect(() => formatCurrency(12.34, 'en-US', 'XX')).not.toThrow();
        expect(parseCurrency('12.34', 'en-US', 'XX')).toBeCloseTo(12.34, 9);
    });
});
