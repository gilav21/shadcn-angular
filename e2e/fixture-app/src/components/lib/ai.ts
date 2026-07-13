import { Observable, from, of, isObservable } from 'rxjs';

/**
 * The kind of AI action requested. Editor tasks transform or generate prose;
 * table tasks generate cell values or compile a natural-language filter.
 */
export type AiTask =
    | 'rewrite'
    | 'shorten'
    | 'expand'
    | 'fix-grammar'
    | 'translate'
    | 'summarize'
    | 'continue'
    | 'custom'
    | 'table-fill'
    | 'nl-filter';

export interface AiRequest {
    /** What to do. */
    task: AiTask;
    /** The source text — selected prose, a serialized row, or a NL query. */
    input: string;
    /** A free-form instruction (e.g. the target language, or the user's prompt). */
    prompt?: string;
    /** Extra structured context (columns, locale, surrounding text, …). */
    context?: Record<string, unknown>;
    /** Abort signal — providers should cancel in-flight work when it fires. */
    signal?: AbortSignal;
}

/**
 * What a provider returns. A plain string or Promise is a one-shot answer; an
 * Observable may emit progressively (each emission is the full text so far) to
 * drive a streaming/typewriter UI.
 */
export type AiResult = Observable<string> | Promise<string> | string;

/**
 * The bring-your-own-AI hook. Consumer-supplied and optional — when a component
 * has no `aiProvider`, no AI affordances appear (graceful degradation, mirroring
 * the editor's `mentionSearch` / `imageUploader` callbacks).
 */
export type AiProvider = (request: AiRequest) => AiResult;

/**
 * Normalize any {@link AiResult} into an `Observable<string>` of progressive
 * output, so callers handle streaming and one-shot providers identically.
 */
export function runAiTask(provider: AiProvider, request: AiRequest): Observable<string> {
    const result = provider(request);
    if (isObservable(result)) return result;
    if (result instanceof Promise) return from(result);
    return of(result);
}
