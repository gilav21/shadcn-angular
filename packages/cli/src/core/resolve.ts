import { registry, type ComponentName } from '../registry/index.js';

/**
 * A name in the install closure is not an own key of the applied registry: a
 * dangling `dependencies` entry, or a name that merely exists on
 * `Object.prototype` (`constructor`, `toString`).
 */
export class UnknownComponentError extends Error {}

function unknownComponent(name: string, requiredBy: string | null): UnknownComponentError {
    const suffix = requiredBy === null ? '' : ` (required by "${requiredBy}")`;
    return new UnknownComponentError(`Unknown component "${name}"${suffix}`);
}

export function resolveDependencies(names: ComponentName[]): Set<ComponentName> {
    const all = new Set<ComponentName>();
    const walk = (name: ComponentName, requiredBy: string | null): void => {
        if (all.has(name)) return;
        // Own keys only: `in` (or a bare index) finds `constructor` on
        // Object.prototype and crashes later reading its `files`.
        if (!Object.hasOwn(registry, name)) throw unknownComponent(name, requiredBy);
        all.add(name);
        for (const dep of registry[name].dependencies ?? []) {
            walk(dep as ComponentName, name);
        }
    };
    for (const name of names) walk(name, null);
    return all;
}
