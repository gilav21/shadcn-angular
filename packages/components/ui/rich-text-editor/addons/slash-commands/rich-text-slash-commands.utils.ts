/**
 * Pure DOM helpers for the slash-commands addon: trigger detection against the
 * live caret, resolving the anchor block, consuming the typed `/query` text,
 * and placing the caret afterwards. Extracted verbatim from the base editor so
 * the base ships none of this logic. They operate on the editor content root
 * and its owner document; none read component state, and none re-sync the
 * editor model — the base host method the selected command calls does that.
 */

/** Matches a `/` slash trigger at the end of the given text. */
const SLASH_TRIGGER_PATTERN = /(?:^|[\s([{\u200B])\/([-\p{L}\p{N}_.]*)$/u;

/** The editor block tags the caret is considered to sit "inside" of. */
const EDITABLE_BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'LI', 'BLOCKQUOTE', 'PRE']);

/** Match a slash trigger in the trigger-aware text up to the caret offset. */
export function matchSlashTriggerInText(text: string, cursorPosition: number): RegExpExecArray | null {
    return SLASH_TRIGGER_PATTERN.exec(text.substring(0, cursorPosition));
}

/** Fallback: match against the caret's own text node prefix. */
export function matchSlashTriggerAtCaret(doc: Document): RegExpExecArray | null {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0);
    if (range.startContainer.nodeType !== Node.TEXT_NODE) {
        return null;
    }
    const nodeText = (range.startContainer as Text).data.slice(0, range.startOffset);
    return SLASH_TRIGGER_PATTERN.exec(nodeText);
}

/** Fallback: match against the text from the current block start to the caret. */
export function matchSlashTriggerWithinCurrentBlock(doc: Document, root: HTMLElement): RegExpExecArray | null {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer)) {
        return null;
    }
    const block = findClosestEditableBlockFromRange(doc, root, range);
    if (!block) {
        return null;
    }
    if (range.startContainer === root) {
        return matchSlashTriggerInRootChildBlocks(doc, root, block, range);
    }
    const blockRange = doc.createRange();
    blockRange.setStart(block, 0);
    blockRange.setEnd(range.startContainer, range.startOffset);
    return SLASH_TRIGGER_PATTERN.exec(blockRange.toString());
}

// Chromium may report the caret container as the contenteditable root; probe
// nearby child blocks because startOffset can be unstable in that case.
function matchSlashTriggerInRootChildBlocks(
    doc: Document, root: HTMLElement, block: HTMLElement, range: Range,
): RegExpExecArray | null {
    const candidates: HTMLElement[] = [];
    const pushCandidate = (node: Node | null | undefined): void => {
        if (!node) {
            return;
        }
        const candidate = findClosestEditableBlock(doc, root, node);
        if (candidate && !candidates.includes(candidate)) {
            candidates.push(candidate);
        }
    };
    pushCandidate(block);
    pushCandidate(root.childNodes[range.startOffset] ?? null);
    pushCandidate(root.childNodes[range.startOffset - 1] ?? null);
    pushCandidate(root.lastChild);

    for (const candidate of candidates) {
        const match = SLASH_TRIGGER_PATTERN.exec(candidate.textContent ?? '');
        if (match) {
            return match;
        }
    }
    return null;
}

/** Whether the current selection sits entirely inside the editor content root. */
export function isSelectionInsideEditor(doc: Document, root: HTMLElement): boolean {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return false;
    }
    const range = selection.getRangeAt(0);
    return root.contains(range.startContainer) && root.contains(range.endContainer);
}

/** Clone the current in-editor selection range for later trigger removal. */
export function captureSlashTriggerRange(doc: Document, root: HTMLElement): Range | null {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer)) {
        return null;
    }
    return range.cloneRange();
}

export function getClosestEditableBlockFromSelection(doc: Document, root: HTMLElement): HTMLElement | null {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    return findClosestEditableBlockFromRange(doc, root, selection.getRangeAt(0));
}

