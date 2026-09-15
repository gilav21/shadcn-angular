import { registry } from '../../packages/cli/src/registry/index.js';
import { specLabel, type ComponentSpec } from './specs.js';

/**
 * The registry addon keys of `name`, or null when `name` is not a base
 * component that owns addons. `addons[]` is the group definition — no separate
 * map is maintained, so a new addon joins the group the moment it is registered.
 */
function addonKeysOf(name: string): readonly string[] | null {
    const entry = (registry as Record<string, { addons?: readonly string[] } | undefined>)[name];
    const addons = entry?.addons;
    return addons && addons.length > 0 ? addons : null;
}

/**
 * Expand requested e2e names so a base component means "everything about this
 * component".
 *
 * `npm run e2e -- rich-text-editor` used to exit 2 ("Unknown name"); once the
 * base harness exists it would otherwise run that one spec and skip the 14
 * `rte-*` addon specs that also install the editor. A requested name that is a
 * base component with registry `addons[]` therefore expands to every spec whose
 * `names[]` installs the base or one of its addons.
 *
 * Everything else passes through untouched: exact spec labels, components with
 * no `addons[]` (so `npm run e2e -- button` still means one spec even though
 * `form-flow` installs it too), and unknown names — which `run.ts` still
 * rejects with exit 2, on the expanded list.
 *
 * Order-stable and deduped: requested order first, expansion in spec order.
 */
export function expandRequestedNames(
    names: readonly string[],
    specs: readonly ComponentSpec[],
): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (label: string): void => {
        if (seen.has(label)) return;
        seen.add(label);
        out.push(label);
    };

    for (const name of names) {
        const addons = addonKeysOf(name);
        if (!addons) {
            push(name);
            continue;
        }
        const group = new Set<string>([name, ...addons]);
        for (const spec of specs) {
            if (spec.names.some(n => group.has(n))) push(specLabel(spec));
        }
    }
    return out;
}
