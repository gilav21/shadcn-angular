export type ToolResult = {
    content: { type: 'text'; text: string }[];
    isError?: boolean;
};

/** Wrap a value as a JSON tool result. */
export function json(value: unknown): ToolResult {
    return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

/** Wrap an error message as an error tool result. */
export function err(message: string): ToolResult {
    return { isError: true, content: [{ type: 'text', text: message }] };
}