/** Resolve the block that should anchor the slash command, from stored state or the live caret. */
export function getClosestEditableBlockForSlashCommand(
    doc: Document, root: HTMLElement, anchorBlock: HTMLElement | null, triggerRange: Range | null,
): HTMLElement | null {
    if (anchorBlock && root.contains(anchorBlock)) {
        return anchorBlock;
    }
    const selection = doc.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (root.contains(range.startContainer)) {
            return findClosestEditableBlockFromRange(doc, root, range);
        }
    }
    if (triggerRange) {
        return findClosestEditableBlockFromRange(doc, root, triggerRange);
    }
    return null;
}

export function findClosestEditableBlockFromRange(doc: Document, root: HTMLElement, range: Range): HTMLElement | null {
    let node: Node = range.startContainer;
    if (node === root) {
        const childCount = root.childNodes.length;
        if (childCount > 0) {
            const index = Math.min(Math.max(range.startOffset - 1, 0), childCount - 1);
            node = root.childNodes[index] ?? root;
        }
    }
    return findClosestEditableBlock(doc, root, node);
}

export function findClosestEditableBlock(doc: Document, root: HTMLElement, node: Node): HTMLElement | null {
    let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (current && current !== root) {
        if (current.nodeType === Node.ELEMENT_NODE) {
            const element = current as HTMLElement;
            if (EDITABLE_BLOCK_TAGS.has(element.tagName)) {
                return element;
            }
        }
        current = current.parentNode;
    }
    return resolveTopLevelEditorBlock(doc, root, node);
}

function resolveTopLevelEditorBlock(doc: Document, root: HTMLElement, node: Node): HTMLElement | null {
    if (node.nodeType === Node.TEXT_NODE && node.parentNode === root) {
        const wrapper = doc.createElement('p');
        (node as ChildNode).before(wrapper);
        wrapper.appendChild(node);
        return wrapper;
    }

    let current: Node | null = node;
    while (current?.parentNode && current.parentNode !== root) {
        current = current.parentNode;
    }

    if (current && current !== root && current.nodeType === Node.ELEMENT_NODE) {
        return current as HTMLElement;
    }

    if (root.childNodes.length === 0) {
        const paragraph = doc.createElement('p');
        paragraph.appendChild(doc.createElement('br'));
        root.appendChild(paragraph);
        return paragraph;
    }

    const firstElementChild = Array.from(root.childNodes).find(child => child.nodeType === Node.ELEMENT_NODE);
    if (firstElementChild) {
        return firstElementChild as HTMLElement;
    }
    return null;
}

/**
 * Remove the typed `/query` trigger text, trying the captured range, the anchor
 * block, the whole editor, then the live caret in turn. Returns the block the
 * caret ended up in, or null when nothing matched.
 */
export function removeSlashTriggerText(
    doc: Document, root: HTMLElement, query: string, triggerRange: Range | null, anchorBlock: HTMLElement | null,
): HTMLElement | null {
    return removeFromRange(doc, root, query, triggerRange)
        ?? removeFromAnchorBlock(doc, root, query, getClosestEditableBlockForSlashCommand(doc, root, anchorBlock, triggerRange))
        ?? removeFromAnchorBlock(doc, root, query, anchorBlock)
        ?? removeFromEditor(doc, root, query)
        ?? removeFromLiveCaret(doc, root, query);
}

function removeFromRange(doc: Document, root: HTMLElement, query: string, range: Range | null): HTMLElement | null {
    if (range?.startContainer.nodeType !== Node.TEXT_NODE) {
        return null;
    }
    const selection = doc.getSelection();
    if (!selection) {
        return null;
    }
    const workRange = range.cloneRange();
    const triggerLength = query.length + 1;
    const textNode = workRange.startContainer as Text;
    const deleteStart = Math.max(0, workRange.startOffset - triggerLength);
    const triggerText = textNode.data.slice(deleteStart, workRange.startOffset);
    if (triggerText !== `/${query}`) {
        return null;
    }
    workRange.setStart(textNode, deleteStart);
    workRange.deleteContents();
    workRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(workRange);
    return findClosestEditableBlock(doc, root, textNode);
}

function removeFromAnchorBlock(
    doc: Document, root: HTMLElement, query: string, anchorBlock: HTMLElement | null,
): HTMLElement | null {
    if (!anchorBlock || !root.contains(anchorBlock)) {
        return null;
    }
    const found = deleteLastTriggerInScope(doc, anchorBlock, query);
    return found ? anchorBlock : null;
}

