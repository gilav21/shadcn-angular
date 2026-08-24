/**
 * Reading and writing money in a locale, without hard-coding a single
 * character of it.
 *
 * ### Why none of this is a regular expression over `[0-9.,]`
 *
 * A locale's number is not ASCII, and the trap is deeper than swapped
 * separators. Measured before this file existed
 * (`specs/form-controls-small-spec.md` §3.6):
 *
 * | Locale | `format(12345.6)` |
 * |---|---|
 * | `en-US` | `$12,345.60` |
 * | `de-DE` | `12.345,60 €` — dot groups, comma decimal |
 * | `fr-FR` | `12 345,60 €` — that space is `U+202F`, not a space |
 * | `ja-JP` | `￥12,346` — no decimals at all, by the currency's own scale |
 * | `ar-EG` | `‏١٢٬٣٤٥٫٦٠ ج.م.‏` — **Arabic-Indic digits** |
 *
 * The `ar-EG` row is why this is a module and not three lines inside the
 * component. `١٢٣` is not `123`, so a parser built on `[0-9]` does not merely
 * mis-read Arabic input — it returns `null` for the exact string it formatted
 * a moment earlier. This library ships `ar` locales throughout, so that is a
 * shipping bug rather than a hypothetical.
 *
 * Everything here therefore asks `Intl` and assumes nothing.
 */

/** The pieces of a locale's number formatting, discovered rather than assumed. */
export interface CurrencyParts {
  /** Thousands separator. Empty when the locale does not group. */
  readonly group: string;
  /** Decimal separator. */
  readonly decimal: string;
  /** This locale's glyphs for 0–9, in order. */
  readonly digits: readonly string[];
  /**
   * The currency symbol as this locale writes it.
   *
   * Kept so a parser can remove it by name. Guessing at it is not an option:
   * the Egyptian pound is `ج.م.`, which **contains full stops**, and a parser
   * that strips everything except digits and dots is left holding
   * `12345.60..` — three decimal points, and a rejected amount.
   */
  readonly symbol: string;
  /** Decimal places this currency has: 2 for USD, 0 for JPY, 3 for KWD. */
  readonly scale: number;
}

/**
 * How many decimal places a currency has.
 *
 * From the currency, not from a guess of 2 — `JPY` has none and `KWD` has
 * three, and showing a yen amount with cents is simply wrong.
 */
export function currencyScale(locale: string, currency: string): number {
  return formatterFor(locale, currency).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Everything needed to read this locale's numbers back. */
export function currencyParts(locale: string, currency: string): CurrencyParts {
  // A number with both a group and a decimal, so both parts are present.
  const parts = formatterFor(locale, currency).formatToParts(12345.6);
  const plain = new Intl.NumberFormat(locale, { useGrouping: false });

  return {
    group: parts.find(part => part.type === 'group')?.value ?? '',
    decimal: parts.find(part => part.type === 'decimal')?.value ?? '.',
    // Formatting each digit alone is the only reliable way to learn a
    // locale's numerals; there is no `Intl` API that lists them.
    digits: Array.from({ length: 10 }, (_, digit) => plain.format(digit)),
    symbol: parts.find(part => part.type === 'currency')?.value ?? '',
    scale: currencyScale(locale, currency),
  };
}

/** The amount as the locale writes it, symbol and all. For display at rest. */
export function formatCurrency(
  value: number,
  locale: string,
  currency: string,
): string {
  return formatterFor(locale, currency).format(value);
}

/**
 * The amount as it should look while being edited.
 *
 * No symbol and no grouping — both fight a caret. The decimal separator is
 * still the locale's, because that is the key the person is about to press.
 */
export function formatEditable(
  value: number,
  locale: string,
  currency: string,
): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: currencyScale(locale, currency),
  }).format(value);
}

/**
 * Read an amount a person typed, or `null` if there is no number in it.
 *
 * Deliberately forgiving: someone pasting a formatted amount, typing the
 * symbol, or using ASCII digits in an Arabic locale all get the number they
 * meant. Being strict here would reject the field's own output.
 */
export function parseCurrency(
  raw: string,
  locale: string,
  currency: string,
): number | null {
  const { group, decimal, digits, symbol } = currencyParts(locale, currency);

  let text = raw.trim();
  if (text === '') return null;

  /*
   * The symbol comes off first, by name.
   *
   * `ج.م.` — the Egyptian pound — contains full stops, so a strip that keeps
   * "digits and dots" keeps two of them and the amount then reads as having
   * three decimal points. Removing the symbol Intl actually used is the only
   * way to tell a decimal point from a full stop inside a currency name.
   */
  if (symbol !== '') text = text.split(symbol).join('');
  // Bidi marks travel with right-to-left currency formatting.
  text = text.replace(/[‎‏؜]/g, '');

  // Locale numerals first, so the separator and sign work below apply to
  // ASCII regardless of what was typed.
  digits.forEach((glyph, digit) => {
    if (glyph !== String(digit)) text = text.split(glyph).join(String(digit));
  });

  if (group !== '') text = text.split(group).join('');
  if (decimal !== '.') text = text.split(decimal).join('.');

  const negative = /[-−]/.test(text) || /^\(.*\)$/.test(text.trim());
  // Everything else — currency symbols, bidi marks, stray letters — goes.
  text = text.replace(/[^\d.]/g, '');

  // A second dot means the input is not a number, not that it is a big one.
  if (text.split('.').length > 2) return null;

  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/**
 * Round to the currency's own precision.
 *
 * Applied when an edit finishes, never per keystroke: rounding `12.345` to
 * `12.35` while someone is still typing takes the field away from them.
 * Bounding the value to the scale is also what keeps float drift invisible —
 * an amount can never carry more precision than the currency has.
 */
export function roundToCurrency(
  value: number,
  locale: string,
  currency: string,
): number {
  const factor = 10 ** currencyScale(locale, currency);
  // `Number.EPSILON` nudges the halfway cases that binary floats land just
  // below — without it `1.005` rounds down, which reads as a bug in the till.
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** The amount in minor units — cents, sen, fils — as a whole number. */
export function toMinorUnits(
  value: number,
  locale: string,
  currency: string,
): number {
  return Math.round(value * 10 ** currencyScale(locale, currency));
}

/**
 * Formatters are cached because building one is expensive and a field builds
 * the same one on every keystroke.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  const existing = formatters.get(key);
  if (existing) return existing;

  /*
   * An unknown currency code throws from the `Intl` constructor, which would
   * take the whole field down over a typo in one input. A plain decimal is a
   * legible fallback, and the field still works.
   */
  let created: Intl.NumberFormat;
  try {
    created = new Intl.NumberFormat(locale, { style: 'currency', currency });
  } catch {
    created = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  formatters.set(key, created);
  return created;
}
