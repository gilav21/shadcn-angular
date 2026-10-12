export type ToolResult = {
    content: { type: 'text'; text: string }[];
    isError?: boolean;
};

/**
 * Wrap a value as a JSON tool result. `isError` flags a call that returned its
 * data but did not fully succeed (e.g. an install with recorded failures), so
 * the client and the agent do not take it for a success while still seeing the body.
 */
export function json(value: unknown, options: { readonly isError?: boolean } = {}): ToolResult {
    const result: ToolResult = { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
    if (options.isError) result.isError = true;
    return result;
}

/** Wrap an error message as an error tool result. */
export function err(message: string): ToolResult {
    return { isError: true, content: [{ type: 'text', text: message }] };
}
