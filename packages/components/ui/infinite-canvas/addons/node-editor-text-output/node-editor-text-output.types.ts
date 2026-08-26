/**
 * The style a graph can ask for, and the rules that keep it safe to apply.
 *
 * Everything here arrives from inside a graph, which means it is data a user
 * composed rather than a value a developer wrote. Applying it to CSS without
 * checking it is how a display node becomes an injection point, so each field
 * is either matched against a fixed list or parsed as a number and clamped —
 * never passed through as an arbitrary string.
 *
 * Colour is the one exception and gets its own pattern check below.
 */

/** How the text sits in the card. */
export type TextOutputAlign = 'start' | 'center' | 'end';

/** How heavy the text is drawn. */
export type TextOutputWeight = 'normal' | 'medium' | 'semibold' | 'bold';

/**
 * The shape the `style` port accepts.
 *
 * Every field optional: a graph that only sets a colour should not have to
 * describe the rest, and `Set field` builds objects one key at a time.
 */
export interface TextOutputStyle {
  readonly color?: string;
  readonly background?: string;
  readonly size?: number;
  readonly weight?: TextOutputWeight;
  readonly align?: TextOutputAlign;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly mono?: boolean;
}

export const TEXT_OUTPUT_ALIGNS: readonly TextOutputAlign[] = ['start', 'center', 'end'];

export const TEXT_OUTPUT_WEIGHTS: readonly TextOutputWeight[] = [
  'normal',
  'medium',
  'semibold',
  'bold',
];

/** Font size bounds, in px. Below the floor is unreadable, above it escapes the card. */
export const TEXT_OUTPUT_MIN_SIZE = 8;
export const TEXT_OUTPUT_MAX_SIZE = 48;

/**
 * Colours the display will apply.
 *
 * A deliberate allow-list of the notations a person actually types, rather
 * than handing the string to the browser and hoping. It admits `#abc`,
 * `#aabbcc`, `#aabbccdd`, the `rgb()/rgba()/hsl()/hsla()` functions, and bare
 * CSS colour keywords (letters only, so `red` and `rebeccapurple` pass).
 *
 * What it excludes is the point: `url(...)`, `image-set(...)`, anything with a
 * semicolon or brace that could close the declaration and start another, and
 * the legacy `expression(...)`. Angular's style sanitiser would catch most of
 * this anyway — this is the belt to its braces, and it means the same rule
 * applies whether the value reaches CSS or a canvas later.
 */
const COLOR_PATTERN =
  /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([0-9a-z.,%/\s+-]*\)|[a-z]+)$/i;

/** The colour if it is one this display will apply, otherwise `null`. */
export function safeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const colour = value.trim();
  if (colour === '' || colour.length > 64) return null;
  return COLOR_PATTERN.test(colour) ? colour : null;
}
