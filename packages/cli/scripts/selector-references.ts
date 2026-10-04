/**
 * Selector-reference guard — see specs/selector-independent-component-identity-spec.md §F.5.
 * Signatures only; implemented in Task 5.
 */

export type PositionKind = 'selector-metadata' | 'tag' | 'select' | 'css-element' | 'other-string';

export interface SelectorReference {
    file: string;
    line: number;
    token: string;
    kind: PositionKind;
}

export interface AllowEntry {
    file: string;
    token: string;
    reason: string;
}

export interface RepoScan {
    files: ReadonlyMap<string, string>;
    declared: ReadonlySet<string>;
    references: SelectorReference[];
}

export const SELECTOR_REFERENCE_ALLOWLIST: readonly AllowEntry[] = [];

export function declaredSelectors(_files: ReadonlyMap<string, string>): ReadonlySet<string> {
    return new Set();
}

export function findSelectorReferences(_file: string, _content: string, _declared: ReadonlySet<string>): SelectorReference[] {
    return [];
}

export function checkReferences(
    _refs: SelectorReference[],
    _declared: ReadonlySet<string>,
    _allow: readonly AllowEntry[],
): string[] {
    return [];
}

export function scanRepo(_root: string): RepoScan {
    return { files: new Map(), declared: new Set(), references: [] };
}
