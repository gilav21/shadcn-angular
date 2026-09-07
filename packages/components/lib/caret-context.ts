/**
 * Where the caret is, for features that must stay quiet in some contexts.
 */

/**
 * Whether the caret sits inside code — a `<code>` span or a `<pre>` block.
 *
 * Trigger characters are content there, not instructions: writing about code is
 * ordinary use of a rich text editor, and `@Component`, `#include` or a shell
 * path in a snippet must stay literal instead of opening a picker over the
 * author's typing. Shared by the mentions and slash-command addons so the two
 * cannot drift apart on what counts as code.
 */
export function caretIsInCode(doc: Document): boolean {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const node = selection.getRangeAt(0).startContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return !!element?.closest('code, pre');
}
