import { registry, type ComponentName } from '../registry/index.js';

export function resolveDependencies(names: ComponentName[]): Set<ComponentName> {
    const all = new Set<ComponentName>();
    const walk = (name: ComponentName): void => {
        if (all.has(name)) return;
        all.add(name);
        for (const dep of registry[name].dependencies ?? []) {
            walk(dep as ComponentName);
        }
    };
    for (const name of names) walk(name);
    return all;
}
