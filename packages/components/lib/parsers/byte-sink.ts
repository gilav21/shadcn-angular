/**
 * A growable byte buffer with a hard ceiling, for decoders that produce output
 * of unknown length.
 *
 * Every decoder here used to accumulate into a `number[]` and convert at the
 * end. That representation costs 4-8 bytes per output byte, so a "256 MB"
 * decompression ceiling let a hostile stream take 1-2 GB of memory before the
 * guard tripped -- the bomb was stopped after it had done its damage. A typed
 * array costs one byte per byte, doubles as it grows, and refuses the write
 * that would cross the ceiling before allocating for it.
 */
export class ByteSink {
    private buffer: Uint8Array;
    private size = 0;

    /**
     * @param maxBytes Largest output permitted; a write past it throws. Omit
     * for no ceiling.
     * @param initialCapacity Starting allocation, doubled on demand.
     */
    constructor(
        private readonly maxBytes: number = Number.POSITIVE_INFINITY,
        initialCapacity = 4096,
    ) {
        this.buffer = new Uint8Array(Math.max(16, Math.min(initialCapacity, this.capacityCap())));
    }

    /** Bytes written so far. */
    get length(): number {
        return this.size;
    }

    /** The byte at `index`, which must already have been written. */
    at(index: number): number {
        return this.buffer[index];
    }

    push(byte: number): void {
        this.ensure(1);
        this.buffer[this.size++] = byte;
    }

    pushSlice(bytes: ArrayLike<number>): void {
        this.ensure(bytes.length);
        this.buffer.set(bytes, this.size);
        this.size += bytes.length;
    }

    /**
     * Append `length` bytes copied from `distance` bytes back -- the DEFLATE
     * back-reference. Copied one byte at a time on purpose: when `length`
     * exceeds `distance` the source overlaps the bytes being written, which is
     * how a run is expressed, and a block copy would read stale data.
     */
    copyBack(distance: number, length: number): void {
        const start = this.size - distance;
        if (start < 0) throw new Error('Invalid back-reference distance');
        this.ensure(length);
        for (let i = 0; i < length; i++) {
            this.buffer[this.size + i] = this.buffer[start + i];
        }
        this.size += length;
    }

    /** The bytes written, as an exact-length view over a fresh array. */
    toUint8Array(): Uint8Array {
        return this.buffer.slice(0, this.size);
    }

    private capacityCap(): number {
        return Number.isFinite(this.maxBytes) ? this.maxBytes : Number.MAX_SAFE_INTEGER;
    }

    private ensure(extra: number): void {
        const needed = this.size + extra;
        if (needed > this.maxBytes) {
            throw new Error(
                `Decompressed data exceeds the maximum allowed size of ${this.maxBytes} bytes`,
            );
        }
        if (needed <= this.buffer.length) return;

        let capacity = this.buffer.length;
        while (capacity < needed) capacity *= 2;
        const grown = new Uint8Array(Math.min(capacity, this.capacityCap()));
        grown.set(this.buffer.subarray(0, this.size));
        this.buffer = grown;
    }
}
