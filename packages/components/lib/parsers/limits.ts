/**
 * Resource limits shared by every document parser in `lib/parsers/`.
 *
 * A document is untrusted input: its header can claim any dimension, count or
 * size, and its object graph can reference itself. Every allocation and loop
 * bound derived from file data is clamped either to what the remaining bytes
 * can encode or to one of the caps below, and every walk over file-defined
 * references tracks what it has visited — so a parse costs time and memory
 * proportional to the file it was given. A structure past a cap is skipped or
 * truncated, exactly as a malformed section already is.
 *
 * Internal: parsers take a trailing `limits` argument defaulting to
 * {@link DEFAULT_PARSER_LIMITS}; tests inject tiny caps. It is not part of the
 * public API and is not re-exported from `ui/index.ts`.
 */
export interface ParserLimits {
    /**
     * Largest image (width × height) decoded into pixels. 50 MP holds a 600-dpi
     * scan of an A4/Letter page (≈ 35 MP) or a 300-dpi scan of an A2 sheet
     * (≈ 35 MP); a 600-dpi A3 scan (≈ 70 MP) is over it and is skipped. Past
     * the cap, the decoded rows, PNG and base64 copies of one image head
     * toward gigabytes.
     */
    readonly maxImagePixels: number;
    /**
     * Total bytes all stream decodes in one parse may produce. Each stream is
     * already capped at 64 MB; this bounds a file that references the same
     * stream thousands of times. 1 GiB is about what a 300-page scanned PDF
     * of ~3 MB page images decodes to, so real documents stay whole. Decoding
     * it is a few seconds of work, and it is transient: decoded streams are
     * not retained once a page is rendered.
     */
    readonly maxDecodedBytesTotal: number;
    /** Deepest nesting followed: PDF arrays and form XObjects, PPTX group shapes, DOC art containers. */
    readonly maxNestingDepth: number;
    /** Form XObject draws per page — bounds a form graph that shares sub-forms k times per level. */
    readonly maxFormDrawsPerPage: number;
    /** Most pages a PDF page tree yields. */
    readonly maxPages: number;
    /** Largest single stream read out of an OLE2 (.doc/.xls/.ppt) container. */
    readonly maxOle2StreamBytes: number;
}

export const DEFAULT_PARSER_LIMITS: Readonly<ParserLimits> = Object.freeze({
    maxImagePixels: 50_000_000,
    maxDecodedBytesTotal: 1024 * 1024 * 1024,
    maxNestingDepth: 32,
    maxFormDrawsPerPage: 10_000,
    maxPages: 10_000,
    maxOle2StreamBytes: 256 * 1024 * 1024,
});

/**
 * Marks `node` visited. Returns false when it already was, so a walk over a
 * shared or cyclic reference graph visits each node once.
 */
export function visitOnce<T>(seen: Set<T>, node: T): boolean {
    if (seen.has(node)) return false;
    seen.add(node);
    return true;
}

/**
 * Guards recursive drawing of shared content (form XObjects): a node is
 * skipped when it is already on the current draw path (a cycle), when the path
 * is at the depth cap, or when the draw budget is spent. A node that is merely
 * shared — drawn again from a different path — is drawn every time, because the
 * path is a recursion stack, not an "ever drawn" set.
 */
export class DrawPath<T> {
    private readonly path = new Set<T>();
    private draws = 0;

    constructor(private readonly maxDepth: number, private readonly maxDraws: number) {}

    /** Runs `draw` inside `node` unless a guard trips; returns whether it ran. */
    enter(node: T, draw: () => void): boolean {
        if (this.path.has(node) || this.path.size >= this.maxDepth || this.draws >= this.maxDraws) {
            return false;
        }
        this.draws++;
        this.path.add(node);
        try {
            draw();
        } finally {
            this.path.delete(node);
        }
        return true;
    }
}

/** A byte budget shared by every stream decode in one parse. */
export class DecodeBudget {
    private remaining: number;

    constructor(total: number) {
        this.remaining = total;
    }

    /** Charges `bytes`; returns false (charging nothing) when they do not fit. */
    take(bytes: number): boolean {
        if (bytes > this.remaining) return false;
        this.remaining -= bytes;
        return true;
    }

    /** True once nothing is left, so a caller can refuse work before doing it. */
    get spent(): boolean {
        return this.remaining <= 0;
    }

    /**
     * Gives up what is left. A charge that did not fit means the work it paid
     * for was already done; spending the rest stops every later decode of the
     * same size from doing that work again just to be refused.
     */
    spendRemainder(): void {
        this.remaining = 0;
    }
}
