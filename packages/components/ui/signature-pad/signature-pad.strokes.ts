/**
 * Signature strokes: the resolution-independent form the bitmap is made from.
 *
 * ### Why the strokes are kept at all
 *
 * The *value* is a PNG data URL, because a form value has to be a submittable
 * scalar (§3.2). But a bitmap is the wrong thing to keep in memory: resize the
 * pad and a stored bitmap either blurs or is thrown away, and throwing it away
 * loses the signature (R-4). So the strokes are the source of truth and the
 * bitmap is a projection, re-rendered whenever the pad's size or pixel ratio
 * changes.
 *
 * ### Coordinates are normalised to the pad, 0–1
 *
 * Device pixels would tie a signature to the size and DPI of the screen that
 * drew it — the same data would be a different mark on a different display.
 * Normalised coordinates make a stroke mean the same thing at any size.
 *
 * The trade is that a pad which changes *aspect ratio* stretches the mark
 * rather than letterboxing it. That is the right way round for a signature: it
 * is a mark, not a document, and a stretched signature is still recognisably
 * the same signature, while one letterboxed into a corner looks like a bug.
 *
 * See `specs/form-controls-small-spec.md` §3.2 and R-4.
 */

/** A point on the pad, with both axes normalised to 0–1. */
export interface StrokePoint {
  readonly x: number;
  readonly y: number;
}

/** One continuous mark: everything between a pointer going down and coming up. */
export type Stroke = readonly StrokePoint[];

/** Keep a normalised coordinate inside the pad. */
export function clampUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Turn a position within a box into normalised pad coordinates. */
export function normalisePoint(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
): StrokePoint {
  if (width <= 0 || height <= 0) return { x: 0, y: 0 };
  return { x: clampUnit(offsetX / width), y: clampUnit(offsetY / height) };
}

/**
 * Drop points that are too close to the previous one to be worth keeping.
 *
 * A pointer emits events far faster than a hand moves, so an unfiltered stroke
 * is mostly duplicate coordinates: they cost memory, they make the smoothing
 * jittery, and they bloat any serialised copy. The threshold is in normalised
 * units, so it means the same thing at every pad size.
 */
export const MIN_POINT_DISTANCE = 0.002;

/** Whether a point is far enough from the last one to add. */
export function isFarEnough(previous: StrokePoint | undefined, next: StrokePoint): boolean {
  if (previous === undefined) return true;
  return Math.hypot(next.x - previous.x, next.y - previous.y) >= MIN_POINT_DISTANCE;
}

/**
 * An SVG path for one stroke, smoothed through the midpoints.
 *
 * Joining the raw points with straight lines makes a hand-drawn line look
 * faceted, because the corners land exactly on the sample points. Curving
 * through the *midpoints* instead — each sample becomes a control point rather
 * than a vertex — is the standard fix, and it needs no lookahead, so a stroke
 * can be drawn while it is still being made.
 *
 * A single point is drawn as a dot: a signature contains them (the dot of an
 * `i`, a full stop), and a tap that produced nothing would look broken.
 */
export function strokePath(stroke: Stroke, width: number, height: number): string {
  if (stroke.length === 0) return '';

  const at = (point: StrokePoint): string => `${round(point.x * width)},${round(point.y * height)}`;

  if (stroke.length === 1) {
    // A zero-length line, which a round line cap renders as a dot.
    return `M${at(stroke[0])}L${at(stroke[0])}`;
  }

  let path = `M${at(stroke[0])}`;
  for (let index = 1; index < stroke.length - 1; index++) {
    const point = stroke[index];
    const midpoint: StrokePoint = {
      x: (point.x + stroke[index + 1].x) / 2,
      y: (point.y + stroke[index + 1].y) / 2,
    };
    path += `Q${at(point)} ${at(midpoint)}`;
  }
  // Two points or more by this line, so the fallback is unreachable — it is
  // here to keep the access type-clean rather than asserted.
  path += `L${at(stroke.at(-1) ?? stroke[0])}`;

  return path;
}

/** Two decimal places is finer than any screen; more is noise in the output. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whether anything has actually been drawn. */
export function isEmpty(strokes: readonly Stroke[]): boolean {
  return strokes.every(stroke => stroke.length === 0);
}

/**
 * The whole signature as one SVG document.
 *
 * Offered alongside the PNG value because a signature is line art: SVG is a
 * tenth the size, prints at any resolution, and is what a PDF wants. It is not
 * the value type only because a data URL is what every backend already
 * accepts without being told anything.
 */
export function strokesToSvg(
  strokes: readonly Stroke[],
  width: number,
  height: number,
  color: string,
  lineWidth: number,
): string {
  const paths = strokes
    .filter(stroke => stroke.length > 0)
    .map(stroke => `<path d="${strokePath(stroke, width, height)}"/>`)
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}">` +
    `<g fill="none" stroke="${color}" stroke-width="${lineWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`
  );
}
