/**
 * Durations: reading and writing a length of time.
 *
 * ### The value is seconds
 *
 * Not milliseconds — nobody types a duration in milliseconds, and the extra
 * three digits buy only float noise and unreadable fixtures. Not an ISO-8601
 * string either: the point of a duration is arithmetic, and a number does it
 * directly. ISO-8601 is a *serialisation* format, so it lives here as a pair
 * of helpers for consumers whose API speaks it, and is not the value type.
 *
 * See `specs/form-controls-small-spec.md` §3.2.
 */

/** Which segments a field shows, and in what order. */
export type DurationUnit = 'hours' | 'minutes' | 'seconds';

/** A duration split into whole units. */
export interface DurationParts {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;

/**
 * Split a total into whole hours, minutes and seconds.
 *
 * Negative totals are clamped to zero: a duration is a length, and a negative
 * length is not a value a field should be able to hold. A caller that means
 * "before" wants a signed offset, which is a different type.
 */
export function toParts(totalSeconds: number, units: readonly DurationUnit[]): DurationParts {
  const total = Math.max(0, Math.floor(totalSeconds));

  /*
   * The largest unit shown absorbs everything above it.
   *
   * A field showing only minutes and seconds must render 90 minutes as
   * `90:00`, not as `1:30:00` with the hours quietly dropped — dropping them
   * would change the value the moment the user touched any segment.
   */
  const showsHours = units.includes('hours');
  const showsMinutes = units.includes('minutes');
  const showsSeconds = units.includes('seconds');

  if (showsHours) {
    const hours = Math.floor(total / SECONDS_PER_HOUR);
    const rest = total - hours * SECONDS_PER_HOUR;
    return showsMinutes
      ? {
          hours,
          minutes: Math.floor(rest / SECONDS_PER_MINUTE),
          seconds: showsSeconds ? rest % SECONDS_PER_MINUTE : 0,
        }
      : { hours, minutes: 0, seconds: showsSeconds ? rest : 0 };
  }

  if (showsMinutes) {
    const minutes = Math.floor(total / SECONDS_PER_MINUTE);
    return {
      hours: 0,
      minutes,
      seconds: showsSeconds ? total - minutes * SECONDS_PER_MINUTE : 0,
    };
  }

  return { hours: 0, minutes: 0, seconds: total };
}

/** Recombine whole units into a total. */
export function fromParts(parts: DurationParts): number {
  return (
    Math.max(0, Math.floor(parts.hours)) * SECONDS_PER_HOUR +
    Math.max(0, Math.floor(parts.minutes)) * SECONDS_PER_MINUTE +
    Math.max(0, Math.floor(parts.seconds))
  );
}

/** Minimum digits in a segment that is not the first one. */
export const SEGMENT_WIDTH = 2;
/** The leading segment has no minimum: `90:00`, never `090:00`. */
export const LEADING_WIDTH = 1;

/**
 * The digits for one segment, padded to `width`.
 *
 * A width rather than an is-leading flag: the leading segment is not padded
 * because a duration's largest unit has no fixed width the way an hour of the
 * day does, and saying that as a number rather than a boolean keeps the
 * caller's intent readable at the call site.
 */
export function segmentText(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * The whole duration as `h:mm:ss`, showing only the units asked for.
 *
 * Colon-separated rather than `1h 30m`, because the segments are editable and
 * a separator that is also a character someone might type would be ambiguous.
 */
export function formatDuration(
  totalSeconds: number | null,
  units: readonly DurationUnit[],
): string {
  if (totalSeconds === null) return '';
  const parts = toParts(totalSeconds, units);
  return units
    .map((unit, index) => segmentText(parts[unit], index === 0 ? LEADING_WIDTH : SEGMENT_WIDTH))
    .join(':');
}

/**
 * Read a typed duration, or `null` when there is no number in it.
 *
 * `1:30` with hours and minutes shown means an hour and a half; the same text
 * with minutes and seconds shown means ninety seconds. The units decide, not
 * the text — which is why this takes them.
 *
 * Fewer segments than shown are read from the RIGHT, the way a clock is: `30`
 * in an `h:mm` field is thirty minutes, not thirty hours. Typing the small
 * unit first is what people actually do.
 */
export function parseDuration(
  raw: string,
  units: readonly DurationUnit[],
): number | null {
  const text = raw.trim();
  if (text === '') return null;

  const chunks = text.split(':').map(chunk => chunk.trim());
  if (chunks.some(chunk => chunk !== '' && !/^\d+$/.test(chunk))) return null;

  const numbers = chunks.map(chunk => (chunk === '' ? 0 : Number.parseInt(chunk, 10)));
  if (numbers.length > units.length || numbers.some(n => !Number.isFinite(n))) return null;

  // Right-aligned against the units on show.
  const aligned = units.slice(units.length - numbers.length);
  const parts: DurationParts = { hours: 0, minutes: 0, seconds: 0 };
  const filled: Record<DurationUnit, number> = { ...parts };
  aligned.forEach((unit, index) => {
    filled[unit] = numbers[index];
  });

  return fromParts(filled);
}

/**
 * ISO-8601, for an API that speaks it. `PT1H30M`.
 *
 * A serialisation format, offered as a helper rather than used as the value:
 * a consumer doing arithmetic on `PT1H30M` has to parse it first, and the
 * number was right there.
 */
export function formatIso8601(totalSeconds: number | null): string | null {
  if (totalSeconds === null) return null;
  const { hours, minutes, seconds } = toParts(totalSeconds, ['hours', 'minutes', 'seconds']);
  if (hours === 0 && minutes === 0 && seconds === 0) return 'PT0S';

  const body =
    (hours > 0 ? `${hours}H` : '') +
    (minutes > 0 ? `${minutes}M` : '') +
    (seconds > 0 ? `${seconds}S` : '');
  return `PT${body}`;
}

/**
 * Read an ISO-8601 duration. Only the time part.
 *
 * Days and up are deliberately not accepted: a day is not a fixed length once
 * a calendar is involved, and this control edits lengths. Whole seconds only,
 * because that is what the value holds — a fractional second would be floored
 * on the way in and the input would be quietly lying.
 */
export function parseIso8601(text: string): number | null {
  const match = /^PT(\d+H)?(\d+M)?(\d+S)?$/.exec(text.trim());
  // `PT` alone matches the shape but names no length.
  if (!match?.slice(1).some(Boolean)) return null;

  const amount = (part: string | undefined): number =>
    part === undefined ? 0 : Number.parseInt(part, 10);

  return fromParts({
    hours: amount(match[1]),
    minutes: amount(match[2]),
    seconds: amount(match[3]),
  });
}

/** Bounds for one segment, used by the arrow keys and by `aria-valuemax`. */
export function segmentMax(unit: DurationUnit, isLeading: boolean): number {
  /*
   * Only the leading segment is unbounded. Minutes below an hours segment stop
   * at 59 because 60 of them are an hour — but a field showing minutes alone
   * has to allow 90, or a ninety-minute duration could not be typed.
   */
  if (isLeading) return Number.MAX_SAFE_INTEGER;
  return unit === 'hours' ? Number.MAX_SAFE_INTEGER : 59;
}
