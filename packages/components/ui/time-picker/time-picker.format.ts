/**
 * Times of day: what the value is, and what the locale decides about it.
 *
 * ### The value is `"HH:mm"`, always 24-hour
 *
 * Not a `Date`. A `Date` is an *instant*; a time of day is not — it has no
 * date and no time zone. Storing `14:30` as a `Date` forces a date part,
 * invariably `1970-01-01`, which shifts across midnight the moment anything
 * converts zones: `14:30` becomes `13:30`, or the day before. The bug is
 * invisible until a user in another zone opens the form.
 *
 * `"HH:mm"` is what `<input type="time">` uses, what a SQL `TIME` column
 * takes, and what JSON round-trips unchanged. **12-hour is a rendering
 * choice**, made from the locale; the stored value never is.
 *
 * ### What was measured, rather than assumed
 *
 * `specs/form-controls-small-spec.md` §3.7 records a sweep of 82 locales:
 *
 * - **h:m:s never reorders.** Not in any locale, RTL included. The mitigation
 *   the spec predicted for R-2 was aimed at the wrong axis.
 * - **The meridiem does.** `ko`, `ko-KR` and `zh-TW` put it *first*
 *   (`下午9:05`), the other 21 twelve-hour locales put it last. That, not the
 *   digits, is what a hard-coded layout gets wrong.
 * - **Only two hour cycles occur**: `h23` and `h12`, so a boolean is enough.
 * - **The digits may not be ASCII** — `ar-EG` formats `٩:٠٥`, and an Arabic
 *   keyboard types it back. R-1 again, so parsing maps through the locale's
 *   own glyphs rather than a `[0-9]` class.
 *
 * See `specs/form-controls-small-spec.md` §3.2 and §3.7.
 */
import { localeDigits, toAsciiDigits } from '../../lib/i18n';

/** A time of day, in whole 24-hour units. */
export interface TimeParts {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

/** The pieces a segmented time field is built from. */
export type TimeSegmentKind = 'hour' | 'minute' | 'second' | 'dayPeriod';

/** Which half of the day a 12-hour reading falls in. */
export type DayPeriod = 'am' | 'pm';

/** How one locale lays a time out, discovered rather than assumed. */
export interface TimeLayout {
  /** Segment order, taken from the locale's own `formatToParts`. */
  readonly order: readonly TimeSegmentKind[];
  /** `separators[i]` sits between `order[i]` and `order[i + 1]`. */
  readonly separators: readonly string[];
  /** Whether this locale reads the clock in halves. */
  readonly hour12: boolean;
  /** What this locale calls the halves: `AM`/`PM`, `ص`/`م`, `上午`/`下午`. */
  readonly dayPeriods: Readonly<Record<DayPeriod, string>>;
  /** This locale's glyphs for 0–9, in order. */
  readonly digits: readonly string[];
}

export const HOURS_PER_HALF_DAY = 12;
export const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;

/** A reference instant. Only its clock reading is ever used. */
function at(hours: number): Date {
  return new Date(Date.UTC(2020, 0, 1, hours, 5, 9));
}

/**
 * Ask the locale how it writes a time.
 *
 * Everything here is a question put to `Intl`: the order, the separators, the
 * names of the two halves, and whether there are halves at all. Nothing is a
 * list this library would have to keep up to date.
 */
export function timeLayout(locale: string, withSeconds: boolean): TimeLayout {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  };
  if (withSeconds) options.second = '2-digit';

  const formatter = new Intl.DateTimeFormat(locale, options);
  const hour12 = formatter.resolvedOptions().hour12 === true;

  const order: TimeSegmentKind[] = [];
  const separators: string[] = [];
  let pending = '';

  for (const part of formatter.formatToParts(at(21))) {
    if (part.type === 'literal') {
      pending += part.value;
      continue;
    }
    if (!isSegmentKind(part.type)) continue;
    if (order.length > 0) separators.push(cleanSeparator(pending));
    pending = '';
    order.push(part.type);
  }

  return {
    order,
    separators,
    hour12,
    dayPeriods: { am: dayPeriodOf(formatter, 9), pm: dayPeriodOf(formatter, 21) },
    digits: localeDigits(locale),
  };
}

function isSegmentKind(type: string): type is TimeSegmentKind {
  return type === 'hour' || type === 'minute' || type === 'second' || type === 'dayPeriod';
}

/** Directional isolates and marks, which a separator has no use for. */
const BIDI_CONTROLS = /[‎‏⁦-⁩]/g;

/**
 * Bidi control characters come off the separators.
 *
 * `ar` wraps its time in isolates so the digits read left-to-right inside a
 * right-to-left paragraph. The segments are already isolated — they are
 * separate elements in an explicitly LTR group — so carrying the marks through
 * would only put invisible characters inside a `<span>`.
 */
