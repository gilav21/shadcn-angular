/**
 * One virtualized axis: the chunked estimate-and-correct machinery that turns
 * an item index into a pixel offset and back.
 *
 * It was originally inline in `VirtualScrollComponent` for the vertical axis
 * alone. Horizontal and 2D virtualization need exactly the same maths on a
 * second axis, so it lives here and is instantiated once per axis rather than
 * duplicated — the component owns a row axis and a column axis and feeds each
 * the estimate for its own dimension.
 *
 * The design is unchanged from the original: sizes are assumed to be
 * `estimate` until an item is actually measured, and each measurement's delta
 * is folded into a per-chunk correction so a jump far into unmeasured
 * territory costs `O(chunks)` rather than `O(items)`.
 */

/** Measurement deltas smaller than this are sub-pixel noise and are ignored. */
const NOISE_THRESHOLD = 0.5;

export class VirtualAxis {
    /** Items per correction bucket. Larger chunks mean cheaper offset maths and coarser corrections. */
    readonly chunkSize: number;

    private readonly corrections = new Map<number, number>();
    private readonly sizes = new Map<number, number>();

    constructor(chunkSize = 500) {
        this.chunkSize = chunkSize;
    }

    /** Measured size of one item, or `estimate` if it has not been measured yet. */
    size(index: number, estimate: number): number {
        return this.sizes.get(index) ?? estimate;
    }

    /**
     * Record a fresh measurement. Returns the delta applied — `0` when the
     * change was below the noise threshold and nothing was stored, which the
     * caller uses to decide whether a scroll correction is needed.
     */
    record(index: number, measured: number, estimate: number): number {
        const previous = this.size(index, estimate);
        const delta = measured - previous;
        if (Math.abs(delta) < NOISE_THRESHOLD) return 0;

        this.sizes.set(index, measured);
        const chunk = Math.floor(index / this.chunkSize);
        this.corrections.set(chunk, (this.corrections.get(chunk) ?? 0) + delta);
        return delta;
    }

    /** Pixel offset of the item at `index` from the start of the axis. */
    offsetForIndex(index: number, estimate: number): number {
        const chunk = Math.floor(index / this.chunkSize);
        let offset = 0;

        for (let c = 0; c < chunk; c++) {
            offset += this.chunkExtent(c, this.chunkSize, estimate);
        }

        for (let i = chunk * this.chunkSize; i < index; i++) {
            offset += this.size(i, estimate);
        }

        return offset;
    }

    /** Index of the item covering pixel offset `position`, clamped to `total - 1`. */
    indexForOffset(position: number, estimate: number, total: number): number {
        let offset = 0;
        let chunk = 0;
        const chunks = Math.ceil(total / this.chunkSize);

        while (chunk < chunks) {
            const span = chunk === chunks - 1 ? total - chunk * this.chunkSize : this.chunkSize;
            const extent = this.chunkExtent(chunk, span, estimate);
            if (offset + extent > position) break;
            offset += extent;
            chunk++;
        }

        let index = chunk * this.chunkSize;
        while (index < total) {
            const extent = this.size(index, estimate);
            if (offset + extent > position) return index;
            offset += extent;
            index++;
        }

        return Math.min(index, total - 1);
    }

    /** Total pixel extent of `total` items along this axis. */
    totalSize(total: number, estimate: number): number {
        let correction = 0;
        this.corrections.forEach(c => { correction += c; });
        return total * estimate + correction;
    }

    /**
     * Index window covering `[position, position + viewport)`, as a half-open
     * `[start, end)` range. `{ start: 0, end: 0 }` when there is nothing to show.
     */
    window(position: number, viewport: number, estimate: number, total: number): { start: number; end: number } {
        if (total === 0) return { start: 0, end: 0 };

        const start = this.indexForOffset(position, estimate, total);
        const limit = position + viewport;
        let end = start;
        let offset = this.offsetForIndex(start, estimate);

        while (end < total && offset < limit) {
            offset += this.size(end, estimate);
            end++;
        }

        return { start, end };
    }

    private chunkExtent(chunk: number, span: number, estimate: number): number {
        return span * estimate + (this.corrections.get(chunk) ?? 0);
    }
}