function removeFromEditor(doc: Document, root: HTMLElement, query: string): HTMLElement | null {
    const found = deleteLastTriggerInScope(doc, root, query);
    return found ? findClosestEditableBlock(doc, root, found) : null;
}

function deleteLastTriggerInScope(doc: Document, scope: HTMLElement, query: string): Text | null {
    const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let candidateNode: Text | null = null;
    let candidateIndex = -1;
    const needle = `/${query}`;
    while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        const index = textNode.data.lastIndexOf(needle);
        if (index >= 0) {
            candidateNode = textNode;
            candidateIndex = index;
        }
    }
    if (!candidateNode || candidateIndex < 0) {
        return null;
    }
    candidateNode.deleteData(candidateIndex, needle.length);
    const selection = doc.getSelection();
    if (selection) {
        const range = doc.createRange();
        range.setStart(candidateNode, candidateIndex);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    return candidateNode;
}

function removeFromLiveCaret(doc: Document, root: HTMLElement, query: string): HTMLElement | null {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0);
    if (range.startContainer.nodeType !== Node.TEXT_NODE) {
        return null;
    }
    const triggerLength = query.length + 1;
    const textNode = range.startContainer as Text;
    const deleteStart = Math.max(0, range.startOffset - triggerLength);
    const triggerText = textNode.data.slice(deleteStart, range.startOffset);
    if (triggerText !== `/${query}`) {
        return null;
    }
    range.setStart(textNode, deleteStart);
    range.deleteContents();
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return findClosestEditableBlock(doc, root, textNode);
}

/** Move the caret to the end of the given block (creating a zero-width node when empty). */
export function placeCaretAtEndOfBlock(doc: Document, block: HTMLElement): void {
    const selection = doc.getSelection();
    if (!selection) {
        return;
    }
    if (isEmptyBlock(block)) {
        setSelectionAtTextEnd(doc, selection, ensureZeroWidthTextNode(doc, block));
        return;
    }
    setSelectionAtNodeEnd(doc, selection, getDeepestLastNode(block));
}

function isEmptyBlock(block: HTMLElement): boolean {
    const text = (block.textContent ?? '').replaceAll('\u200B', '').trim();
    if (text.length > 0) {
        return false;
    }
    const nonEmptyElement = Array.from(block.children).find(child => child.tagName !== 'BR');
    return !nonEmptyElement;
}

function ensureZeroWidthTextNode(doc: Document, block: HTMLElement): Text {
    let target: Text | null = null;
    const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        if (textNode.data.includes('\u200B')) {
            target = textNode;
        }
    }
    if (target) {
        return target;
    }
    target = doc.createTextNode('\u200B');
    if (block.firstChild) {
        block.insertBefore(target, block.firstChild);
    } else {
        block.appendChild(target);
    }
    return target;
}

function getDeepestLastNode(block: HTMLElement): Node {
    let target: Node = block;
    while (target.lastChild) {
        target = target.lastChild;
    }
    return target;
}

function setSelectionAtTextEnd(doc: Document, selection: Selection, textNode: Text): void {
    const range = doc.createRange();
    range.setStart(textNode, textNode.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

function setSelectionAtNodeEnd(doc: Document, selection: Selection, target: Node): void {
    const range = doc.createRange();
    if (target.nodeType === Node.TEXT_NODE) {
        const text = target as Text;
        range.setStart(text, text.length);
    } else {
        range.setStartAfter(target);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

/** Strip zero-width sentinels around the caret left by inline-code insertion, keeping the caret position. */
export function removeCaretSentinelAtSelection(doc: Document): void {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return;
    }
    const range = selection.getRangeAt(0);
    if (range.startContainer.nodeType !== Node.TEXT_NODE) {
        return;
    }
    const textNode = range.startContainer as Text;
    if (!textNode.data.includes('\u200B')) {
        return;
    }
    const originalOffset = range.startOffset;
    const before = textNode.data.slice(0, originalOffset).replaceAll('\u200B', '').length;
    textNode.data = textNode.data.replaceAll('\u200B', '');
    const newOffset = Math.min(before, textNode.data.length);
    const newRange = doc.createRange();
    newRange.setStart(textNode, newOffset);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
}
