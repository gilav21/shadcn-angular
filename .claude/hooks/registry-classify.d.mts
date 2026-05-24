/**
 * Type declarations for `registry-classify.mjs`. Lets TypeScript-aware test
 * files import the hook's exported functions without `implicitly any` errors.
 */

export function registryHasComponent(registrySource: string, name: string): boolean;
export function registryReferencesFile(registrySource: string, relPath: string): boolean;
export function pathHasSubSegment(relPath: string): boolean;
export function buildDirOwnerMap(registrySource: string): Map<string, string[]>;
export function isInSingleOwnerDirectory(
    relPath: string,
    dirOwnerMap: Map<string, string[]>,
): boolean;
export function classifyComponentFile(
    relPath: string,
    registrySource: string,
):
    | { kind: 'unknown'; reason: string }
    | { kind: 'top-level'; ownerName: string }
    | { kind: 'sub-component'; ownerName: string };
