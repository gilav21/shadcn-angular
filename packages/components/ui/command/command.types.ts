/**
 * Public types for `ui-command`. Kept in a dedicated file so consumers can
 * import them without pulling in the component's runtime imports.
 */

/** One row produced by a {@link CommandSource}. */
export interface CommandResult {
    /** Stable identity for `@for … track`. */
    readonly id: string;
    /** Text the row is selected by, and the payload `ui-command-item` emits. */
    readonly value: string;
    /** Display text, when it differs from {@link value}. */
    readonly label?: string;
    /** Optional grouping key the consumer can bucket rows by. */
    readonly group?: string;
    /** Whatever the consumer needs on select — the original record, a route, an id. */
    readonly data?: unknown;
}

/**
 * An async row provider — typically a server-side search.
 *
 * The palette debounces calls and discards the answer of any call that a newer
 * keystroke has superseded, so results can never go backwards. `signal` is
 * aborted the moment a call is superseded or the palette is destroyed: pass it
 * to `fetch` and the stale request is cancelled on the wire, not just ignored.
 *
 * Throwing (or rejecting) is fine — the palette clears the results and exposes
 * the error on `sourceError()` rather than letting it escape.
 *
 * @example
 * ```ts
 * readonly search: CommandSource = async (query, signal) => {
 *   const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
 *   const rows: { id: string; name: string }[] = await res.json();
 *   return rows.map(r => ({ id: r.id, value: r.name, data: r }));
 * };
 * ```
 */
export type CommandSource = (query: string, signal: AbortSignal) => Promise<readonly CommandResult[]>;

/** One level of the palette's page stack — a drill-down "submenu". */
export interface CommandPage {
    /** Identifies the page; the consumer switches its template on this. */
    readonly id: string;
    /** Human-readable name for a breadcrumb or back button. */
    readonly label?: string;
    /** Anything the page's template needs — the record being drilled into, for instance. */
    readonly data?: unknown;
}
