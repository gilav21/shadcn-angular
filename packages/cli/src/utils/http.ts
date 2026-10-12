/**
 * Bounded network requests (invariant N): every request the CLI makes either
 * completes or fails within a fixed budget, with an error that names the URL
 * and says whether the host was unreachable, too slow, or answered with an
 * HTTP error — after at most one retry on a transient failure.
 *
 * Every CLI request is a GET, so a retry never repeats a side effect.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 500;
const TIMEOUT_ENV = 'SHADCN_ANGULAR_FETCH_TIMEOUT_MS';

export interface FetchBudget {
    /**
     * Per-attempt budget covering connect, headers and body. Default: env
     * `SHADCN_ANGULAR_FETCH_TIMEOUT_MS`, else 15 000.
     */
    readonly timeoutMs?: number;
    /** Extra attempts after a transient failure. Default 1. */
    readonly retries?: number;
    /** Pause before a retry. Default 500 ms. */
    readonly retryDelayMs?: number;
}

/** A body read to completion inside the budget. */
export interface FetchedText {
    readonly status: number;
    readonly statusText: string;
    readonly ok: boolean;
    readonly text: string;
}

/** Thrown for transport failures and timeouts; the message always names the URL. */
export class NetworkError extends Error {
    constructor(
        readonly kind: 'timeout' | 'unreachable',
        readonly url: string,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'NetworkError';
    }
}

/** The budget in `raw` (the env var's value) when it is a positive integer, else the default. */
export function resolveTimeoutMs(raw: string | undefined): number {
    const parsed = Number.parseInt(raw ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/** A 5xx or 429 says "try again"; any other status is the server's final answer. */
function isTransientStatus(status: number): boolean {
    return status >= 500 || status === 429;
}

function describeCause(error: unknown): string {
    if (!(error instanceof Error)) return String(error);
    const cause = error.cause;
    if (typeof cause === 'object' && cause !== null && 'code' in cause && typeof cause.code === 'string') {
        return `${error.message} (${cause.code})`;
    }
    return error.message;
}

/** `signal.aborted` is the authority on a timeout: the rejection's own shape varies between fetch and a body read. */
function toNetworkError(error: unknown, url: string, timeoutMs: number, signal: AbortSignal): NetworkError {
    if (error instanceof NetworkError) return error;
    if (signal.aborted) {
        return new NetworkError('timeout', url, `Timed out after ${timeoutMs} ms: ${url}`, { cause: error });
    }
    return new NetworkError('unreachable', url, `Could not reach the registry (${url}): ${describeCause(error)}`, { cause: error });
}

interface Attempt<T> {
    readonly value: T;
    readonly transient: boolean;
}

/**
 * Runs `attempt` with a fresh signal per try, so a slow first try cannot
 * shorten the second. A transient result or a thrown transport failure is
 * retried; once the retries are spent the last result is returned, or the
 * last failure thrown.
 */
async function withRetry<T>(
    url: string,
    budget: FetchBudget,
    attempt: (signal: AbortSignal) => Promise<Attempt<T>>,
    discard: (value: T) => Promise<void>,
): Promise<T> {
    const timeoutMs = budget.timeoutMs ?? resolveTimeoutMs(process.env[TIMEOUT_ENV]);
    const retries = budget.retries ?? DEFAULT_RETRIES;
    const retryDelayMs = budget.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

    for (let tries = 0; ; tries++) {
        const signal = AbortSignal.timeout(timeoutMs);
        const retriesLeft = tries < retries;
        try {
            const { value, transient } = await attempt(signal);
            if (!transient || !retriesLeft) return value;
            await discard(value);
        } catch (error) {
            const failure = toNetworkError(error, url, timeoutMs, signal);
            if (!retriesLeft) throw failure;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
    }
}

/**
 * `fetch()` with a per-attempt timeout and one retry on a transient failure
 * (transport error, timeout, 5xx, 429). Resolves with the Response for any
 * other status — the caller decides what a 404 means.
 *
 * The timeout also covers a later read of the returned body, but a stalled body
 * then surfaces as the platform's abort error. Use {@link fetchText} to have
 * the body read inside the budget and reported as a {@link NetworkError}.
 */
export function fetchWithTimeout(
    url: string, init?: Omit<RequestInit, 'signal'>, budget: FetchBudget = {},
): Promise<Response> {
    return withRetry(
        url,
        budget,
        async (signal) => {
            const response = await fetch(url, { ...init, signal });
            return { value: response, transient: isTransientStatus(response.status) };
        },
        async (response) => { await response.body?.cancel(); },
    );
}

/** Like {@link fetchWithTimeout}, with the body read to the end inside each attempt's budget. */
export function fetchText(
    url: string, init?: Omit<RequestInit, 'signal'>, budget: FetchBudget = {},
): Promise<FetchedText> {
    return withRetry(
        url,
        budget,
        async (signal) => {
            const response = await fetch(url, { ...init, signal });
            const text = await response.text();
            const { status, statusText, ok } = response;
            return { value: { status, statusText, ok, text }, transient: isTransientStatus(status) };
        },
        async () => undefined,
    );
}