function cleanSeparator(value: string): string {
  return value.replace(BIDI_CONTROLS, '');
}

function dayPeriodOf(formatter: Intl.DateTimeFormat, hours: number): string {
  return formatter.formatToParts(at(hours)).find(part => part.type === 'dayPeriod')?.value ?? '';
}

/**
 * Read a stored `"HH:mm"` or `"HH:mm:ss"`.
 *
 * Deliberately strict and deliberately ASCII: this parses the *value*, which
 * is a wire format, not something a person typed. Anything that is not a real
 * reading of a clock is `null` rather than a guess — `25:00` is not a time.
 */
export function parseTimeValue(value: string | null | undefined): TimeParts | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;

  const parts: TimeParts = {
    hours: Number.parseInt(match[1], 10),
    minutes: Number.parseInt(match[2], 10),
    seconds: match[3] === undefined ? 0 : Number.parseInt(match[3], 10),
  };

  const valid =
    parts.hours < HOURS_PER_DAY &&
    parts.minutes < MINUTES_PER_HOUR &&
    parts.seconds < SECONDS_PER_MINUTE;
  return valid ? parts : null;
}

/** Write a `"HH:mm"` value: zero-padded, 24-hour, whatever the locale shows. */
export function formatTimeValue(parts: TimeParts, withSeconds: boolean): string {
  const body = `${pad(parts.hours)}:${pad(parts.minutes)}`;
  return withSeconds ? `${body}:${pad(parts.seconds)}` : body;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * The hour as this locale shows it.
 *
 * Midnight and noon are the cases worth naming: on a 12-hour clock both read
 * `12`, never `0`. Measured across every 12-hour locale in the sweep — none
 * uses an `h11` cycle, so there is no locale where midnight reads `0 AM`.
 */
export function displayHour(hours24: number, hour12: boolean): number {
  if (!hour12) return hours24;
  const remainder = hours24 % HOURS_PER_HALF_DAY;
  return remainder === 0 ? HOURS_PER_HALF_DAY : remainder;
}

/** Which half of the day a 24-hour reading falls in. */
export function dayPeriodFor(hours24: number): DayPeriod {
  return hours24 < HOURS_PER_HALF_DAY ? 'am' : 'pm';
}

/** Turn what the user sees back into the 24-hour value that gets stored. */
export function hoursFromDisplay(shown: number, period: DayPeriod, hour12: boolean): number {
  if (!hour12) return shown % HOURS_PER_DAY;
  const base = shown % HOURS_PER_HALF_DAY;
  return period === 'pm' ? base + HOURS_PER_HALF_DAY : base;
}

/** Inclusive bounds for a numeric segment; drives arrow keys and `aria-valuemax`. */
export function segmentBounds(
  kind: TimeSegmentKind,
  hour12: boolean,
): { readonly min: number; readonly max: number } {
  if (kind === 'hour') {
    return hour12 ? { min: 1, max: HOURS_PER_HALF_DAY } : { min: 0, max: HOURS_PER_DAY - 1 };
  }
  return { min: 0, max: MINUTES_PER_HOUR - 1 };
}

/**
 * Step a segment, wrapping at its own bounds.
 *
 * Wrapping rather than sticking: stepping 59 minutes up should read `00`, not
 * sit at `59` looking like the control has stopped responding. A 12-hour hour
 * runs 1–12, so its wrap is offset by its minimum rather than landing on zero.
 */
export function stepSegment(
  current: number,
  step: number,
  bounds: { readonly min: number; readonly max: number },
): number {
  const span = bounds.max - bounds.min + 1;
  return ((((current - bounds.min + step) % span) + span) % span) + bounds.min;
}

/**
 * Digits typed into a segment, read through the locale's own glyphs.
 *
 * `٣٠` is thirty. A field that answers `null` to the exact characters its own
 * locale renders is not a field an Arabic-speaking user can fill in.
 */
export function parseSegmentDigits(raw: string, digits: readonly string[]): number | null {
  const ascii = toAsciiDigits(raw, digits).replace(/\D/g, '');
  return ascii === '' ? null : Number.parseInt(ascii, 10);
}

/** A segment's text in the locale's own digits, padded the way the locale pads. */
export function segmentDisplay(
  value: number,
  kind: TimeSegmentKind,
  layout: TimeLayout,
): string {
  const width = kind === 'hour' && layout.hour12 ? 1 : 2;
  return String(value)
    .padStart(width, '0')
    .replace(/\d/g, digit => layout.digits[Number(digit)]);
}
